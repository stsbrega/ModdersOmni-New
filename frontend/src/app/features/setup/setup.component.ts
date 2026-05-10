import { Component, OnInit, signal } from '@angular/core';
import { GameSelectComponent } from './steps/game-select/game-select.component';
import { SpecInputComponent } from './steps/spec-input/spec-input.component';
import { PlaystyleSelectComponent } from './steps/playstyle-select/playstyle-select.component';
import { HardwareSpecs } from '../../shared/models/specs.model';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import { trigger, transition, style, animate } from '@angular/animations';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Check,
  ArrowLeft,
  ArrowRight,
  Tag,
} from 'lucide-angular';
// Import primitives directly to avoid pulling in sibling primitives that may
// have unrelated TS errors during type-checking (matches the pattern landing
// adopted in Task 5).
import { UiButtonComponent } from '../../shared/components/ui/button.component';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    GameSelectComponent,
    SpecInputComponent,
    PlaystyleSelectComponent,
    LucideAngularModule,
    UiButtonComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Check, ArrowLeft, ArrowRight, Tag }),
    },
  ],
  animations: [
    trigger('fadeUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('350ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
  template: `
    <div class="setup">
      <div class="setup-header" @fadeUp>
        <span class="setup-label">Setup Wizard</span>
        <h1>Build Your Modlist</h1>
      </div>

      <div class="stepper">
        @for (step of steps; track step.number; let i = $index) {
          <div class="step" [class.active]="currentStep() === step.number" [class.completed]="currentStep() > step.number">
            <div class="step-indicator">
              @if (currentStep() > step.number) {
                <lucide-icon name="check" [size]="14" [strokeWidth]="2.5"></lucide-icon>
              } @else {
                {{ step.number }}
              }
            </div>
            <span class="step-label">{{ step.label }}</span>
          </div>
          @if (i < steps.length - 1) {
            <div class="step-line" [class.active]="currentStep() > step.number"></div>
          }
        }
      </div>

      <div class="step-content">
        @switch (currentStep()) {
          @case (1) {
            <app-game-select (gameSelected)="onGameSelected($event)" />
          }
          @case (2) {
            <div class="version-select" @fadeUp>
              <h2>Select Version</h2>
              <p class="step-desc">Choose which edition you want to mod.</p>
              <div class="versions-grid">
                @for (version of selectedGameVersions(); track version) {
                  <button class="version-card" (click)="onVersionSelected(version)">
                    <div class="version-icon">
                      <lucide-icon name="tag" [size]="20" [strokeWidth]="1.5"></lucide-icon>
                    </div>
                    <div class="version-text">
                      <h3>{{ version }}</h3>
                      @if (versionSubtitle(version)) {
                        <small>{{ versionSubtitle(version) }}</small>
                      }
                    </div>
                    <lucide-icon class="version-arrow" name="arrow-right" [size]="16" [strokeWidth]="2"></lucide-icon>
                  </button>
                }
              </div>
              <button ui-button variant="ghost" size="sm" (click)="goBack()">
                <lucide-icon name="arrow-left" [size]="14" [strokeWidth]="2"></lucide-icon>
                Back
              </button>
            </div>
          }
          @case (3) {
            <app-spec-input (specsParsed)="onSpecsParsed($event)" (back)="goBack()" />
          }
          @case (4) {
            <app-playstyle-select
              [gameId]="selectedGameId()!"
              [specs]="parsedSpecs()!"
              [gameVersion]="selectedGameVersion()!"
              [initialPlaystyleId]="restoredPlaystyleId()"
              [initialDescription]="restoredDescription()"
              [initialRequestedMods]="restoredRequestedMods()"
              (back)="goBack()"
            />
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .setup {
      max-width: 760px;
      margin: 0 auto;
      padding: 2.5rem 2rem;
    }
    .setup-header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .setup-label {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-gold);
      margin-bottom: 0.625rem;
    }
    .setup-header h1 {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 500;
      letter-spacing: -0.01em;
    }

    /* Stepper */
    .stepper {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 3rem;
      gap: 0;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      opacity: 0.35;
      transition: opacity 0.25s;
    }
    .step.active, .step.completed { opacity: 1; }
    .step-indicator {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text-muted);
      transition: all 0.25s;
    }
    .step.active .step-indicator {
      background: var(--color-gold);
      border-color: var(--color-gold);
      color: #0D0D0F;
    }
    .step.completed .step-indicator {
      background: var(--color-success);
      border-color: var(--color-success);
      color: white;
    }
    .step-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-text-muted);
    }
    .step.active .step-label { color: var(--color-text); }
    .step-line {
      width: 36px;
      height: 1px;
      background: var(--color-border);
      margin: 0 0.5rem;
      transition: background 0.25s;
    }
    .step-line.active { background: var(--color-success); }

    /* Version Select */
    .version-select {
      text-align: center;
    }
    .version-select h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
    }
    .step-desc {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin-bottom: 2rem;
    }
    .versions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      max-width: 500px;
      margin: 0 auto 2rem;
    }
    .version-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      cursor: pointer;
      color: var(--color-text);
      font-family: inherit;
      transition: border-color 0.2s, transform 0.15s, background 0.15s;
    }
    .version-card:hover {
      border-color: var(--color-gold);
      transform: translateY(-1px);
      background: rgba(192, 160, 96, 0.04);
    }
    .version-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(192, 160, 96, 0.1);
      color: var(--color-gold);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .version-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .version-card h3 {
      font-size: 0.9375rem;
      font-weight: 600;
      margin: 0;
      text-align: left;
    }
    .version-card small {
      display: block;
      color: var(--color-text-muted);
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }
    .version-arrow {
      color: var(--color-text-dim);
      transition: color 0.15s, transform 0.15s;
    }
    .version-card:hover .version-arrow {
      color: var(--color-gold);
      transform: translateX(2px);
    }
  `],
})
export class SetupComponent implements OnInit {
  currentStep = signal(1);
  selectedGameId = signal<number | null>(null);
  selectedGameVersion = signal<string | null>(null);
  selectedGameVersions = signal<string[]>([]);
  parsedSpecs = signal<HardwareSpecs | null>(null);
  restoredPlaystyleId = signal<number | undefined>(undefined);
  restoredDescription = signal<string | undefined>(undefined);
  restoredRequestedMods = signal<string[] | undefined>(undefined);

  steps = [
    { number: 1, label: 'Game' },
    { number: 2, label: 'Version' },
    { number: 3, label: 'Hardware' },
    { number: 4, label: 'Customize' },
  ];

  constructor(
    private api: ApiService,
    private themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    // Try restoring from localStorage first (set during auth redirect)
    // then fall back to sessionStorage (set during normal wizard navigation)
    const raw = localStorage.getItem('setup_wizard_state')
      || sessionStorage.getItem('setup_wizard_progress');
    if (!raw) return;

    try {
      const state = JSON.parse(raw);

      // Ignore stale state (> 1 hour old)
      const ONE_HOUR = 60 * 60 * 1000;
      if (!state?.timestamp || Date.now() - state.timestamp > ONE_HOUR) {
        localStorage.removeItem('setup_wizard_state');
        sessionStorage.removeItem('setup_wizard_progress');
        return;
      }

      // Restore wizard state — go to the furthest completed step
      if (state.gameId) {
        this.selectedGameId.set(state.gameId);
        this.selectedGameVersion.set(state.gameVersion || null);
        if (state.gameVersions) {
          this.selectedGameVersions.set(state.gameVersions);
        }

        if (state.specs) {
          this.parsedSpecs.set(state.specs);
          this.restoredPlaystyleId.set(state.playstyleId);
          this.restoredDescription.set(state.customDescription);
          this.restoredRequestedMods.set(state.requestedMods);
          this.currentStep.set(4);
        } else if (state.gameVersion) {
          this.currentStep.set(3);
        } else if (state.gameVersions?.length) {
          this.currentStep.set(2);
        } else {
          this.currentStep.set(2);
        }
      }

      // Only clear localStorage (auth redirect state) — keep session state for refresh
      localStorage.removeItem('setup_wizard_state');
    } catch { /* ignore corrupt state */ }
  }

  /** Persist current wizard progress to sessionStorage so refresh doesn't lose it. */
  private saveProgress(): void {
    const state = {
      gameId: this.selectedGameId(),
      gameVersion: this.selectedGameVersion(),
      gameVersions: this.selectedGameVersions(),
      specs: this.parsedSpecs(),
      timestamp: Date.now(),
    };
    sessionStorage.setItem('setup_wizard_progress', JSON.stringify(state));
  }

  onGameSelected(gameId: number): void {
    this.selectedGameId.set(gameId);
    this.api.getGames().subscribe({
      next: (games) => {
        const game = games.find((g) => g.id === gameId);
        if (game && game.versions && game.versions.length > 0) {
          this.selectedGameVersions.set(game.versions);
          this.currentStep.set(2);
          this.themeService.setThemeFromSlug(game.slug);
        } else {
          this.currentStep.set(3);
        }
        this.saveProgress();
      },
      error: () => {
        this.currentStep.set(3);
        this.saveProgress();
      },
    });
  }

  onVersionSelected(version: string): void {
    this.selectedGameVersion.set(version);
    this.currentStep.set(3);
    this.saveProgress();
  }

  onSpecsParsed(specs: HardwareSpecs): void {
    this.parsedSpecs.set(specs);
    this.currentStep.set(4);
    this.saveProgress();
  }

  goBack(): void {
    this.currentStep.update((s) => Math.max(1, s - 1));
  }

  protected versionSubtitle(version: string): string {
    switch (version) {
      case 'SE':
        return 'Special Edition — the base game. Works with most mods.';
      case 'AE':
        return 'Anniversary Edition — includes Creation Club content and 1.6+ patches.';
      case 'Standard':
        return 'Original release — widely compatible with existing Fallout 4 mods.';
      case 'Next-Gen':
        return 'Next-gen update (2024) — newer mods may be required; some older mods may break.';
      default:
        return '';
    }
  }
}
