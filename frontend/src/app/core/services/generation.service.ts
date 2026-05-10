/**
 * Singleton service for managing real-time modlist generation.
 *
 * After Plan 3 Task 3 (auth removal), this service has only ONE active
 * code path: the in-browser pipeline via `GenerationPipelineService`. The
 * legacy backend-SSE methods (`connectToEvents`, `reconnectIfNeeded`,
 * `startGeneration`, `getStatus`, `resumeGeneration`, `connected`,
 * `isConnectedTo`, `disconnectEvents`) are still present because
 * `generation.component.ts` references them — they get deleted in Plan 3
 * Task 4 when the broader backend-API surface goes away. They compile but
 * are functionally dead in the current frontend (no auth means no token,
 * and the backend itself is removed in Task 7).
 *
 * Holds state across route navigation — UI components observe these
 * signals regardless of which path produced them.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';
import {
  CompleteEvent,
  GenerationEvent,
  GenerationStartResponse,
  GenerationStatusResponse,
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
  private baseUrl = window.__env?.API_URL || '/api';
  private eventSource: EventSource | null = null;

  /** Active subscription to the client pipeline's events stream. */
  private pipelineSub: Subscription | null = null;

  // The pipeline service is the only injected collaborator now — feature
  // flags + EventSource factory + AuthService all went away with the
  // auth/dual-pipeline strip.
  private readonly pipeline = inject(GenerationPipelineService);

  // ── Observable state ──
  readonly generationId = signal<string | null>(null);
  readonly events = signal<GenerationEvent[]>([]);
  readonly status = signal<'idle' | 'running' | 'complete' | 'error' | 'paused'>('idle');
  readonly modlistId = signal<string | null>(null);
  readonly runningSize = signal<number>(0);
  readonly runningCount = signal<number>(0);

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

  constructor(private http: HttpClient) {}

  // ── Unified entry point ──

  /**
   * Kick off a generation run via the in-browser pipeline.
   *
   * Plan 3 Task 3 collapsed `start()` from a flag-gated dual-path entry
   * point down to this single path — the backend SSE branch is gone.
   */
  async start(args: PipelineStartArgs): Promise<StoredSession> {
    this.reset();
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
   * Apply an event to the signal API. Pulled out as a private helper so
   * both the pipeline subscription path AND the still-extant SSE methods
   * (dead but compiling — see file header) feed the same state shape.
   */
  private applyEvent(data: GenerationEvent): void {
    this.events.update((prev) => [...prev, data]);
    switch (data.type) {
      case 'complete':
        this.status.set('complete');
        this.modlistId.set((data as CompleteEvent).modlist_id);
        this.disconnectEvents();
        sessionStorage.removeItem('active_generation_id');
        break;
      case 'error':
        this.status.set('error');
        this.disconnectEvents();
        sessionStorage.removeItem('active_generation_id');
        break;
      case 'paused':
        this.status.set('paused');
        this.disconnectEvents();
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

  // ── API Methods (legacy backend SSE — dead but compiling; deleted in Task 4) ──

  startGeneration(request: Record<string, unknown>): Observable<GenerationStartResponse> {
    return this.http.post<GenerationStartResponse>(
      `${this.baseUrl}/generation/start`,
      request,
    );
  }

  getStatus(generationId: string): Observable<GenerationStatusResponse> {
    return this.http.get<GenerationStatusResponse>(
      `${this.baseUrl}/generation/${generationId}/status`,
    );
  }

  resumeGeneration(generationId: string): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${this.baseUrl}/generation/${generationId}/resume`,
      {},
    );
  }

  // ── SSE Connection (legacy — dead but compiling; deleted in Task 4) ──

  /** Whether the SSE stream is currently connected (legacy; always false post-auth). */
  readonly connected = signal(false);

  connectToEvents(generationId: string): void {
    this.generationId.set(generationId);
    this.status.set('running');

    // Persist generation_id so user can recover after browser crash/refresh
    sessionStorage.setItem('active_generation_id', generationId);

    // Close existing connection if any
    this.disconnectEvents();

    // Reset running totals so a fresh stream doesn't inherit prior generation's
    // pill value before the first size_update replay arrives.
    this.runningSize.set(0);
    this.runningCount.set(0);

    // No auth token now — the backend itself is being removed in Task 7,
    // so this URL is effectively dead. Kept for compile-only continuity
    // until Task 4 deletes the SSE methods entirely.
    const url = `${this.baseUrl}/generation/${generationId}/events`;

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.connected.set(true);
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data: GenerationEvent = JSON.parse(event.data);
        this.applyEvent(data);
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    this.eventSource.onerror = () => {
      // EventSource auto-reconnects. On reconnect, the backend replays
      // all stored events, so we might get duplicates. The backend
      // always sends the full history on a new connection.
      this.connected.set(false);
    };
  }

  disconnectEvents(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pipelineSub) {
      this.pipelineSub.unsubscribe();
      this.pipelineSub = null;
    }
    this.connected.set(false);
  }

  /**
   * Reset all state for a new generation.
   * Call this before starting a new generation or when leaving the flow entirely.
   */
  reset(): void {
    this.disconnectEvents();
    this.generationId.set(null);
    this.events.set([]);
    this.status.set('idle');
    this.modlistId.set(null);
    this.runningSize.set(0);
    this.runningCount.set(0);
    sessionStorage.removeItem('active_generation_id');
  }

  /**
   * Get the last active generation_id from sessionStorage.
   * Used to recover after browser crash or refresh.
   */
  getPersistedGenerationId(): string | null {
    return sessionStorage.getItem('active_generation_id');
  }

  /**
   * Check if we have an active/recent generation for the given ID.
   * Used when navigating back to the generation page.
   */
  isConnectedTo(generationId: string): boolean {
    return this.generationId() === generationId && this.eventSource !== null;
  }

  /**
   * Reconnect to an existing generation if we navigated away.
   * The SSE endpoint replays all past events on reconnect.
   */
  reconnectIfNeeded(generationId: string): void {
    if (this.generationId() === generationId) {
      if (this.status() === 'running' && !this.eventSource) {
        // We were running but lost connection — reconnect
        this.events.set([]); // Clear to avoid duplicates from replay
        this.runningSize.set(0);
        this.runningCount.set(0);
        this.connectToEvents(generationId);
      }
      // If complete/error/paused, no need to reconnect — state is already final
      return;
    }

    // Different generation — reset and connect fresh
    this.reset();
    this.connectToEvents(generationId);
  }
}
