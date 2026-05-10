/**
 * Tests for the unified GenerationService entry point (Plan 1 Task 14).
 *
 * Covers the feature-flag branch in `start()`:
 *   - flag OFF (default): EventSource opened via the EventSourceFactory,
 *     pipeline.start NOT called.
 *   - flag ON: pipeline.start called, EventSource NOT opened.
 *   - pipeline `mod_added` events flow into the same `events()` signal.
 *   - pipeline `complete` event flips `status()` to `'complete'` and sets
 *     `modlistId()`.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { GenerationService } from './generation.service';
import { EventSourceFactory } from './event-source-factory';
import { FeatureFlagsService } from './feature-flags.service';
import { GenerationPipelineService, type PipelineStartArgs } from './generation/pipeline.service';
import { AuthService } from './auth.service';
import type { GenerationEvent, StoredSession } from './generation/types';

// ─── Stubs ──────────────────────────────────────────────────────────────

/** A no-op EventSource stand-in. Just enough surface for the consumer. */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  close(): void {
    this.closed = true;
  }
}

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

class StubAuth {
  getAccessToken(): string | null {
    return 'test-token';
  }
}

// Minimal valid PipelineStartArgs for the on-flag tests.
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
  flags: FeatureFlagsService;
  pipeline: StubPipeline;
  esFactory: EventSourceFactory;
  esCreateSpy: jasmine.Spy;
}

function setup(): Harness {
  FakeEventSource.last = null;
  const pipeline = new StubPipeline();

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: AuthService, useClass: StubAuth },
      { provide: GenerationPipelineService, useValue: pipeline },
    ],
  });

  const esFactory = TestBed.inject(EventSourceFactory);
  const esCreateSpy = spyOn(esFactory, 'create').and.callFake(
    (url: string) => new FakeEventSource(url) as unknown as EventSource,
  );

  const svc = TestBed.inject(GenerationService);
  const flags = TestBed.inject(FeatureFlagsService);

  return {
    svc,
    flags,
    pipeline,
    esFactory,
    esCreateSpy,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('GenerationService — unified start() (Plan 1 Task 14)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('flag OFF → start() opens an EventSource and does NOT call pipeline.start', async () => {
    const h = setup();
    expect(h.flags.useClientPipeline()).toBe(false);

    const pipelineStartSpy = spyOn(h.pipeline, 'start').and.callThrough();

    await h.svc.start({ generationId: 'gen-123' });

    expect(h.esCreateSpy).toHaveBeenCalledTimes(1);
    expect(pipelineStartSpy).not.toHaveBeenCalled();
    expect(h.svc.generationId()).toBe('gen-123');
    expect(h.svc.status()).toBe('running');
    // Recovery key set by SSE path
    expect(sessionStorage.getItem('active_generation_id')).toBe('gen-123');
  });

  it('flag ON → start() calls pipeline.start and does NOT open an EventSource', async () => {
    const h = setup();
    h.flags.setUseClientPipeline(true);

    const pipelineStartSpy = spyOn(h.pipeline, 'start').and.callThrough();

    // Don't await — pipeline.start() never resolves until finishStart() is
    // called. We just need to observe the side-effect on the synchronous
    // path.
    void h.svc.start({ pipelineArgs: PIPELINE_ARGS });

    expect(pipelineStartSpy).toHaveBeenCalledTimes(1);
    expect(pipelineStartSpy.calls.first().args[0]).toBe(PIPELINE_ARGS);
    expect(h.esCreateSpy).not.toHaveBeenCalled();
    expect(h.svc.status()).toBe('running');

    // Resolve so the Promise machinery cleans up.
    h.pipeline.finishStart('gen-pipeline-1');
    await Promise.resolve();
  });

  it('flag ON → pipeline mod_added event is reflected in events() signal', async () => {
    const h = setup();
    h.flags.setUseClientPipeline(true);

    const startPromise = h.svc.start({ pipelineArgs: PIPELINE_ARGS });

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

  it('flag ON → pipeline `complete` flips status() and sets modlistId()', async () => {
    const h = setup();
    h.flags.setUseClientPipeline(true);

    const startPromise = h.svc.start({ pipelineArgs: PIPELINE_ARGS });

    h.pipeline.events$.next({
      type: 'complete',
      modlist_id: 'ml-test-001',
    });

    expect(h.svc.status()).toBe('complete');
    expect(h.svc.modlistId()).toBe('ml-test-001');

    h.pipeline.finishStart('gen-pipeline-3');
    await startPromise;
  });

  it('start() with flag OFF and missing generationId throws', async () => {
    const h = setup();
    await expectAsync(h.svc.start({})).toBeRejectedWithError(
      /generationId/,
    );
  });

  it('start() with flag ON and missing pipelineArgs throws', async () => {
    const h = setup();
    h.flags.setUseClientPipeline(true);
    await expectAsync(h.svc.start({})).toBeRejectedWithError(
      /pipelineArgs/,
    );
  });
});
