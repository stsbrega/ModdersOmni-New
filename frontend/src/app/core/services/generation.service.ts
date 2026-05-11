/**
 * Singleton service for managing real-time modlist generation.
 *
 * Plan 3 Task 3 collapsed `start()` to a single in-browser pipeline path.
 * Plan 3 Task 4 deleted the now-dead SSE methods (`connectToEvents`,
 * `reconnectIfNeeded`, `startGeneration`, `getStatus`, `resumeGeneration`,
 * `disconnectEvents`, `connected`, `isConnectedTo`) — the broader API
 * service that backed them was removed in the same commit, so there's no
 * backend left to call. Only the pipeline-fed signals remain.
 *
 * Holds state across route navigation — UI components observe these
 * signals from a single source of truth.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  CompleteEvent,
  GenerationEvent,
  ModAddedEvent,
  PatchAddedEvent,
  PausedEvent,
  PhaseStartEvent,
  SizeUpdateEvent,
} from '../../shared/models/generation.model';
import { GenerationPipelineService, type PipelineStartArgs } from './generation/pipeline.service';
import type { StoredSession } from './generation/types';

@Injectable({ providedIn: 'root' })
export class GenerationService {
  /** Active subscription to the client pipeline's events stream. */
  private pipelineSub: Subscription | null = null;

  // The pipeline service is the only injected collaborator now — feature
  // flags + EventSource factory + AuthService all went away with the
  // auth/dual-pipeline strip; the broader ApiService dropped in Task 4.
  private readonly pipeline = inject(GenerationPipelineService);

  // ── Observable state ──
  readonly generationId = signal<string | null>(null);
  readonly events = signal<GenerationEvent[]>([]);
  readonly status = signal<'idle' | 'running' | 'complete' | 'error' | 'paused'>('idle');
  readonly modlistId = signal<string | null>(null);
  readonly runningSize = signal<number>(0);
  readonly runningCount = signal<number>(0);
  /** Game slug for the active generation run (e.g. 'skyrim', 'fallout4'). */
  readonly gameSlug = signal<string>('skyrim');

  // ── Derived state ──
  readonly currentPhase = computed<PhaseStartEvent | null>(() => {
    const evts = this.events();
    for (let i = evts.length - 1; i >= 0; i--) {
      const evt = evts[i];
      if (evt.type === 'phase_start') return evt;
    }
    return null;
  });

  readonly totalPhases = computed(() => {
    const phase = this.currentPhase();
    return phase?.total_phases ?? 0;
  });

  readonly modsAdded = computed(() =>
    this.events().filter(
      (e): e is ModAddedEvent => e.type === 'mod_added'
    )
  );

  readonly patchesAdded = computed(() =>
    this.events().filter(
      (e): e is PatchAddedEvent => e.type === 'patch_added'
    )
  );

  readonly pauseInfo = computed<PausedEvent | null>(() => {
    const evts = this.events();
    for (let i = evts.length - 1; i >= 0; i--) {
      const evt = evts[i];
      if (evt.type === 'paused') return evt;
    }
    return null;
  });

  readonly errorMessage = computed<string | null>(() => {
    const evts = this.events();
    for (let i = evts.length - 1; i >= 0; i--) {
      const evt = evts[i];
      if (evt.type === 'error') return evt.message;
    }
    return null;
  });

  // ── Unified entry point ──

  /**
   * Kick off a generation run via the in-browser pipeline.
   *
   * Plan 3 Task 3 collapsed `start()` from a flag-gated dual-path entry
   * point down to this single path — the backend SSE branch is gone.
   */
  async start(args: PipelineStartArgs): Promise<StoredSession> {
    this.reset();
    this.gameSlug.set(args.game.slug ?? 'skyrim');
    this.status.set('running');
    // Use a synthetic id while the pipeline assigns its own session id
    // internally; we update generationId() to the real one as soon as the
    // StoredSession arrives.
    this.generationId.set('client-pipeline-pending');

    // Subscribe BEFORE start() so we don't miss the first events
    // (start() is async but emits synchronously into the Subject).
    this.pipelineSub = this.pipeline.events().subscribe({
      next: (evt) => this.applyEvent(evt),
      error: (err) =>
        // Pipeline errors usually surface as `error` events; this branch
        // catches anything that escapes to the observable's error channel.
        this.applyEvent({ type: 'error', message: (err as Error).message } as GenerationEvent),
    });

    try {
      const session = await this.pipeline.start(args);
      this.generationId.set(session.id);
      return session;
    } catch (e) {
      // Surface escaped errors as an `error` event so the UI shows them.
      this.applyEvent({
        type: 'error',
        message: (e as Error).message,
      } as GenerationEvent);
      throw e;
    } finally {
      // Pipeline run is over — detach the subscription so we don't leak
      // listeners across runs. The pipeline subject is hot, so unsubscribing
      // simply stops US from receiving.
      this.pipelineSub?.unsubscribe();
      this.pipelineSub = null;
    }
  }

  /**
   * Apply an event to the signal API. Kept private because the only valid
   * caller is the pipeline subscription wired up in `start()`.
   */
  private applyEvent(data: GenerationEvent): void {
    this.events.update((prev) => [...prev, data]);
    switch (data.type) {
      case 'complete':
        this.status.set('complete');
        this.modlistId.set((data as CompleteEvent).modlist_id);
        this.detachPipeline();
        break;
      case 'error':
        this.status.set('error');
        this.detachPipeline();
        break;
      case 'paused':
        this.status.set('paused');
        this.detachPipeline();
        break;
      case 'resumed':
        this.status.set('running');
        break;
      case 'size_update': {
        const s = data as SizeUpdateEvent;
        this.runningSize.set(s.total_bytes);
        this.runningCount.set(s.mod_count);
        break;
      }
    }
  }

  /** Detach the pipeline subscription on terminal events. */
  private detachPipeline(): void {
    if (this.pipelineSub) {
      this.pipelineSub.unsubscribe();
      this.pipelineSub = null;
    }
  }

  /**
   * Reset all state for a new generation.
   * Call this before starting a new generation or when leaving the flow entirely.
   */
  reset(): void {
    this.detachPipeline();
    this.generationId.set(null);
    this.events.set([]);
    this.status.set('idle');
    this.modlistId.set(null);
    this.runningSize.set(0);
    this.runningCount.set(0);
    this.gameSlug.set('skyrim');
  }
}
