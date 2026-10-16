/**
 * Generation pipeline orchestrator.
 *
 * Faithful TS port of `backend/app/services/generation/pipeline.py` (907 LOC).
 * The pipeline runs the build-phase loop, drives the two-phase tool-calling
 * for each phase (PHASE1 = mod selection, PHASE2 = patches/review on the
 * patch phase), invokes the per-phase reviewer, and finally runs the
 * comprehensive cross-phase review.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Significant deviations from Python (and why)
 * ─────────────────────────────────────────────────────────────────────
 *   - **Single LLM config, not a provider list.** Python iterates
 *     `phase_providers` with sticky-front + `exhausted_providers`. The TS
 *     dispatcher takes one `LLMConfig`. So the multi-provider fallback,
 *     `_PERMANENT_ERRORS`, and `last_successful_provider` shuffle don't
 *     translate. One config, one provider per phase. On failure we raise
 *     `PauseGeneration` exactly like Python.
 *   - **No `_generate_legacy` fallback.** Python falls back to a two-phase
 *     legacy pipeline when the DB has no phases. In TS the build phases
 *     ship as static JSON, so a missing/empty file is a hard error.
 *   - **`phase_id` stamping is not done by the tools.service handler.**
 *     Python's `add_to_modlist` stamps `entry["phase_id"]` from
 *     `session.current_phase_id`. The TS `handleAddToModlist` does NOT.
 *     So this orchestrator computes "already added in this phase" via a
 *     length-diff slice (`snapshot.modlist.slice(prePhaseLength, ...)`).
 *   - **Tool-calling LOOP lives here, not in the dispatcher.** Python's
 *     `LLMProvider.generate_with_tools` is the loop. Our dispatcher is
 *     single-turn — it returns one parsed `LLMResponse`. We port the loop
 *     logic (consecutive-text-only nudge, `is_finalized` early-exit,
 *     `max_iterations`, tool exec → `role:'tool'` results) into
 *     `runToolLoop` below. Faithful to `provider.py:generate_with_tools`.
 *   - **Game slug → JSON file mapping.** Game slugs are
 *     `'skyrimse' | 'fallout4'`, but the JSON files are
 *     `build-phases.skyrim.json` and `build-phases.fallout4.json`.
 *   - **Snapshot persistence.** Python uses `session.to_snapshot()` for
 *     pause/resume; the orchestrator persists the snapshot via the
 *     localStorage-backed `session.ts` helpers on every emitted event.
 *
 * Plan 1 Task 13.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, firstValueFrom } from 'rxjs';

import { GenerationToolsService, type ToolEventCallback, type ToolHandlerMap } from './tools.service';
import { ReviewerService } from './reviewer.service';
import { LLMDispatcherService } from '../llm/dispatcher.service';
import { KnowledgeService, type GameSlug, type GameVersion } from '../knowledge.service';
import { ModlistStore } from '../modlist-store.service';
import {
  buildHardwareContext,
  buildPatchPhasePrompt,
  buildPhasePrompt,
  buildPhaseUserMsg,
  buildSweepPrompt,
  classifyError,
} from './prompts';
import { presetMultiplier } from './preset';
import { planSubPasses } from './sub-pass';
import {
  createEmptySnapshot,
  loadSession,
  saveSession,
} from './session';
import { PauseGeneration } from './errors';
import type { LLMConfig, LLMMessage, ToolDefinition } from '../llm/types';
import type {
  BuildPhase,
  Game,
  GenerationEvent,
  GenerationSessionSnapshot,
  HardwareSpecs,
  ModEntry,
  Modlist,
  Playstyle,
  SessionModEntry,
  SizePreset,
  StoredSession,
} from './types';

// ─────────────────────────────────────────────────────────────────────
// Public API types
// ─────────────────────────────────────────────────────────────────────

export interface PipelineStartArgs {
  /** Full game record (needs id + name + nexus_domain + slug). */
  game: Game;
  preset: SizePreset;
  /** Hardware + storage spec — same fields the request used to carry. */
  hardwareSpec: HardwareSpecs;
  /** Optional storage budget override; defaults derived from `hardwareSpec`. */
  availableStorageGb?: number;
  /** Hardware tier string (`'low' | 'mid' | 'high' | 'ultra'`) — pass-through. */
  hardwareTier?: string;
  /** LLM dispatch config used for every PHASE1 + PHASE2 tool loop. */
  llmConfig: LLMConfig;
  /**
   * Optional separate config for the Gemini Pro overseer reviewer. Falls
   * back to `llmConfig` when omitted (matches Python's behavior of using
   * the same provider when a dedicated overseer key isn't configured).
   */
  overseerConfig?: LLMConfig;
  /** Optional playstyle (matches `request.playstyle_id` in Python). */
  playstyle?: Playstyle | null;
  /** Game version (`'SE' | 'AE' | 'Standard' | 'Next-Gen'`). */
  gameVersion?: GameVersion | null;
  /** Free-text user description. */
  customDescription?: string | null;
  /** User-typed list of "must include" mod names. */
  requestedMods?: string[];
  /** Version-notes text injected into the system prompt. Optional. */
  versionNotes?: string;
}

/** Tool-loop iterations cap when running the requested-mods sweep. */
const SWEEP_ITER_FLOOR = 20;
/** Per-mod budget for sweep iterations (matches Python's `len(missing) * 6`). */
const SWEEP_PER_MOD_ITER = 6;

/**
 * Storage-budget percentage applied to `available_storage_gb` (matches
 * Python's `_compute_budgets`: `int(available_storage * 0.80)` with a
 * 10 GB floor).
 */
const STORAGE_BUDGET_PCT = 0.8;
const STORAGE_BUDGET_FLOOR = 10;

/**
 * VRAM-budget percentages by tier (verbatim from `_TIER_VRAM_PCT` in
 * Python pipeline.py). When the caller doesn't supply a tier, the
 * orchestrator falls back to the "mid" multiplier (0.70) — same as
 * Python's `.get(tier, 0.75)` default modulo our chosen mid value.
 */
const TIER_VRAM_PCT: Record<string, number> = {
  low: 0.6,
  mid: 0.7,
  high: 0.8,
  ultra: 0.85,
};

@Injectable({ providedIn: 'root' })
export class GenerationPipelineService {
  private readonly tools = inject(GenerationToolsService);
  private readonly reviewer = inject(ReviewerService);
  private readonly dispatcher = inject(LLMDispatcherService);
  private readonly knowledge = inject(KnowledgeService);
  private readonly http = inject(HttpClient);
  private readonly modlistStore = inject(ModlistStore);

  /** Hot stream of generation events — UI subscribes; all events also persist. */
  private readonly events$ = new Subject<GenerationEvent>();

  /** The session record we're currently mutating; updated as the run progresses. */
  private currentSession: StoredSession | null = null;

  // ───────────────────────────────────────────────────────────────────
  // Public surface
  // ───────────────────────────────────────────────────────────────────

  /** Subscribable stream of generation events. UI hooks observe this. */
  events(): Observable<GenerationEvent> {
    return this.events$.asObservable();
  }

  /**
   * Kick off a new generation run.
   *
   * Mirrors Python's `generate_modlist`. Returns the final `StoredSession`
   * (`status: 'completed' | 'failed' | 'paused'`). The caller uses
   * `events()` to receive incremental updates.
   */
  async start(args: PipelineStartArgs): Promise<StoredSession> {
    const phases = await this.loadBuildPhases(args.game.slug as GameSlug);
    if (!phases || phases.length === 0) {
      throw new Error(
        `No build phases found for game '${args.game.slug}'. ` +
        'Static phase JSON is required (no DB fallback in the client pipeline).',
      );
    }
    await this.knowledge.ready();

    const session = this.makeSession(args, createEmptySnapshot(args.game.nexus_domain));
    session.snapshot.preset = args.preset;
    session.snapshot.requested_mods = [...(args.requestedMods ?? [])];
    this.currentSession = session;
    saveSession(session);

    return this.runPhases(args, phases, session, /* startIndex */ 0);
  }

  /**
   * Resume an in-flight run from its localStorage snapshot.
   *
   * Picks up at `currentPhaseIndex` — earlier phases are skipped, but the
   * snapshot's modlist and review_flags are preserved verbatim.
   */
  async resume(sessionId: string): Promise<StoredSession> {
    const stored = loadSession(sessionId);
    if (!stored) {
      throw new Error(`Cannot resume — no session found for id '${sessionId}'.`);
    }
    if (!stored.llm_config) {
      throw new Error(
        `Cannot resume session '${sessionId}' — no llm_config stored.`,
      );
    }

    // Reconstruct the start-args that we need to feed back into runPhases.
    // game_slug + game_version + preset survive the snapshot directly.
    // The full Game record + Playstyle aren't snapshotted, so the caller
    // must have re-prefetched them; we read what we have.
    const game: Game = (stored as unknown as { _game?: Game })._game ?? {
      // Minimal shim — pipeline.runPhases only reads .name/.nexus_domain/.slug/.id.
      id: 0,
      name: stored.game_slug,
      slug: stored.game_slug,
      nexus_domain: stored.snapshot.game_domain,
    };

    const phases = await this.loadBuildPhases(stored.game_slug);
    if (!phases || phases.length === 0) {
      throw new Error(
        `Cannot resume — build phases for '${stored.game_slug}' not loaded.`,
      );
    }
    await this.knowledge.ready();

    stored.status = 'running';
    stored.last_message = undefined;
    stored.updated_at = new Date().toISOString();
    saveSession(stored);
    this.currentSession = stored;

    const args: PipelineStartArgs = {
      game,
      preset: stored.preset as SizePreset,
      hardwareSpec: {},
      llmConfig: stored.llm_config,
      overseerConfig: stored.overseer_config,
      gameVersion: stored.game_version ?? null,
      requestedMods: [...stored.snapshot.requested_mods],
    };

    this.emit({
      type: 'resumed',
      phase_name: phases[stored.current_phase_index]?.name ?? '',
      phase_number:
        phases[stored.current_phase_index]?.phase_number ?? 0,
    });

    return this.runPhases(args, phases, stored, stored.current_phase_index);
  }

  // ───────────────────────────────────────────────────────────────────
  // Core loop — mirrors generate_modlist() in Python pipeline.py
  // ───────────────────────────────────────────────────────────────────

  private async runPhases(
    args: PipelineStartArgs,
    phases: BuildPhase[],
    session: StoredSession,
    startIndex: number,
  ): Promise<StoredSession> {
    const totalPhases = phases.length;
    const lastPhaseNumber = phases[phases.length - 1].phase_number;

    // Hardware budgets — same calc as Python's `_compute_budgets`.
    const userVram = args.hardwareSpec.vram_mb ?? 6144;
    const tier = args.hardwareTier ?? 'mid';
    const vramBudget = Math.round(userVram * (TIER_VRAM_PCT[tier] ?? 0.75));
    const availableStorage = args.availableStorageGb ?? 50;
    const storageBudgetGb = Math.max(
      STORAGE_BUDGET_FLOOR,
      Math.round(availableStorage * STORAGE_BUDGET_PCT),
    );
    const hardwareContext = buildHardwareContext({
      specs: args.hardwareSpec,
      availableStorageGb: args.availableStorageGb ?? null,
      tier,
      vramBudget,
      storageBudgetGb,
    });

    // Provider-ready event mirrors Python's `providers_ready` emit on entry.
    this.emit({
      type: 'providers_ready',
      providers: [
        {
          provider_id: args.llmConfig.provider,
          name: args.llmConfig.provider,
          model: args.llmConfig.model,
        },
      ],
      count: 1,
    });

    try {
      for (let i = startIndex; i < phases.length; i++) {
        const phase = phases[i];
        const isPatchPhase = phase.phase_number === lastPhaseNumber;

        // Sub-pass plan. Patch phase is always a single pass.
        let subPassTotal = 1;
        let perSubPassCap = phase.max_mods;
        let subPassGuidanceList: string[] = [];
        if (!isPatchPhase) {
          const plan = planSubPasses({
            phaseMaxMods: phase.max_mods,
            phaseScaleWeight: phase.scale_weight,
            presetMultiplier: presetMultiplier(args.preset),
          });
          if (plan.sub_pass_count === 0) {
            // Phase scaled to zero (weight 0 or preset multiplier 0).
            session.snapshot.completed_phases.push(phase.phase_number);
            session.current_phase_index = i + 1;
            saveSession(session);
            continue;
          }
          subPassTotal = plan.sub_pass_count;
          perSubPassCap = plan.per_sub_pass_cap;
          subPassGuidanceList = [...(phase.sub_pass_guidance ?? [])];
        }

        this.emit({
          type: 'phase_start',
          phase: phase.name,
          number: phase.phase_number,
          total_phases: totalPhases,
          is_patch_phase: isPatchPhase,
          provider: args.llmConfig.model,
        } as GenerationEvent);

        // Snapshot mod count BEFORE this phase runs (for the per-phase reviewer).
        const prePhaseLength = session.snapshot.modlist.length;
        const prePhaseModIds = new Set(
          session.snapshot.modlist.map((m) => m['nexus_mod_id'] as number),
        );

        // ── Sub-pass loop ──
        for (let spIndex = 0; spIndex < subPassTotal; spIndex++) {
          const guidance =
            spIndex < subPassGuidanceList.length
              ? subPassGuidanceList[spIndex]
              : null;

          // "Already added in this phase" — derived from the length diff.
          // (TS handlers don't stamp phase_id; Python's `entries_for_phase`
          // does — we substitute slice-since-prePhaseLength here.)
          const alreadyAddedThisPhase = isPatchPhase
            ? []
            : session.snapshot.modlist.slice(prePhaseLength);

          try {
            await this.runSubPass({
              args,
              phase,
              isPatchPhase,
              hardwareContext,
              session,
              totalPhases,
              cap: perSubPassCap,
              alreadyAddedThisPhase,
              subPassGuidance: guidance,
              subPassIndex: spIndex,
              subPassTotal,
            });
          } catch (e) {
            const err = e as Error;
            const [errorType, friendly] = classifyError(
              args.llmConfig.model,
              err,
            );
            this.emit({
              type: 'provider_error',
              provider: args.llmConfig.model,
              // ProviderErrorEvent type uses `error_type`; tools/handlers emit
              // `type` — keep both for backward compat with existing UI.
              error_type: errorType,
              message: friendly,
            } as GenerationEvent);
            throw new PauseGeneration(
              friendly,
              phase.phase_number,
              phase.name,
              session.snapshot,
            );
          }
        }

        session.snapshot.completed_phases.push(phase.phase_number);

        // ── Per-phase reviewer (Gemini Pro overseer) ──
        const reviewerCfg = args.overseerConfig ?? args.llmConfig;
        try {
          await this.reviewer.reviewPhase({
            snapshot: session.snapshot,
            phaseName: phase.name,
            gameName: args.game.name,
            gameVersion: args.gameVersion ?? null,
            playstyleName:
              args.playstyle?.name ?? args.customDescription ?? 'custom',
            hardwareContext,
            prePhaseModIds,
            overseerConfig: reviewerCfg,
          });
        } catch {
          // Reviewer failures must NEVER block generation — Python wraps
          // the call in try/except for the same reason. We swallow.
        }

        const newModCount = session.snapshot.modlist.length - prePhaseLength;
        this.emit({
          type: 'phase_complete',
          phase: phase.name,
          number: phase.phase_number,
          mod_count: newModCount,
          patch_count: session.snapshot.patches.length,
          provider: args.llmConfig.model,
        });

        session.current_phase_index = i + 1;
        saveSession(session);
      }

      // ── Requested-mods sweep (mirrors `_run_requested_mods_sweep`) ──
      await this.runRequestedModsSweep(args, session);

      // ── Final comprehensive review across the full modlist ──
      try {
        await this.reviewer.reviewComprehensive({
          snapshot: session.snapshot,
          gameName: args.game.name,
          gameVersion: args.gameVersion ?? null,
          playstyleName:
            args.playstyle?.name ?? args.customDescription ?? 'custom',
          hardwareContext,
          overseerConfig: args.overseerConfig ?? args.llmConfig,
        });
      } catch {
        // Same logic as per-phase: never block the run on a review failure.
      }

      // ── Save the final modlist & emit `complete` ──
      const modlistId = this.persistFinalModlist(args, session);
      session.status = 'completed';
      session.last_message = 'Generation completed';
      session.updated_at = new Date().toISOString();
      saveSession(session);

      this.emit({ type: 'complete', modlist_id: modlistId });
      return session;
    } catch (e) {
      if (e instanceof PauseGeneration) {
        // Persist & emit a pause; clean exit, no re-throw to caller.
        session.status = 'paused';
        session.last_message = e.reason;
        session.updated_at = new Date().toISOString();
        saveSession(session);
        this.emit({
          type: 'paused',
          reason: e.reason,
          phase_name: e.phaseName,
          phase_number: e.phaseNumber,
          mods_so_far: session.snapshot.modlist.length,
          can_resume: true,
        });
        return session;
      }
      const err = e as Error;
      session.status = 'failed';
      session.last_message = err.message;
      session.updated_at = new Date().toISOString();
      saveSession(session);
      this.emit({ type: 'error', message: err.message });
      throw e;
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Single sub-pass — runs PHASE1 (or PHASE2 for the patch phase) tools.
  // Mirrors `_run_single_sub_pass()` in Python pipeline.py.
  // ───────────────────────────────────────────────────────────────────

  private async runSubPass(opts: {
    args: PipelineStartArgs;
    phase: BuildPhase;
    isPatchPhase: boolean;
    hardwareContext: string;
    session: StoredSession;
    totalPhases: number;
    cap: number;
    alreadyAddedThisPhase: SessionModEntry[];
    subPassGuidance: string | null;
    subPassIndex: number;
    subPassTotal: number;
  }): Promise<void> {
    const {
      args,
      phase,
      isPatchPhase,
      hardwareContext,
      session,
      totalPhases,
      cap,
      alreadyAddedThisPhase,
      subPassGuidance,
      subPassIndex,
      subPassTotal,
    } = opts;

    const methodologyText = this.knowledge.getMethodologyContext(
      args.game.slug as GameSlug,
      phase.phase_number,
      args.gameVersion ?? null,
    );

    let systemPrompt: string;
    let userMsg: string;
    let toolDefs: ToolDefinition[];
    let handlers: ToolHandlerMap;

    // The handlers themselves persist on every event AND fan out to events$.
    const sinkCallback: ToolEventCallback = (e) => {
      this.emit(e as unknown as GenerationEvent);
    };

    if (isPatchPhase) {
      systemPrompt = buildPatchPhasePrompt({
        phase,
        game: args.game,
        gameVersion: args.gameVersion ?? null,
        session: session.snapshot,
        totalPhases,
        methodologyText,
      });
      userMsg = 'Review the modlist above for compatibility patches.';
      toolDefs = this.tools.getPhase2ToolDefinitions();
      handlers = this.tools.buildPhase2Handlers(session.snapshot, sinkCallback);
    } else {
      systemPrompt = buildPhasePrompt({
        phase,
        game: args.game,
        playstyle: args.playstyle ?? null,
        gameVersion: args.gameVersion ?? null,
        versionNotes: args.versionNotes ?? '',
        hardwareContext,
        session: session.snapshot,
        totalPhases,
        methodologyText,
        customDescription: args.customDescription ?? null,
        requestedMods: args.requestedMods ?? [],
        cap,
        alreadyAdded: alreadyAddedThisPhase,
        subPassGuidance,
        subPassIndex,
        subPassTotal,
      });
      userMsg = buildPhaseUserMsg({
        phase,
        playstyle: args.playstyle ?? null,
        game: args.game,
        gameVersion: args.gameVersion ?? null,
        customDescription: args.customDescription ?? null,
        requestedMods: args.requestedMods ?? [],
      });
      toolDefs = this.tools.getPhase1ToolDefinitions();
      handlers = this.tools.buildPhase1Handlers(session.snapshot, sinkCallback);
    }

    // Per-pass iteration budget mirrors Python: `cap * 3 + 10`.
    const maxIterations = cap * 3 + 10;
    // Reset finalize state on the snapshot via a bound-on-handlers capture.
    // (Python sets `session.finalized = False` here.)
    const finalizedFlag = { done: false };
    const wrappedHandlers: ToolHandlerMap = { ...handlers };
    const finalizeKey = isPatchPhase ? 'finalize_review' : 'finalize';
    const originalFinalize = handlers[finalizeKey];
    if (originalFinalize) {
      wrappedHandlers[finalizeKey] = async (a) => {
        finalizedFlag.done = true;
        return originalFinalize(a);
      };
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ];

    await this.runToolLoop({
      cfg: args.llmConfig,
      messages,
      tools: toolDefs,
      handlers: wrappedHandlers,
      maxIterations,
      isFinalized: () => finalizedFlag.done,
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // Tool-calling loop (port of provider.py:generate_with_tools)
  // ───────────────────────────────────────────────────────────────────

  /**
   * The main agentic tool-calling loop. Faithful port of Python's
   * `generate_with_tools` (in provider.py) — except simpler, because the
   * dispatcher already returns parsed `toolCalls` and accepts unified
   * `LLMMessage`s, so there's no Anthropic/OpenAI branch.
   *
   * Loop semantics:
   *   - Each turn: dispatcher.complete(cfg, {messages, tools}).
   *   - If the response has tool_calls, execute each handler and append a
   *     `role: 'tool'` message with the JSON-stringified result.
   *   - If the response is text-only AND the snapshot is finalized, exit
   *     immediately ("LLM finished, phase finalized" in Python logs).
   *   - If text-only, count consecutive_text_only; on the second one,
   *     bail out. Otherwise nudge "Continue — use the tools..." and loop.
   *   - Hits `maxIterations` → log a warning and return.
   */
  protected async runToolLoop(opts: {
    cfg: LLMConfig;
    messages: LLMMessage[];
    tools: ToolDefinition[];
    handlers: ToolHandlerMap;
    maxIterations: number;
    isFinalized: () => boolean;
  }): Promise<void> {
    const { cfg, tools, handlers, maxIterations, isFinalized } = opts;
    // Don't mutate caller's array (matches Python's `messages = list(messages)`).
    const messages: LLMMessage[] = [...opts.messages];
    let consecutiveTextOnly = 0;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const resp = await this.dispatcher.complete(cfg, {
        messages,
        tools,
      });

      // Append assistant message (text + any tool_calls).
      const assistantMsg: LLMMessage = {
        role: 'assistant',
        content: resp.content ?? '',
      };
      if (resp.toolCalls && resp.toolCalls.length > 0) {
        assistantMsg.toolCalls = resp.toolCalls;
      }
      messages.push(assistantMsg);

      // Stream text content as a `thinking` event, like Python's `on_text`.
      if (resp.content) {
        this.emit({
          type: 'thinking',
          text: resp.content.slice(0, 200),
        });
      }

      if (!resp.toolCalls || resp.toolCalls.length === 0) {
        if (isFinalized()) break;
        consecutiveTextOnly += 1;
        if (consecutiveTextOnly >= 2) break;
        messages.push({
          role: 'user',
          content: 'Continue — use the tools to search for and add mods.',
        });
        continue;
      }

      consecutiveTextOnly = 0;

      // Execute each tool call sequentially (matches Python — no fan-out).
      for (const tc of resp.toolCalls) {
        const handler = handlers[tc.name];
        let result: string;
        if (handler) {
          try {
            result = await handler(tc.arguments);
          } catch (e) {
            result = JSON.stringify({ error: (e as Error).message });
          }
        } else {
          result = JSON.stringify({ error: `Unknown tool: ${tc.name}` });
        }
        messages.push({
          role: 'tool',
          toolCallId: tc.id,
          content: result,
        });
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Requested-mods sweep — mirrors `_run_requested_mods_sweep` in Python.
  // Single narrow tool-loop pass over only the missing requested mods.
  // ───────────────────────────────────────────────────────────────────

  private async runRequestedModsSweep(
    args: PipelineStartArgs,
    session: StoredSession,
  ): Promise<void> {
    if (
      !session.snapshot.requested_mods ||
      session.snapshot.requested_mods.length === 0
    ) {
      return;
    }

    const missing = this.missingRequestedMods(session.snapshot);
    if (missing.length === 0) return;

    this.emit({
      type: 'sweep_start',
      missing_count: missing.length,
      missing_mods: missing,
    });

    // Permit sweep to re-query queries that were dedup-cached earlier.
    for (const name of missing) {
      const norm = name.trim().toLowerCase();
      const idx = session.snapshot.searched_queries.indexOf(norm);
      if (idx >= 0) session.snapshot.searched_queries.splice(idx, 1);
    }

    const sinkCallback: ToolEventCallback = (e) => {
      this.emit(e as unknown as GenerationEvent);
    };
    const handlers = this.tools.buildPhase1Handlers(
      session.snapshot,
      sinkCallback,
    );
    const finalizedFlag = { done: false };
    const wrappedHandlers: ToolHandlerMap = { ...handlers };
    const orig = handlers['finalize'];
    if (orig) {
      wrappedHandlers['finalize'] = async (a) => {
        finalizedFlag.done = true;
        return orig(a);
      };
    }

    const systemPrompt = buildSweepPrompt({
      missingMods: missing,
      game: args.game,
      gameVersion: args.gameVersion ?? null,
      session: session.snapshot,
    });
    const userMsg =
      'Add the missing requested mods listed above. Call finalize() when done.';
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ];
    const sweepIterCap = Math.max(
      missing.length * SWEEP_PER_MOD_ITER,
      SWEEP_ITER_FLOOR,
    );

    try {
      await this.runToolLoop({
        cfg: args.llmConfig,
        messages,
        tools: this.tools.getPhase1ToolDefinitions(),
        handlers: wrappedHandlers,
        maxIterations: sweepIterCap,
        isFinalized: () => finalizedFlag.done,
      });
    } catch (e) {
      const [errorType, friendly] = classifyError(
        args.llmConfig.model,
        e as Error,
      );
      // Sweep failures are non-fatal — emit + continue, mirroring Python.
      this.emit({
        type: 'provider_error',
        provider: args.llmConfig.model,
        error_type: errorType,
        message: friendly,
      } as GenerationEvent);
    }

    // Anything still missing after the sweep is surfaced as `missing_requested_mod`.
    const stillMissing = this.missingRequestedMods(session.snapshot);
    for (const name of stillMissing) {
      this.emit({ type: 'missing_requested_mod', name });
    }
    this.emit({
      type: 'sweep_complete',
      still_missing_count: stillMissing.length,
      still_missing: stillMissing,
      added_by_sweep: missing.filter((m) => !stillMissing.includes(m)),
    });
  }

  /**
   * Normalize a mod name for fuzzy comparison. Mirrors `_normalize_mod_name`
   * in Python pipeline.py — lowercase, strip punctuation, collapse whitespace.
   */
  private normalizeModName(name: string): string {
    const cleaned = name.toLowerCase().replace(/[^\w\s]/g, ' ');
    return cleaned.trim().split(/\s+/).join(' ');
  }

  /** Mirrors `_missing_requested_mods` — returns names not yet in the modlist. */
  private missingRequestedMods(snapshot: GenerationSessionSnapshot): string[] {
    const addedNorms = snapshot.modlist.map((e) =>
      this.normalizeModName(e.name as string),
    );
    const missing: string[] = [];
    for (const requested of snapshot.requested_mods) {
      const reqNorm = this.normalizeModName(requested);
      if (!reqNorm) continue;
      const found = addedNorms.some(
        (added) => added === reqNorm || added.startsWith(reqNorm + ' '),
      );
      if (!found) missing.push(requested);
    }
    return missing;
  }

  // ───────────────────────────────────────────────────────────────────
  // Persistence helpers
  // ───────────────────────────────────────────────────────────────────

  /**
   * Persist a modlist to localStorage via `ModlistStore`. Mirrors what
   * Python's API layer would do after a successful generation. Returns
   * the assigned modlist id so the orchestrator can include it in the
   * `complete` event.
   */
  private persistFinalModlist(
    args: PipelineStartArgs,
    session: StoredSession,
  ): string {
    const modlistId = `ml-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    // Compose entries from the snapshot — mods + patches, same shape Python
    // emits as `GenerationResult.entries`.
    const entries: ModEntry[] = [
      ...session.snapshot.modlist.map((m) => this.toModEntry(m, false)),
      ...session.snapshot.patches.map((p) => this.toModEntry(p, true)),
    ];

    const modlist: Modlist = {
      id: modlistId,
      game_id: args.game.id ?? 0,
      game_version: args.gameVersion ?? undefined,
      game_domain: args.game.nexus_domain,
      playstyle_id: args.playstyle?.id,
      entries,
      llm_provider: args.llmConfig.model,
      user_knowledge_flags: session.snapshot.knowledge_flags.map((kf) => ({
        mod_a: String((kf as Record<string, unknown>)['mod_a'] ?? ''),
        mod_b: String((kf as Record<string, unknown>)['mod_b'] ?? ''),
        issue: String((kf as Record<string, unknown>)['issue'] ?? ''),
        severity: String((kf as Record<string, unknown>)['severity'] ?? 'warning'),
      })),
      created_at: new Date().toISOString(),
    };

    this.modlistStore.save(modlist);
    return modlistId;
  }

  private toModEntry(
    e: SessionModEntry,
    isPatch: boolean,
  ): ModEntry {
    return {
      nexus_mod_id: e.nexus_mod_id,
      name: e.name,
      author: (e['author'] as string | undefined) ?? undefined,
      summary: (e['summary'] as string | undefined) ?? undefined,
      reason: e.reason,
      load_order: e.load_order,
      is_patch: isPatch,
      patches_mods: e['patches_mods'] as string[] | undefined,
      // Carried through so the MO2 export doesn't have to re-resolve them.
      file_id: (e['file_id'] as number | undefined) ?? undefined,
      file_size_bytes: e.file_size_bytes ?? undefined,
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────

  /** Construct a fresh `StoredSession` from start args + a blank snapshot. */
  private makeSession(
    args: PipelineStartArgs,
    snapshot: GenerationSessionSnapshot,
  ): StoredSession {
    const id = `gen-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const now = new Date().toISOString();
    return {
      id,
      status: 'running',
      created_at: now,
      updated_at: now,
      game_slug: args.game.slug as GameSlug,
      game_version: args.gameVersion ?? null,
      preset: args.preset,
      current_phase_index: 0,
      snapshot,
      llm_config: args.llmConfig,
      overseer_config: args.overseerConfig,
    };
  }

  /**
   * Game slug → static JSON file. Game slugs are `'skyrimse' | 'fallout4'`
   * but the file uses `skyrim` (no SE suffix), so this map normalizes.
   */
  private buildPhasesUrl(gameSlug: GameSlug): string {
    const fileMap: Record<GameSlug, string> = {
      skyrimse: 'build-phases.skyrim.json',
      fallout4: 'build-phases.fallout4.json',
    };
    const filename = fileMap[gameSlug] ?? `build-phases.${gameSlug}.json`;
    return `/data/${filename}`;
  }

  /**
   * Load the build-phase records for a game from `frontend/public/data/`.
   * The JSON shape mirrors `backend/app/models/mod_build_phase.py` (snake_case).
   */
  protected async loadBuildPhases(gameSlug: GameSlug): Promise<BuildPhase[]> {
    const url = this.buildPhasesUrl(gameSlug);
    return firstValueFrom(this.http.get<BuildPhase[]>(url));
  }

  /**
   * Emit an event to subscribers AND persist the current snapshot. This is
   * the single point where state escapes the orchestrator — keeping the
   * persistence next to emit guarantees the localStorage copy never
   * lags behind the in-memory snapshot.
   */
  private emit(event: GenerationEvent): void {
    if (this.currentSession) {
      this.currentSession.updated_at = new Date().toISOString();
      saveSession(this.currentSession);
    }
    this.events$.next(event);
  }
}
