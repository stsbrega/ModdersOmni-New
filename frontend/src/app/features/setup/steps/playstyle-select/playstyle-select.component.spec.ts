/**
 * Focused tests for PlaystyleSelectComponent's `generate()` branch on
 * `FeatureFlagsService.useClientPipeline()`.
 *
 * The full component is large (~1500 LOC, lots of UI surface). We don't
 * try to exercise everything here — just the new flag-gated routing
 * added in the Plan 1 Task 14 follow-up:
 *
 *   - Flag ON + valid key → calls `GenerationService.start({pipelineArgs})`
 *     with the right Game record + LLMConfig + preset + spec data.
 *   - Flag ON + no whitelisted key → notifies + bails (no `start()`,
 *     no legacy backend POST).
 *   - Flag OFF → existing legacy SSE path runs (asserted via spy on
 *     `ApiService.startGeneration`); new `start()` not called.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, EMPTY } from 'rxjs';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { PlaystyleSelectComponent } from './playstyle-select.component';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { GenerationService } from '../../../../core/services/generation.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { FeatureFlagsService } from '../../../../core/services/feature-flags.service';
import { SettingsStore } from '../../../../core/services/settings-store.service';
import type { Game } from '../../../../shared/models/game.model';

const SKYRIM_GAME: Game = {
  id: 7,
  name: 'Skyrim Special Edition',
  slug: 'skyrimse',
  nexus_domain: 'skyrimspecialedition',
  versions: ['SE', 'AE'],
};

function makeApiStub(): jasmine.SpyObj<ApiService> {
  // After Plan 3 Task 2, LLM keys live in SettingsStore (localStorage), not
  // via ApiService.getLlmKeys/saveLlmKeys — those methods are no longer
  // referenced by the component, so the stub no longer includes them.
  const spy = jasmine.createSpyObj<ApiService>('ApiService', [
    'getPlaystyles',
    'getLlmProviders',
    'getGames',
    'startGeneration',
    'testOllamaConnection',
  ]);
  spy.getPlaystyles.and.returnValue(of([]));
  spy.getLlmProviders.and.returnValue(of([]));
  spy.getGames.and.returnValue(of([SKYRIM_GAME]));
  spy.startGeneration.and.returnValue(of({ generation_id: 'gen-legacy-1' }));
  spy.testOllamaConnection.and.returnValue(EMPTY);
  return spy;
}

function makeAuthStub(): jasmine.SpyObj<AuthService> {
  const spy = jasmine.createSpyObj<AuthService>('AuthService', [
    'isLoggedIn',
    'saveHardware',
  ]);
  spy.isLoggedIn.and.returnValue(true);
  spy.saveHardware.and.returnValue(EMPTY);
  return spy;
}

interface Harness {
  comp: PlaystyleSelectComponent;
  api: jasmine.SpyObj<ApiService>;
  generation: jasmine.SpyObj<GenerationService>;
  flags: FeatureFlagsService;
  notifications: jasmine.SpyObj<NotificationService>;
  router: Router;
}

function setup(opts: { flag: boolean; savedKeys?: Record<string, string> } = { flag: false }): Harness {
  // SettingsStore reads from localStorage in its constructor, so seed the
  // saved-keys fixture there before TestBed.inject builds the singleton.
  // Always clear first so prior tests don't leak state.
  localStorage.removeItem('settings.llmKeys');
  if (opts.savedKeys) {
    localStorage.setItem('settings.llmKeys', JSON.stringify(opts.savedKeys));
  }
  const api = makeApiStub();
  const auth = makeAuthStub();
  const generation = jasmine.createSpyObj<GenerationService>(
    'GenerationService',
    ['start', 'reset', 'connectToEvents', 'generationId'],
  );
  // start() returns a Promise; default to a never-resolving one so the
  // navigate() call in the .then doesn't fire unless the test awaits.
  generation.start.and.returnValue(new Promise(() => {}));
  generation.generationId.and.returnValue(null);

  const notifications = jasmine.createSpyObj<NotificationService>(
    'NotificationService',
    ['error', 'success', 'info'],
  );

  const flagsStub: Pick<FeatureFlagsService, 'useClientPipeline'> = {
    useClientPipeline: signal(opts.flag),
  };

  TestBed.configureTestingModule({
    imports: [PlaystyleSelectComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideNoopAnimations(),
      { provide: ApiService, useValue: api },
      { provide: AuthService, useValue: auth },
      { provide: GenerationService, useValue: generation },
      { provide: NotificationService, useValue: notifications },
      { provide: FeatureFlagsService, useValue: flagsStub },
    ],
  });

  const fixture = TestBed.createComponent(PlaystyleSelectComponent);
  const comp = fixture.componentInstance;
  comp.gameId = SKYRIM_GAME.id;
  comp.gameVersion = 'SE';
  comp.specs = {
    gpu: 'RTX 4080',
    vram_mb: 16384,
    cpu: 'i9-13900K',
    ram_gb: 64,
    cpu_cores: 24,
    cpu_speed_ghz: 5.8,
    storage_drives: 'C: 200 GB free',
  };
  // ngOnInit fires the API stubs synchronously thanks to `of(...)`.
  fixture.detectChanges();

  const router = TestBed.inject(Router);
  // No-op navigate so the spec doesn't try to resolve real routes.
  spyOn(router, 'navigate').and.resolveTo(true);

  return {
    comp,
    api,
    generation,
    flags: TestBed.inject(FeatureFlagsService),
    notifications,
    router,
  };
}

describe('PlaystyleSelectComponent — useClientPipeline flag branch', () => {
  it('flag ON + saved Gemini key → calls GenerationService.start with pipelineArgs', () => {
    const h = setup({ flag: true, savedKeys: { gemini: 'AIza-test-key' } });
    // Simulate a description so hasAnyPreference() is true
    h.comp.customDescription.set('Survival + immersion + 4K visuals');

    h.comp.generate();

    expect(h.generation.start).toHaveBeenCalledTimes(1);
    expect(h.api.startGeneration).not.toHaveBeenCalled();

    const args = h.generation.start.calls.first().args[0];
    expect(args.pipelineArgs).toBeTruthy();
    const p = args.pipelineArgs!;
    expect(p.game).toEqual(SKYRIM_GAME);
    expect(p.preset).toBe('medium');
    expect(p.gameVersion).toBe('SE');
    expect(p.hardwareSpec).toEqual(h.comp.specs);
    expect(p.llmConfig.provider).toBe('gemini');
    expect(p.llmConfig.model).toBeTruthy();
    expect(p.llmConfig.apiKey).toBe('AIza-test-key');
    expect(p.customDescription).toBe('Survival + immersion + 4K visuals');
  });

  it('flag ON + no whitelisted key → notifies + does NOT call start or legacy POST', () => {
    // gemini_pro is a backend-only provider, NOT in the client-pipeline
    // whitelist (which is anthropic/openai/gemini/groq/openrouter/ollama).
    const h = setup({ flag: true, savedKeys: { gemini_pro: 'AIza-pro-key' } });
    h.comp.customDescription.set('whatever');

    h.comp.generate();

    expect(h.generation.start).not.toHaveBeenCalled();
    expect(h.api.startGeneration).not.toHaveBeenCalled();
    expect(h.notifications.error).toHaveBeenCalled();
  });

  it('flag OFF → legacy backend POST runs, GenerationService.start NOT called', () => {
    const h = setup({ flag: false, savedKeys: { gemini: 'AIza-test-key' } });
    h.comp.customDescription.set('whatever');

    h.comp.generate();

    expect(h.generation.start).not.toHaveBeenCalled();
    expect(h.api.startGeneration).toHaveBeenCalledTimes(1);
  });
});
