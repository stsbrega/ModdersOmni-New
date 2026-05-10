/**
 * Singleton service for managing real-time modlist generation.
 *
 * Holds state across route navigation — for the backend SSE path, the
 * EventSource stays open even when the user navigates away. On return to the
 * generation page, events are replayed from the server (the backend stores
 * all events in memory).
 *
 * Two backends, one signal API:
 *  - Backend SSE (default): `connectToEvents(id)` opens an EventSource and
 *    threads events into `events`/`status`/`modlistId`/etc.
 *  - Client pipeline (Plan 1 Task 14, gated by `FeatureFlagsService.useClientPipeline()`):
 *    `startClientPipeline(args)` subscribes to `GenerationPipelineService.events()`
 *    and feeds the SAME signals. UI components don't need to know which is
 *    active.
 *
 * Key design decisions:
 * - Uses signals for reactive state (Angular 17+ pattern)
 * - EventSource for SSE (auto-reconnect built into the browser API).
 *   Constructor goes through `EventSourceFactory` so tests can swap it.
 * - Token passed as query param since EventSource doesn't support headers
 * - The unified `start()` entry point routes by the flag; legacy
 *   `startGeneration` / `connectToEvents` are kept for callers that still
 *   want the explicit two-step (and for SSE reconnect).
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';
import {
  CompleteEvent,
  ErrorEvent,
  GenerationEvent,
  GenerationStartResponse,
  GenerationStatusResponse,
  ModAddedEvent,
  PatchAddedEvent,
  PausedEvent,
  PhaseStartEvent,
  SizeUpdateEvent,
} from '../../shared/models/generation.model';
import { AuthService } from './auth.service';
import { EventSourceFactory } from './event-source-factory';
import { FeatureFlagsService } from './feature-flags.service';
import { GenerationPipelineService, type PipelineStartArgs } from './generation/pipeline.service';
import type { StoredSession } from './generation/types';

/**
 * Args for the unified `start()` entry. Both fields are optional because
 * each backend needs only one — `start()` validates the right one is
 * present for the active flag.
 */
export interface GenerationStartArgs {
  /** Backend SSE path: the generation_id returned by `POST /api/generation/start`. */
  generationId?: string;
  /** Client pipeline path: full args fed to `GenerationPipelineService.start`. */
  pipelineArgs?: PipelineStartArgs;
}

@Injectable({ providedIn: 'root' })
export class GenerationService {
  private baseUrl = window.__env?.API_URL || '/api';
  private eventSource: EventSource | null = null;

  /** Active subscription to the client pipeline's events stream (when flag is on). */
  private pipelineSub: Subscription | null = null;

  // Injected via inject() to avoid bloating the constructor signature.
  private readonly featureFlags = inject(FeatureFlagsService);
  private readonly pipeline = inject(GenerationPipelineService);
  private readonly esFactory = inject(EventSourceFactory);

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

  constructor(
    private http: HttpClient,
    private auth: AuthService,
  ) {}

  // ── Unified entry point (Plan 1 Task 14) ──

  /**
   * Kick off a generation run on whichever backend the feature flag selects.
   *
   * Flag OFF (default): expects `args.generationId` (the caller has already
   * called `api.startGeneration(...)` and obtained it). We `reset()` and
   * open the SSE stream — equivalent to the legacy two-step.
   *
   * Flag ON: expects `args.pipelineArgs`. We `reset()` and start the client
   * pipeline, subscribing to its events to drive the same signals.
   *
   * Returns a Promise that resolves when the run terminates (complete /
   * paused / error). For the SSE path it resolves once the connection has
   * been opened (the run continues asynchronously after that).
   */
  async start(args: GenerationStartArgs): Promise<StoredSession | void> {
    if (this.featureFlags.useClientPipeline()) {
      if (!args.pipelineArgs) {
        throw new Error(
          'start(): useClientPipeline is on but pipelineArgs missing.',
        );
      }
      return this.startClientPipeline(args.pipelineArgs);
    }
    if (!args.generationId) {
      throw new Error(
        'start(): backend SSE requires generationId (call api.startGeneration first).',
      );
    }
    this.reset();
    this.connectToEvents(args.generationId);
  }

  /**
   * Run the in-browser pipeline and pipe its events into the signal API.
   *
   * Mirrors the SSE `onmessage` handler's switch — same status/modlistId
   * transitions — so UI components observe the same shape regardless of
   * which backend is active.
   *
   * Note: the pipeline service exposes no `stop()`. Once started, an active
   * run keeps going until it finishes; calling `disconnectEvents()` only
   * detaches our subscription. (Resume goes through `pipeline.resume()`.)
   */
  async startClientPipeline(args: PipelineStartArgs): Promise<StoredSession> {
    this.reset();
    this.status.set('running');
    // Use a synthetic id for the UI's generationId signal — the pipeline
    // assigns its own session id internally and stamps it on the StoredSession
    // returned from start(). We update generationId() to the real one as
    // soon as we have it.
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
   * Apply an event from EITHER backend to the signal API. Pulled out of the
   * SSE `onmessage` so the client-pipeline subscription can reuse the same
   * status/modlistId/runningSize transitions verbatim.
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

  // ── API Methods ──

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

  // ── SSE Connection ──

  /** Whether the SSE stream is currently connected */
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

    // EventSource doesn't support Authorization headers.
    // Pass token as query param — the backend validates it the same way.
    const token = this.auth.getAccessToken();
    const url = `${this.baseUrl}/generation/${generationId}/events?token=${encodeURIComponent(token || '')}`;

    this.eventSource = this.esFactory.create(url);

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
