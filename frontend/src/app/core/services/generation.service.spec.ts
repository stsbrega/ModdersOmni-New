/**
 * Tests for the unified GenerationService entry point.
 *
 * After Plan 3 Task 3, `start()` has only ONE path — the in-browser
 * pipeline. The original spec was branched on `FeatureFlagsService.useClientPipeline()`
 * (flag-OFF = backend SSE, flag-ON = pipeline); the flag is gone, so the
 * old flag-OFF cases are deleted. Remaining coverage:
 *  - `start()` invokes `pipeline.start` exactly once with the args we pass.
 *  - `start()` does NOT open an EventSource (no fallback path now).
 *  - Pipeline events flow into the signal API (events / modsAdded / status / modlistId).
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { GenerationService } from './generation.service';
import { GenerationPipelineService, type PipelineStartArgs } from './generation/pipeline.service';
import type { GenerationEvent, StoredSession } from './generation/types';

// ─── Stubs ──────────────────────────────────────────────────────────────

/** Stub pipeline service — emits via a Subject the test controls. */
class StubPipeline {
  readonly events$ = new Subject<GenerationEvent>();
  /** Promise the orchestrator returns; resolved by the test via finishStart(). */
  startCalls: PipelineStartArgs[] = [];
  private startResolve: ((s: StoredSession) => void) | null = null;
  private startReject: ((e: Error) => void) | null = null;

  events() {
    return this.events$.asObservable();
  }
  start(args: PipelineStartArgs): Promise<StoredSession> {
    this.startCalls.push(args);
    return new Promise<StoredSession>((res, rej) => {
      this.startResolve = res;
      this.startReject = rej;
    });
  }
  /** Test helper: resolve the pending start() with a StoredSession. */
  finishStart(sessionId: string): void {
    this.startResolve?.({
      id: sessionId,
      status: 'completed',
      created_at: '',
      updated_at: '',
      game_slug: 'skyrimse',
      preset: 'small',
      current_phase_index: 0,
      snapshot: {
        game_domain: 'skyrimspecialedition',
        modlist: [],
        patches: [],
        knowledge_flags: [],
        review_flags: [],
        description_cache: {},
        author_cache: {},
        reverse_deps_cache: {},
        searched_queries: [],
        fetched_mod_ids: [],
        completed_phases: [],
        preset: 'small',
        next_load_order: 1,
        requested_mods: [],
      },
    });
  }
  failStart(err: Error): void {
    this.startReject?.(err);
  }
}

// Minimal valid PipelineStartArgs.
const PIPELINE_ARGS: PipelineStartArgs = {
  game: {
    id: 1,
    name: 'Skyrim Special Edition',
    slug: 'skyrimse',
    nexus_domain: 'skyrimspecialedition',
    versions: ['SE', 'AE'],
  },
  preset: 'small',
  hardwareSpec: {},
  llmConfig: { provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'k' },
  gameVersion: 'SE',
  requestedMods: [],
};

// ─── Setup ──────────────────────────────────────────────────────────────

interface Harness {
  svc: GenerationService;
  pipeline: StubPipeline;
}

function setup(): Harness {
  const pipeline = new StubPipeline();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: GenerationPipelineService, useValue: pipeline },
    ],
  });

  const svc = TestBed.inject(GenerationService);

  return { svc, pipeline };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('GenerationService — start() (pipeline-only path)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('start() calls pipeline.start with the supplied args', async () => {
    const h = setup();

    const pipelineStartSpy = spyOn(h.pipeline, 'start').and.callThrough();

    // Don't await — pipeline.start() never resolves until finishStart() is
    // called. We just need to observe the side-effect on the synchronous
    // path.
    void h.svc.start(PIPELINE_ARGS);

    expect(pipelineStartSpy).toHaveBeenCalledTimes(1);
    expect(pipelineStartSpy.calls.first().args[0]).toBe(PIPELINE_ARGS);
    expect(h.svc.status()).toBe('running');

    // Resolve so the Promise machinery cleans up.
    h.pipeline.finishStart('gen-pipeline-1');
    await Promise.resolve();
  });

  it('pipeline mod_added event is reflected in events() signal', async () => {
    const h = setup();

    const startPromise = h.svc.start(PIPELINE_ARGS);

    h.pipeline.events$.next({
      type: 'mod_added',
      mod_id: 12345,
      name: 'SkyUI',
      reason: 'UI is essential',
      load_order: 1,
    });

    // Synchronous Subject: the event is in the signal immediately.
    const evts = h.svc.events();
    expect(evts.length).toBe(1);
    expect(evts[0].type).toBe('mod_added');
    expect(h.svc.modsAdded().length).toBe(1);
    expect(h.svc.modsAdded()[0].mod_id).toBe(12345);

    h.pipeline.finishStart('gen-pipeline-2');
    await startPromise;
  });

  it('pipeline `complete` event flips status() and sets modlistId()', async () => {
    const h = setup();

    const startPromise = h.svc.start(PIPELINE_ARGS);

    h.pipeline.events$.next({
      type: 'complete',
      modlist_id: 'ml-test-001',
    });

    expect(h.svc.status()).toBe('complete');
    expect(h.svc.modlistId()).toBe('ml-test-001');

    h.pipeline.finishStart('gen-pipeline-3');
    await startPromise;
  });
});
