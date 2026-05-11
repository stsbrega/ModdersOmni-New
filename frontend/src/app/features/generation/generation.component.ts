import {
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GenerationService } from '../../core/services/generation.service';
import { LLM_PROVIDERS } from '../../core/services/llm/providers-meta';
import { NotificationService } from '../../core/services/notification.service';
import { SettingsStore } from '../../core/services/settings-store.service';
import { LlmProvider } from '../../shared/models/mod.model';
import { ProvidersReadyEvent } from '../../shared/models/generation.model';
import { detectProvider } from '../../core/utils/key-detection';
import { UiButtonComponent } from '../../shared/components/ui/button.component';
import { UiInputComponent } from '../../shared/components/ui/input.component';
import { fadeUp } from '../../core/motion/animations';
import {
  GenerationHeaderComponent,
  GenerationLogComponent,
  GenerationModlistComponent,
  GenerationControlsComponent,
  type GenerationStatus,
} from './components';

@Component({
  selector: 'app-generation',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    UiButtonComponent,
    UiInputComponent,
    GenerationHeaderComponent,
    GenerationLogComponent,
    GenerationModlistComponent,
    GenerationControlsComponent,
  ],
  animations: [fadeUp],
  template: `
    <div class="generation-page">

      <!-- ── Generation Not Found ── -->
      @if (generationNotFound()) {
        <div class="not-found-banner" @fadeUp>
          <h2>Generation Not Found</h2>
          <p>This generation may have expired or doesn't exist. Start a new one from the setup wizard.</p>
          <a ui-button variant="primary" size="md" routerLink="/setup">Start New Modlist</a>
        </div>
      } @else {

        <app-generation-header
          [game]="gameSlug()"
          [provider]="providerLabel()"
          [currentPhase]="currentPhaseNumber()"
          [totalPhases]="totalPhasesCount()"
        ></app-generation-header>

        <main class="gen-grid">
          <section class="gen-grid__log">
            <app-generation-log [events]="gen.events()"></app-generation-log>
          </section>
          <aside class="gen-grid__modlist">
            <app-generation-modlist [mods]="gen.modsAdded()"></app-generation-modlist>
          </aside>
        </main>

        <footer class="gen-controls-bar">
          <app-generation-controls
            [status]="statusValue()"
            (paused)="onPause()"
            (resumed)="onResume()"
            (cancelled)="onCancel()"
            (downloadLog)="downloadLog()"
          ></app-generation-controls>
        </footer>

        <!-- ── Paused-state provider swap form (preserved verbatim from v2) ── -->
        @if (gen.status() === 'paused' && gen.pauseInfo()) {
          <div class="gen-pause-form">
            <div class="banner banner-paused" @fadeUp>
              <div class="banner-text">
                <strong>Generation paused</strong>
                @if (gen.pauseInfo()?.provider_errors?.length) {
                  <ul class="banner-error-list">
                    @for (err of gen.pauseInfo()!.provider_errors!; track err.provider) {
                      <li class="banner-error-item" [attr.data-type]="err.type">
                        <span class="banner-err-icon">{{ getErrorIcon(err.type) }}</span>
                        <span class="banner-err-provider">{{ err.provider }}</span>
                        <span class="banner-err-detail">{{ getErrorLabel(err.type) }}</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p>{{ gen.pauseInfo()?.reason }}</p>
                }
                <p class="mods-saved">{{ gen.modsAdded().length }} mods saved from completed phases.</p>
              </div>

              <!-- No providers at all — show inline key form to avoid navigating away -->
              @if (isNoProviders()) {
                <div class="inline-key-form">
                  <label>Paste an API key to start generating:</label>
                  <form class="key-input-row" (ngSubmit)="updateKeyAndResume()">
                    <input
                      ui-input
                      type="password"
                      class="font-mono key-field"
                      [(ngModel)]="apiKeyInput"
                      name="apiKey"
                      autocomplete="new-password"
                      placeholder="sk-... or gsk_..."
                    >
                    <button
                      ui-button
                      variant="primary"
                      size="sm"
                      type="submit"
                      [disabled]="resuming() || !apiKeyInput"
                    >
                      @if (resuming()) {
                        <span class="btn-spinner"></span>
                      }
                      Save &amp; Start
                    </button>
                  </form>
                  <p style="margin:0.5rem 0 0;font-size:0.75rem;color:var(--color-text-muted)">
                    Key is auto-detected and saved to your account.
                    <a routerLink="/settings" style="color:var(--color-accent)">Manage keys in Settings</a>
                  </p>
                </div>
              } @else if (isAuthError()) {
                <!-- Inline API key form for auth errors -->
                <div class="inline-key-form">
                  <label>Enter your API key to continue:</label>
                  <form class="key-input-row" (ngSubmit)="updateKeyAndResume()">
                    <input
                      ui-input
                      type="password"
                      class="font-mono key-field"
                      [(ngModel)]="apiKeyInput"
                      name="apiKey"
                      autocomplete="new-password"
                      placeholder="sk-..."
                    >
                    <button
                      ui-button
                      variant="primary"
                      size="sm"
                      type="submit"
                      [disabled]="resuming() || !apiKeyInput"
                    >
                      @if (resuming()) {
                        <span class="btn-spinner"></span>
                      }
                      Update &amp; Resume
                    </button>
                  </form>
                </div>
              } @else {
                <button
                  ui-button
                  variant="primary"
                  size="sm"
                  [disabled]="resuming()"
                  (click)="resume()"
                >
                  @if (resuming()) {
                    <span class="btn-spinner"></span>
                  }
                  Resume
                </button>
              }
              <a class="link-muted" routerLink="/setup">Start over</a>
            </div>
          </div>
        }

      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .generation-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--color-bg);
      color: var(--color-text);
    }

    /* ── Not Found ── */
    .not-found-banner {
      text-align: center;
      padding: 6rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .not-found-banner h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--color-text);
      margin: 0;
    }
    .not-found-banner p {
      color: var(--color-text-muted);
      max-width: 480px;
      margin: 0;
    }

    /* ── Main grid ── */
    .gen-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 1px;
      background: var(--color-border);
      min-height: 0;
    }
    .gen-grid__log,
    .gen-grid__modlist {
      background: var(--color-bg);
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      min-height: 0;
    }
    .gen-grid__modlist {
      background: var(--color-surface-1);
    }

    /* ── Controls bar ── */
    .gen-controls-bar {
      border-top: 1px solid var(--color-border);
      padding: 0.75rem 1.5rem;
      background: var(--color-bg);
      position: sticky;
      bottom: 0;
    }

    /* ── Paused banner / form ── */
    .gen-pause-form {
      padding: 1.5rem;
      border-top: 1px solid var(--color-border);
      background: var(--color-surface-1);
    }
    .banner {
      padding: 1rem;
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      border: 1px solid;
    }
    .banner-text strong {
      display: block;
      font-size: 0.875rem;
      margin-bottom: 0.15rem;
    }
    .banner-text p {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      margin: 0;
    }
    .mods-saved {
      font-size: 0.75rem !important;
      color: var(--color-text-dim) !important;
      margin-top: 0.25rem !important;
    }
    .banner-paused {
      background: rgba(245, 158, 11, 0.06);
      border-color: rgba(245, 158, 11, 0.2);
    }
    .banner-error-list {
      list-style: none;
      padding: 0;
      margin: 0.375rem 0 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .banner-error-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    .banner-err-icon {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.625rem;
      font-weight: 700;
      flex-shrink: 0;
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }
    .banner-error-item[data-type="rate_limit"] .banner-err-icon,
    .banner-error-item[data-type="timeout"] .banner-err-icon {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }
    .banner-err-provider {
      font-weight: 600;
      color: var(--color-text);
      font-family: monospace;
      font-size: 0.6875rem;
    }
    .banner-err-detail {
      color: var(--color-text-dim);
    }

    /* Inline key form */
    .inline-key-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .inline-key-form label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    .key-input-row {
      display: flex;
      gap: 0.5rem;
    }
    .key-field {
      flex: 1;
      font-size: 0.8125rem;
      height: 2rem;
      padding-top: 0.4rem;
      padding-bottom: 0.4rem;
    }
    .link-muted {
      font-size: 0.75rem;
      color: var(--color-text-dim);
      text-decoration: none;
      transition: color 0.15s;
      text-align: center;
    }
    .link-muted:hover { color: var(--color-text-muted); }

    /* Inline spinner inside buttons while resuming */
    .btn-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(13, 13, 15, 0.3);
      border-top-color: #0d0d0f;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Mobile ── */
    @media (max-width: 900px) {
      .gen-grid { grid-template-columns: 1fr; }
      .gen-grid__modlist { order: -1; max-height: 240px; }
    }
  `],
})
export class GenerationComponent implements OnInit {
  protected readonly gen = inject(GenerationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly settingsStore = inject(SettingsStore);

  // ── Local state ──
  apiKeyInput = '';
  resuming = signal(false);
  private readonly providers = signal<LlmProvider[]>([]);

  // ── Computed signals ──

  protected readonly statusValue = computed<GenerationStatus>(() => {
    const s = this.gen.status();
    if (s === 'running' || s === 'paused' || s === 'complete' || s === 'error' || s === 'idle') {
      return s;
    }
    return 'idle';
  });

  protected readonly currentPhaseNumber = computed(() =>
    this.gen.currentPhase()?.number ?? 0
  );

  protected readonly totalPhasesCount = computed(() =>
    this.gen.totalPhases() > 0 ? this.gen.totalPhases() : 13
  );

  /**
   * Derive game slug from the first phase_start event's payload (or fall back
   * to the providers_ready event). GenerationService has no standalone game
   * signal — the game is embedded in pipeline phase data.
   */
  protected readonly gameSlug = computed(() => {
    const events = this.gen.events();
    for (const evt of events) {
      if (evt.type === 'phase_start' && (evt as any).game) {
        return (evt as any).game as string;
      }
    }
    // Fallback: derive from providers_ready free_tier hint or default to skyrim.
    return 'skyrim';
  });

  /**
   * Active provider label derived from the most recent phase_start event's
   * provider field, or from the providers_ready event's first provider name.
   */
  protected readonly providerLabel = computed(() => {
    const events = this.gen.events();
    // Walk backwards to find the most recent phase_start with a provider.
    for (let i = events.length - 1; i >= 0; i--) {
      const evt = events[i];
      if (evt.type === 'phase_start' && (evt as any).provider) {
        return (evt as any).provider as string;
      }
    }
    // Fall back to the first provider in providers_ready.
    const ready = events.find(e => e.type === 'providers_ready') as ProvidersReadyEvent | undefined;
    return ready?.providers?.[0]?.name ?? '—';
  });

  protected readonly isAuthError = computed(() => {
    const info = this.gen.pauseInfo();
    if (!info) return false;
    if (info.provider_errors?.length) {
      return info.provider_errors.some(e => e.type === 'auth_error');
    }
    const reason = (info.reason || '').toLowerCase();
    return (
      reason.includes('api key') ||
      reason.includes('auth') ||
      reason.includes('401') ||
      reason.includes('invalid key')
    );
  });

  // True when no LLM providers were available at all (free-tier / no BYOK keys).
  // Paused immediately on phase 1 with 0 mods.
  protected readonly isNoProviders = computed(() => {
    const events = this.gen.events();
    const ready = events.find(e => e.type === 'providers_ready') as
      | { count?: number; free_tier?: boolean }
      | undefined;
    return ready?.count === 0 && ready?.free_tier === true && this.gen.modsAdded().length === 0;
  });

  // ── Not-found: set imperatively in ngOnInit (signal, not computed) ──
  generationNotFound = signal(false);

  constructor() {
    // Redirect to the modlist view as soon as generation completes and a
    // modlist id is available — works for completions that happen while this
    // component is mounted (not just on initial load).
    effect(() => {
      if (this.gen.status() === 'complete' && this.gen.modlistId()) {
        this.router.navigate(['/modlist', this.gen.modlistId()], { replaceUrl: true });
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.generationNotFound.set(true);
      return;
    }

    if (this.gen.generationId() === id) {
      // Already running / paused / complete in this tab — UI binds to
      // gen.events() / gen.status() directly; the effect() handles the redirect
      // if already complete.
    } else {
      // No matching active session in memory — nothing to show.
      this.generationNotFound.set(true);
    }

    // Static LLM provider metadata for the inline pause-form key entry.
    this.providers.set(LLM_PROVIDERS);
  }

  // ── Control handlers ──

  protected onPause(): void {
    // Pipeline pause is not yet wired in v2.0. Surface a notification so the
    // button doesn't silently no-op.
    this.notifications.info('Pause is not yet supported for in-browser generation.');
  }

  protected onResume(): void {
    this.resume();
  }

  protected onCancel(): void {
    this.gen.reset();
    this.router.navigate(['/setup']);
  }

  // ── Pause-form helpers (verbatim from v2) ──

  getErrorIcon(errorType: string): string {
    switch (errorType) {
      case 'auth_error':  return '×';  // ×
      case 'rate_limit':  return '⧗';  // ⧗
      case 'token_limit': return '$';  // $
      case 'timeout':     return '◷';  // ◷
      case 'connection':  return '⊘';  // ⊘
      default:            return '!';  // !
    }
  }

  getErrorLabel(errorType: string): string {
    switch (errorType) {
      case 'auth_error':  return 'Invalid API key';
      case 'rate_limit':  return 'Rate limited';
      case 'token_limit': return 'Quota exceeded';
      case 'timeout':     return 'Request timed out';
      case 'connection':  return 'Connection failed';
      default:            return 'Error';
    }
  }

  resume(): void {
    // Resume from a paused state is not yet wired in v2.0 — the pipeline
    // doesn't expose a resume entry point. Clear the resuming spinner and
    // surface a notice.
    const id = this.gen.generationId();
    if (!id) return;
    this.resuming.set(false);
    this.notifications.info('Resume from a paused state is not yet wired in v2.0.');
  }

  updateKeyAndResume(): void {
    if (!this.apiKeyInput) return;
    this.resuming.set(true);

    // Auto-detect provider from key prefix pattern.
    const detection = detectProvider(this.apiKeyInput.trim(), this.providers());
    const providerKey = detection?.providerId ?? 'unknown';

    // Persist to localStorage via SettingsStore — sync, no error path.
    this.settingsStore.setLlmKey(providerKey, this.apiKeyInput);
    this.apiKeyInput = '';
    this.resume();
  }

  // ── Log download (verbatim from v2) ──

  downloadLog(): void {
    const genId = this.gen.generationId();
    if (!genId) return;
    const data = {
      generation_id: genId,
      status: this.gen.status(),
      modlist_id: this.gen.modlistId(),
      events: this.gen.events(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generation-${genId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
