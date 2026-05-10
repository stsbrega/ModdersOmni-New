import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertCircle,
  Search,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-angular';
// Direct primitive imports — same pattern Tasks 5-10 adopted to avoid pulling
// in sibling primitives whose TS errors might surface via the barrel.
import { UiButtonComponent } from '../../shared/components/ui/button.component';
import { UiCardComponent } from '../../shared/components/ui/card.component';
import { UiInputComponent } from '../../shared/components/ui/input.component';
import { UiBadgeComponent } from '../../shared/components/ui/badge.component';
import {
  UiSelectComponent,
  type UiSelectOption,
} from '../../shared/components/ui/select.component';

type Severity = 'warning' | 'critical';
type Confidence = 'high' | 'medium' | 'low';

interface CompatibilityIssue {
  description: string;
  severity: Severity | string;
  source?: string;
}

interface CompatibilityResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
  suggested_patches: string[];
  confidence: Confidence | string;
}

@Component({
  selector: 'app-compatibility',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    LucideAngularModule,
    UiButtonComponent,
    UiCardComponent,
    UiInputComponent,
    UiBadgeComponent,
    UiSelectComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertCircle,
        Search,
        ShieldCheck,
        Wrench,
        XCircle,
      }),
    },
  ],
  template: `
    <div class="compatibility-page">
      <div class="page-header">
        <h1>Mod Compatibility Checker</h1>
        <p>Check if two mods are compatible before installing them together</p>
      </div>

      <!-- ui-card surface for the input form (replaces .checker-card) -->
      <ui-card class="checker-card">
        <div class="input-group">
          <label for="modA">Mod A</label>
          <input
            ui-input
            id="modA"
            type="text"
            placeholder="Enter first mod name..."
            [ngModel]="modAName()"
            (ngModelChange)="modAName.set($event)"
          />
        </div>

        <div class="versus-divider">
          <span>vs</span>
        </div>

        <div class="input-group">
          <label for="modB">Mod B</label>
          <input
            ui-input
            id="modB"
            type="text"
            placeholder="Enter second mod name..."
            [ngModel]="modBName()"
            (ngModelChange)="modBName.set($event)"
          />
        </div>

        <div class="input-group">
          <label>Game</label>
          <ui-select
            placeholder="Select game..."
            [options]="gameOptions"
            [value]="gameSlug()"
            (selectionChange)="gameSlug.set($any($event))"
          ></ui-select>
        </div>

        <button
          ui-button
          variant="primary"
          size="md"
          class="self-start"
          [disabled]="loading()"
          (click)="checkCompatibility()"
        >
          @if (loading()) {
            <span class="spinner"></span>
            Checking...
          } @else {
            <lucide-icon name="search" [size]="16" [strokeWidth]="2"></lucide-icon>
            Check Compatibility
          }
        </button>
      </ui-card>

      <!-- Error state — signal-carrying danger surface, kept inline (custom shape with
           icon + flex layout); content uses lucide. -->
      @if (error()) {
        <div class="error-card">
          <lucide-icon name="x-circle" [size]="20" [strokeWidth]="2"></lucide-icon>
          <span>{{ error() }}</span>
        </div>
      }

      @if (result(); as r) {
        <ui-card class="results-card">
          <div class="results-header">
            <h2>Results</h2>
            <button
              ui-button
              variant="ghost"
              size="sm"
              (click)="clearResults()"
            >
              Clear
            </button>
          </div>

          <!-- Top-level summary badges. Compatible = success/danger (semantic).
               Confidence: high=success, medium=warning, low=default. -->
          <div class="badges-row">
            <ui-badge [variant]="r.compatible ? 'success' : 'danger'">
              {{ r.compatible ? 'Compatible' : 'Incompatible' }}
            </ui-badge>
            <ui-badge [variant]="confidenceVariant(r.confidence)">
              {{ r.confidence | titlecase }} Confidence
            </ui-badge>
          </div>

          @if (r.issues && r.issues.length > 0) {
            <div class="issues-section">
              <h3>Issues Found</h3>
              <!-- Per-issue ui-card so each rule renders as its own surface,
                   per Task 11 spec ("results displayed as a list of <ui-card>"). -->
              <div class="issues-list">
                @for (issue of r.issues; track issue.description) {
                  <ui-card class="issue-card">
                    <div class="issue-row">
                      <ui-badge [variant]="severityVariant(issue.severity)">
                        {{ issue.severity | titlecase }}
                      </ui-badge>
                      <div class="issue-details">
                        <span class="issue-description">{{ issue.description }}</span>
                        @if (issue.source) {
                          <!-- Source string is often a mod ID / slug — render in font-mono. -->
                          <span class="issue-source">
                            Source: <code class="font-mono">{{ issue.source }}</code>
                          </span>
                        }
                      </div>
                    </div>
                  </ui-card>
                }
              </div>
            </div>
          }

          @if (r.suggested_patches && r.suggested_patches.length > 0) {
            <div class="patches-section">
              <h3>Suggested Patches</h3>
              <ul class="patches-list">
                @for (patch of r.suggested_patches; track patch) {
                  <li class="patch-item">
                    <lucide-icon name="wrench" [size]="16" [strokeWidth]="2"></lucide-icon>
                    <span>{{ patch }}</span>
                  </li>
                }
              </ul>
            </div>
          }

          @if (r.issues.length === 0 && r.compatible) {
            <!-- "All clear" banner — signal-carrying success surface; custom
                 shape (icon + tinted bg) so it stays inline rather than ui-card. -->
            <div class="all-clear">
              <lucide-icon name="shield-check" [size]="24" [strokeWidth]="2"></lucide-icon>
              <span>No issues detected. These mods should work well together.</span>
            </div>
          }
        </ui-card>
      }

      @if (!result() && !error() && !loading()) {
        <div class="empty-state">
          <lucide-icon name="search" [size]="48" [strokeWidth]="1.5"></lucide-icon>
          <p>Enter two mod names above and click "Check Compatibility" to see if they work together.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .compatibility-page {
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .page-header {
      margin-bottom: 2rem;

      h1 {
        font-family: 'Playfair Display', serif;
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 0.5rem;
      }

      p {
        color: var(--text-secondary);
        font-size: 1rem;
        margin: 0;
      }
    }

    /* Layout overrides on top of <ui-card> (which gives us the surface) */
    .checker-card {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      label {
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
      }
    }

    .versus-divider {
      display: flex;
      align-items: center;
      justify-content: center;

      span {
        color: var(--text-secondary);
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        opacity: 0.6;
      }
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Error banner — signal-carrying danger surface; intentionally inline. */
    .error-card {
      margin-top: 1.5rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #ef4444;
      font-size: 0.95rem;
    }

    .results-card {
      margin-top: 1.5rem;
    }

    .results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;

      h2 {
        font-family: 'Playfair Display', serif;
        font-size: 1.35rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
    }

    .badges-row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }

    .issues-section, .patches-section {
      margin-bottom: 1.5rem;

      h3 {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 0.75rem;
      }
    }

    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    /* Reduce per-issue ui-card padding from default p-6 down to feel "row-like" */
    .issue-card {
      padding: 0.75rem 1rem;
    }

    .issue-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .issue-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .issue-description {
      color: var(--text-primary);
      font-size: 0.9rem;
    }

    .issue-source {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    .patches-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .patch-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 0.85rem;
      background: rgba(var(--accent-rgb, 99, 102, 241), 0.06);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 0.9rem;

      lucide-icon {
        flex-shrink: 0;
        color: var(--accent);
      }
    }

    /* All-clear banner — signal-carrying success surface; intentionally inline. */
    .all-clear {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 10px;
      color: #22c55e;
      font-size: 0.95rem;
    }

    .empty-state {
      margin-top: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 3rem 1rem;
      color: var(--text-secondary);
      opacity: 0.5;
      text-align: center;

      p {
        max-width: 400px;
        font-size: 0.95rem;
        line-height: 1.5;
        margin: 0;
      }
    }

    @media (max-width: 640px) {
      .compatibility-page {
        padding: 1.5rem 0.75rem;
      }

      .page-header h1 {
        font-size: 1.5rem;
      }
    }
  `],
})
export class CompatibilityComponent {
  private api = inject(ApiService);

  modAName = signal('');
  modBName = signal('');
  gameSlug = signal<string>('skyrimspecialedition');
  loading = signal(false);
  result = signal<CompatibilityResult | null>(null);
  error = signal('');

  // ui-select takes a typed { value, label }[] (option-array driven), unlike
  // a native <select> with template-projected <option>s. Same pattern used
  // in playstyle-select.
  readonly gameOptions: UiSelectOption[] = [
    { value: 'skyrimspecialedition', label: 'Skyrim Special Edition' },
    { value: 'fallout4', label: 'Fallout 4' },
  ];

  /** Map issue severity → ui-badge variant (warning|danger). */
  severityVariant(severity: string): 'warning' | 'danger' | 'default' {
    if (severity === 'critical') return 'danger';
    if (severity === 'warning') return 'warning';
    return 'default';
  }

  /** Map confidence level → ui-badge variant. */
  confidenceVariant(confidence: string): 'success' | 'warning' | 'default' {
    if (confidence === 'high') return 'success';
    if (confidence === 'medium') return 'warning';
    return 'default';
  }

  checkCompatibility(): void {
    const modA = this.modAName().trim();
    const modB = this.modBName().trim();

    if (!modA || !modB) {
      this.error.set('Please enter both mod names.');
      return;
    }

    this.error.set('');
    this.result.set(null);
    this.loading.set(true);

    this.api.checkCompatibility(modA, modB, this.gameSlug()).subscribe({
      next: (res) => {
        this.result.set(res as CompatibilityResult);
        this.loading.set(false);
      },
      error: (err) => {
        const message =
          err?.error?.detail ||
          err?.error?.message ||
          'Failed to check compatibility. Please try again.';
        this.error.set(message);
        this.loading.set(false);
      },
    });
  }

  clearResults(): void {
    this.result.set(null);
    this.error.set('');
  }
}
