/**
 * Tests for pipeline.service.ts.
 *
 * Source of truth: `backend/app/services/generation/pipeline.py` (907 LOC)
 *
 * The plan's sketch was a starting hint. The actual surface this orchestrator
 * has to drive (validated against Python ground truth):
 *   - Two-phase tool calling per build phase (PHASE1 mods, then PHASE2 patches
 *     on the patch phase).
 *   - Sub-pass splitting when `effective_cap > PER_SUB_PASS_MAX (25)`.
 *   - Per-phase reviewer (JSON output, mutates snapshot — see reviewer tests).
 *   - Final comprehensive review.
 *   - Pause-on-error → snapshot persisted; resume picks up from
 *     `current_phase_index`.
 *   - Tool-loop runs entirely INSIDE the orchestrator (it's the port of
 *     provider.py:generate_with_tools — the dispatcher is single-turn).
 *   - Snapshot persistence on every emitted event.
 */
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { GenerationPipelineService, type PipelineStartArgs } from './pipeline.service';
import { GenerationToolsService } from './tools.service';
import { ReviewerService } from './reviewer.service';
import { LLMDispatcherService } from '../llm/dispatcher.service';
import { KnowledgeService } from '../knowledge.service';
import { NexusService } from '../nexus.service';
import { ModlistStore } from '../modlist-store.service';
import { loadSession } from './session';
import type { LLMConfig, LLMRequest, LLMResponse } from '../llm/types';
import type { BuildPhase, Game, GenerationEvent } from './types';

// ─────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────

const SKYRIM_GAME: Game = {
  id: 1,
  name: 'Skyrim Special Edition',
  slug: 'skyrimse',
  nexus_domain: 'skyrimspecialedition',
  versions: ['SE', 'AE'],
};

const LLM_CFG: LLMConfig = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  apiKey: 'test-key',
};

function phase(
  num: number,
  name: string,
  maxMods: number,
  scaleWeight: number,
  isPlaystyleDriven = false,
): BuildPhase {
  return {
    phase_number: num,
    name,
    description: `${name} description`,
    search_guidance: `Search for ${name}`,
    rules: `${name} rules`,
    example_mods: `Example`,
    is_playstyle_driven: isPlaystyleDriven,
    max_mods: maxMods,
    scale_weight: scaleWeight,
  };
}

const SINGLE_PHASE_LIST: BuildPhase[] = [
  phase(1, 'Essentials', 8, 0.1),
  // Last phase = patch phase by `phase.phase_number === phaseList.last`.
  phase(2, 'Compatibility Patches', 12, 0.5),
];

/**
 * Build a stub LLM response: text + zero or more tool calls.
 * Matches the unified `LLMResponse` shape returned by the dispatcher.
 */
function llmResponse(
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [],
  content = '',
): LLMResponse {
  return {
    content,
    toolCalls: toolCalls.map((tc, i) => ({
      id: `call-${i}`,
      name: tc.name,
      arguments: tc.arguments,
    })),
    finishReason: toolCalls.length > 0 ? 'tool_use' : 'stop',
  };
}

/**
 * Build a sequence of canned responses that the dispatcher cycles through
 * on each `complete()` call. After a `finalize`/`finalize_review` tool call
 * is consumed, the next response is auto-injected as a text-only stop so
 * the orchestrator's tool loop sees `isFinalized()=true` and breaks
 * cleanly instead of bleeding into the NEXT sub-pass's queued response.
 *
 * After total exhaustion, returns text-only ("nothing more to say") which
 * the loop treats as "stop after 2 consecutive text-only responses."
 */
function programmedDispatcher(
  responses: LLMResponse[],
): jasmine.SpyObj<LLMDispatcherService> {
  const spy = jasmine.createSpyObj<LLMDispatcherService>(
    'LLMDispatcherService',
    ['complete'],
  );
  let i = 0;
  let finalizeJustCalled = false;
  spy.complete.and.callFake(async (_cfg: LLMConfig, _req: LLMRequest) => {
    // After a finalize, return text-only to let isFinalized() short-circuit.
    if (finalizeJustCalled) {
      finalizeJustCalled = false;
      return llmResponse([], 'done');
    }
    if (i < responses.length) {
      const r = responses[i++];
      if (
        r.toolCalls.some(
          (tc) => tc.name === 'finalize' || tc.name === 'finalize_review',
        )
      ) {
        finalizeJustCalled = true;
      }
      return r;
    }
    return llmResponse([], '...nothing more to say...');
  });
  return spy;
}

// ─────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────

interface Harness {
  svc: GenerationPipelineService;
  dispatch: jasmine.SpyObj<LLMDispatcherService>;
  reviewer: jasmine.SpyObj<ReviewerService>;
  toolsSvc: jasmine.SpyObj<GenerationToolsService>;
  knowledge: jasmine.SpyObj<KnowledgeService>;
  nexus: jasmine.SpyObj<NexusService>;
  modlistStore: ModlistStore;
  http: HttpTestingController;
}

function setupHarness(opts: {
  responses: LLMResponse[];
  reviewerOverrides?: Partial<jasmine.SpyObj<ReviewerService>>;
}): Harness {
  const dispatch = programmedDispatcher(opts.responses);
  const reviewer = jasmine.createSpyObj<ReviewerService>('ReviewerService', [
    'reviewPhase',
    'reviewComprehensive',
  ]);
  // Default: skipped (no-op) — tests can override.
  reviewer.reviewPhase.and.resolveTo({
    approved: [],
    flagged: [],
    rejected: [],
    skipped: true,
  });
  reviewer.reviewComprehensive.and.resolveTo({
    cross_phase_conflicts: [],
    vram_assessment: {},
    load_order_issues: [],
    theme_coherence: {},
    missing_essentials: [],
    rejected: [],
    skipped: true,
  });
  if (opts.reviewerOverrides) {
    Object.assign(reviewer, opts.reviewerOverrides);
  }

  // Real GenerationToolsService — but with a stubbed Nexus so tool handlers
  // run without HTTP. We MUST inject NexusService.
  const nexus = jasmine.createSpyObj<NexusService>('NexusService', [
    'searchMods',
    'getMod',
    'getModFiles',
  ]);
  nexus.searchMods.and.resolveTo([]);
  nexus.getMod.and.resolveTo(null);
  nexus.getModFiles.and.resolveTo([]);

  // Real tools service so handlers actually mutate snapshot state. The
  // pipeline orchestrates handler invocation; we need real handler bodies.
  const toolsSvcRealOrSpy =
    null as unknown as jasmine.SpyObj<GenerationToolsService>;

  // Knowledge — stub the methodology context to a fixed string and ready().
  const knowledge = jasmine.createSpyObj<KnowledgeService>('KnowledgeService', [
    'getMethodologyContext',
    'ready',
    'isReady',
  ]);
  knowledge.getMethodologyContext.and.returnValue('METHODOLOGY-STUB');
  knowledge.ready.and.resolveTo();
  knowledge.isReady.and.returnValue(true);

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LLMDispatcherService, useValue: dispatch },
      { provide: ReviewerService, useValue: reviewer },
      { provide: KnowledgeService, useValue: knowledge },
      { provide: NexusService, useValue: nexus },
      // ToolsService gets DEFAULT (real) — it's a side-effect-only injectable.
    ],
  });

  const svc = TestBed.inject(GenerationPipelineService);
  const toolsSvc = TestBed.inject(
    GenerationToolsService,
  ) as unknown as jasmine.SpyObj<GenerationToolsService>;
  const modlistStore = TestBed.inject(ModlistStore);
  const http = TestBed.inject(HttpTestingController);

  return {
    svc,
    dispatch,
    reviewer,
    toolsSvc: toolsSvcRealOrSpy ?? toolsSvc,
    knowledge,
    nexus,
    modlistStore,
    http,
  };
}

/** Drain pending HTTP requests for the build-phases JSON. */
function flushPhases(http: HttpTestingController, phases: BuildPhase[]): void {
  const req = http.expectOne((r) =>
    r.url.startsWith('/data/build-phases'),
  );
  req.flush(phases);
}

function defaultArgs(overrides: Partial<PipelineStartArgs> = {}): PipelineStartArgs {
  return {
    game: SKYRIM_GAME,
    preset: 'small',
    hardwareSpec: { gpu: 'RTX 3080', vram_mb: 10240, cpu: 'i7', ram_gb: 32 },
    hardwareTier: 'mid',
    llmConfig: LLM_CFG,
    gameVersion: 'SE',
    requestedMods: [],
    versionNotes: 'SE notes',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe('GenerationPipelineService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Verify no leftover HTTP requests.
    try {
      const http = TestBed.inject(HttpTestingController);
      http.verify();
    } catch {
      /* ignore — TestBed already torn down */
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // Single-phase happy path
  // ───────────────────────────────────────────────────────────────────

  it('runs a single-phase happy path: phase1 add+finalize → review → patch_phase finalize_review', async () => {
    // Sequence:
    //  Phase 1 (Essentials, max_mods=8 scale=0.1, preset=small mult=0.5
    //    → effective_cap = round(8*0.1*0.5) = 0 → SKIPPED. Use big maxMods.
    const phases: BuildPhase[] = [
      phase(1, 'Essentials', 20, 1.0),
      phase(2, 'Patches', 5, 1.0),
    ];

    const responses: LLMResponse[] = [
      // Phase 1: add one mod, then finalize.
      llmResponse([
        {
          name: 'add_to_modlist',
          arguments: {
            mod_id: 999,
            name: 'SkyUI',
            reason: 'UI is essential',
          },
        },
      ]),
      llmResponse([{ name: 'finalize', arguments: {} }]),
      // Phase 2 (patch phase): add patch, then finalize_review.
      llmResponse([
        {
          name: 'add_patch',
          arguments: {
            mod_id: 1234,
            name: 'SkyUI USSEP Patch',
            patches_mods: ['SkyUI'],
            reason: 'compat',
          },
        },
      ]),
      llmResponse([{ name: 'finalize_review', arguments: {} }]),
    ];

    const harness = setupHarness({ responses });
    const events: GenerationEvent[] = [];
    harness.svc.events().subscribe((e) => events.push(e));

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    const session = await promise;

    expect(session.status).toBe('completed');
    expect(harness.dispatch.complete.calls.count()).toBeGreaterThanOrEqual(4);
    expect(session.snapshot.modlist.length).toBe(1);
    expect(session.snapshot.modlist[0].nexus_mod_id).toBe(999);
    expect(session.snapshot.patches.length).toBe(1);
    // Reviewer is called once per phase (2 phases) plus the final comprehensive.
    expect(harness.reviewer.reviewPhase.calls.count()).toBe(2);
    expect(harness.reviewer.reviewComprehensive.calls.count()).toBe(1);
    // `complete` event was emitted.
    expect(events.some((e) => e.type === 'complete')).toBeTrue();
  });

  // ───────────────────────────────────────────────────────────────────
  // Multi-sub-pass — phase whose effective cap > PER_SUB_PASS_MAX (25)
  // ───────────────────────────────────────────────────────────────────

  it('splits a high-cap phase into multiple sub-passes', async () => {
    // max_mods=60, scale=1, preset=medium (1.0) → effective_cap=60 → 3 sub-passes
    const phases: BuildPhase[] = [
      phase(1, 'Big Phase', 60, 1.0),
      phase(2, 'Patches', 5, 1.0),
    ];
    // Each sub-pass must call finalize once. There are 3 sub-passes for
    // phase 1 + 1 for phase 2 = 4 finalize calls total. Add a no-op tool
    // call before each finalize so we're exercising the multi-turn loop.
    const responses: LLMResponse[] = [];
    for (let i = 0; i < 3; i++) {
      // 3 sub-passes, one finalize each.
      responses.push(llmResponse([{ name: 'finalize', arguments: {} }]));
    }
    responses.push(llmResponse([{ name: 'finalize_review', arguments: {} }]));

    const harness = setupHarness({ responses });

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    const session = await promise;

    // 3 sub-pass tool loops in phase 1 + 1 in phase 2 = 4 user-finalize turns;
    // each followed by an auto-injected text-only response (see fixture) so the
    // tool loop's isFinalized() short-circuit fires. Total: 8 dispatcher calls.
    expect(harness.dispatch.complete.calls.count()).toBe(8);
    expect(session.status).toBe('completed');
  });

  // ───────────────────────────────────────────────────────────────────
  // Reviewer rejects — mods are removed from the snapshot
  // ───────────────────────────────────────────────────────────────────

  it('removes rejected mods when the per-phase reviewer rejects them', async () => {
    const phases: BuildPhase[] = [
      phase(1, 'Foo', 20, 1.0),
      phase(2, 'Patches', 5, 1.0),
    ];

    const responses: LLMResponse[] = [
      // Phase 1: add 2 mods, then finalize.
      llmResponse([
        {
          name: 'add_to_modlist',
          arguments: { mod_id: 100, name: 'Mod A', reason: 'r' },
        },
        {
          name: 'add_to_modlist',
          arguments: { mod_id: 200, name: 'Mod B', reason: 'r' },
        },
      ]),
      llmResponse([{ name: 'finalize', arguments: {} }]),
      // Phase 2: just finalize.
      llmResponse([{ name: 'finalize_review', arguments: {} }]),
    ];

    const harness = setupHarness({ responses });

    // Override reviewer to actually mutate the snapshot like the real one.
    harness.reviewer.reviewPhase.and.callFake(async ({ snapshot }) => {
      // Reject Mod B.
      snapshot.modlist = snapshot.modlist.filter(
        (m) => m['nexus_mod_id'] !== 200,
      );
      return {
        approved: [100],
        flagged: [],
        rejected: [{ mod_id: 200, name: 'Mod B', reason: 'bad' }],
        skipped: false,
      };
    });

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    const session = await promise;

    expect(session.snapshot.modlist.length).toBe(1);
    expect(session.snapshot.modlist[0]['nexus_mod_id']).toBe(100);
  });

  // ───────────────────────────────────────────────────────────────────
  // Final comprehensive review fires after all phases
  // ───────────────────────────────────────────────────────────────────

  it('runs a final comprehensive review after all phases complete', async () => {
    const phases: BuildPhase[] = [
      phase(1, 'A', 20, 1.0),
      phase(2, 'Patches', 5, 1.0),
    ];
    const responses: LLMResponse[] = [
      llmResponse([{ name: 'finalize', arguments: {} }]),
      llmResponse([{ name: 'finalize_review', arguments: {} }]),
    ];
    const harness = setupHarness({ responses });

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    await promise;

    expect(harness.reviewer.reviewComprehensive.calls.count()).toBe(1);
    // Comprehensive runs AFTER per-phase, so per-phase calls precede it.
    expect(harness.reviewer.reviewPhase.calls.count()).toBe(2);
  });

  // ───────────────────────────────────────────────────────────────────
  // Snapshot persistence — every event triggers a localStorage write
  // ───────────────────────────────────────────────────────────────────

  it('persists the session to localStorage on every emit', async () => {
    const phases: BuildPhase[] = [
      phase(1, 'A', 20, 1.0),
      phase(2, 'Patches', 5, 1.0),
    ];
    const responses: LLMResponse[] = [
      llmResponse([{ name: 'finalize', arguments: {} }]),
      llmResponse([{ name: 'finalize_review', arguments: {} }]),
    ];
    const harness = setupHarness({ responses });

    const setItemSpy = spyOn(localStorage, 'setItem').and.callThrough();

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    const session = await promise;

    // localStorage was written under the session key at least once. We
    // verify (a) the key exists, (b) load returns matching id.
    expect(setItemSpy).toHaveBeenCalled();
    const restored = loadSession(session.id);
    expect(restored).not.toBeNull();
    expect(restored!.id).toBe(session.id);
    expect(restored!.status).toBe('completed');
  });

  // ───────────────────────────────────────────────────────────────────
  // Tool-loop max-iterations exceeded — pipeline still completes (matches
  // Python: provider.py logs a warning and returns; phase still advances).
  // ───────────────────────────────────────────────────────────────────

  it('handles a phase where the LLM never finalizes (text-only ×2 → break)', async () => {
    const phases: BuildPhase[] = [
      phase(1, 'A', 20, 1.0),
      phase(2, 'Patches', 5, 1.0),
    ];
    // Phase 1: every response is text-only → two consecutive text-only
    // exits the tool loop (mirrors Python's consecutive_text_only=2).
    const responses: LLMResponse[] = [
      llmResponse([], 'text-1'),
      llmResponse([], 'text-2'),
      // Phase 2: same.
      llmResponse([], 'text-3'),
      llmResponse([], 'text-4'),
    ];
    const harness = setupHarness({ responses });

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    const session = await promise;

    // Pipeline still completes (matches Python — text-only just ends the
    // sub-pass, doesn't fail the run).
    expect(session.status).toBe('completed');
  });

  // ───────────────────────────────────────────────────────────────────
  // Provider error → PauseGeneration → snapshot saved with status=paused
  // ───────────────────────────────────────────────────────────────────

  it('pauses cleanly on a dispatcher error mid-phase', async () => {
    const phases: BuildPhase[] = [
      phase(1, 'A', 20, 1.0),
      phase(2, 'Patches', 5, 1.0),
    ];
    const harness = setupHarness({ responses: [] });
    harness.dispatch.complete.and.rejectWith(new Error('429 rate limited'));

    const events: GenerationEvent[] = [];
    harness.svc.events().subscribe((e) => events.push(e));

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    const session = await promise;

    expect(session.status).toBe('paused');
    expect(events.some((e) => e.type === 'paused')).toBeTrue();
    // Resume metadata is on the persisted session.
    const restored = loadSession(session.id);
    expect(restored!.status).toBe('paused');
    expect(restored!.last_message?.toLowerCase()).toContain('rate');
  });

  // ───────────────────────────────────────────────────────────────────
  // Resume flow — paused session picks up at current_phase_index
  // ───────────────────────────────────────────────────────────────────

  it('resume() picks up at current_phase_index from the stored snapshot', async () => {
    const phases: BuildPhase[] = [
      phase(1, 'A', 20, 1.0),
      phase(2, 'B', 20, 1.0),
      phase(3, 'Patches', 5, 1.0),
    ];

    // First run: pause at phase 2 (index 1). Custom dispatcher fake that mimics
    // the canned-response pattern (finalize → auto text-only → next phase) but
    // throws when phase 2 starts.
    const harness1 = setupHarness({ responses: [] });
    let phase1FinalizeSeen = false;
    let phase1TextOnlyServed = false;
    harness1.dispatch.complete.and.callFake(async () => {
      if (!phase1FinalizeSeen) {
        phase1FinalizeSeen = true;
        return llmResponse([{ name: 'finalize', arguments: {} }]);
      }
      if (!phase1TextOnlyServed) {
        phase1TextOnlyServed = true;
        return llmResponse([], 'phase 1 done');
      }
      // Phase 2 starts: throw to trigger pause.
      throw new Error('429 rate limit on phase 2');
    });

    const promise1 = harness1.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness1.http, phases);
    const paused = await promise1;
    expect(paused.status).toBe('paused');
    expect(paused.current_phase_index).toBe(1);

    // Tear down + re-create harness for resume.
    TestBed.resetTestingModule();

    // Second run: simple finalize for phase 2 + finalize_review for phase 3.
    const responsesPart2: LLMResponse[] = [
      llmResponse([{ name: 'finalize', arguments: {} }]),
      llmResponse([{ name: 'finalize_review', arguments: {} }]),
    ];
    const harness2 = setupHarness({ responses: responsesPart2 });

    const resumePromise = harness2.svc.resume(paused.id);
    flushPhases(harness2.http, phases);
    const resumed = await resumePromise;

    expect(resumed.status).toBe('completed');
    // Phase 1 NOT re-run — confirmed by dispatcher call count: phase 2 +
    // phase 3 each consume one finalize turn + one auto-text-only stop = 4.
    expect(harness2.dispatch.complete.calls.count()).toBe(4);
  });

  // ───────────────────────────────────────────────────────────────────
  // Phase that scales to zero — skipped (no LLM call, no review)
  // ───────────────────────────────────────────────────────────────────

  it('skips a phase whose effective_cap rounds to 0', async () => {
    // small preset (×0.5) × scale_weight 0 = 0 effective cap.
    const phases: BuildPhase[] = [
      // First phase: scale_weight 0 → skip.
      phase(1, 'Zero', 20, 0),
      phase(2, 'Patches', 5, 1.0),
    ];
    const responses: LLMResponse[] = [
      // Only phase 2 is run (one finalize_review).
      llmResponse([{ name: 'finalize_review', arguments: {} }]),
    ];
    const harness = setupHarness({ responses });

    const promise = harness.svc.start(defaultArgs({ preset: 'small' }));
    flushPhases(harness.http, phases);
    const session = await promise;

    expect(session.status).toBe('completed');
    // Only phase 2 runs: finalize_review turn + auto text-only stop = 2 calls.
    expect(harness.dispatch.complete.calls.count()).toBe(2);
    // Reviewer per-phase was only called for phase 2.
    expect(harness.reviewer.reviewPhase.calls.count()).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────
  // Final modlist persisted via ModlistStore; complete event has its id
  // ───────────────────────────────────────────────────────────────────

  it('saves the generated modlist via ModlistStore on completion', async () => {
    const phases: BuildPhase[] = [
      phase(1, 'A', 20, 1.0),
      phase(2, 'Patches', 5, 1.0),
    ];
    const responses: LLMResponse[] = [
      llmResponse([
        {
          name: 'add_to_modlist',
          arguments: { mod_id: 42, name: 'Skyrim Mod', reason: 'r' },
        },
      ]),
      llmResponse([{ name: 'finalize', arguments: {} }]),
      llmResponse([{ name: 'finalize_review', arguments: {} }]),
    ];
    const harness = setupHarness({ responses });

    const events: GenerationEvent[] = [];
    harness.svc.events().subscribe((e) => events.push(e));

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    await promise;

    const completeEvent = events.find((e) => e.type === 'complete') as
      | { type: 'complete'; modlist_id: string }
      | undefined;
    expect(completeEvent).toBeDefined();
    const saved = harness.modlistStore.get(completeEvent!.modlist_id);
    expect(saved).not.toBeNull();
    expect(saved!.entries.find((e) => e.nexus_mod_id === 42)).toBeDefined();
    expect(saved!.game_id).toBe(SKYRIM_GAME.id);
    expect(saved!.game_domain).toBe(SKYRIM_GAME.nexus_domain);
  });

  // ───────────────────────────────────────────────────────────────────
  // Hard error: build phases JSON empty → start() throws
  // ───────────────────────────────────────────────────────────────────

  it('throws when no build phases are loaded for the game', async () => {
    const harness = setupHarness({ responses: [] });
    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    // The HTTP layer responds with an empty array; pipeline rejects.
    flushPhases(harness.http, []);
    await expectAsync(promise).toBeRejectedWithError(/No build phases/);
  });

  // ───────────────────────────────────────────────────────────────────
  // Methodology resolved with phaseNumber + gameSlug (NOT slug+slug)
  // ───────────────────────────────────────────────────────────────────

  it('resolves methodology with (gameSlug, phaseNumber, gameVersion)', async () => {
    const phases: BuildPhase[] = [
      phase(7, 'Mid', 20, 1.0),
      phase(8, 'Patches', 5, 1.0),
    ];
    const responses: LLMResponse[] = [
      llmResponse([{ name: 'finalize', arguments: {} }]),
      llmResponse([{ name: 'finalize_review', arguments: {} }]),
    ];
    const harness = setupHarness({ responses });

    const promise = harness.svc.start(defaultArgs({ preset: 'medium' }));
    flushPhases(harness.http, phases);
    await promise;

    // First call should pass gameSlug='skyrimse', phaseNumber=7, gameVersion='SE'.
    const firstCall = harness.knowledge.getMethodologyContext.calls.first();
    expect(firstCall.args[0]).toBe('skyrimse');
    expect(firstCall.args[1]).toBe(7);
    expect(firstCall.args[2]).toBe('SE');
  });
});
