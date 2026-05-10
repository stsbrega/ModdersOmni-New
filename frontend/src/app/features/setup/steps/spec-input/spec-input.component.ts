import { Component, EventEmitter, Output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { HardwareSpecs, SpecsParseResponse, TierScores } from '../../../../shared/models/specs.model';
import { trigger, transition, style, animate } from '@angular/animations';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  ArrowLeft,
  ArrowRight,
} from 'lucide-angular';
import { UiButtonComponent } from '../../../../shared/components/ui/button.component';
import { UiCardComponent } from '../../../../shared/components/ui/card.component';
import { UiTextareaComponent } from '../../../../shared/components/ui/textarea.component';

@Component({
  selector: 'app-spec-input',
  standalone: true,
  imports: [
    FormsModule,
    LucideAngularModule,
    UiButtonComponent,
    UiCardComponent,
    UiTextareaComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ ArrowLeft, ArrowRight }),
    },
  ],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('350ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
  template: `
    <div class="spec-input">
      <h2>{{ usingSavedHardware() ? 'Verify Your Hardware' : 'Enter Your Hardware' }}</h2>
      <p class="step-desc">
        {{ usingSavedHardware()
          ? 'Confirm your hardware profile from Settings, or enter different specs.'
          : 'Paste your system info from NVIDIA App, HWiNFO, or Task Manager.' }}
      </p>

      @if (usingSavedHardware() && !showManualEntry()) {
        <!-- Saved hardware verify mode -->
        @if (savedLoading()) {
          <div class="loading-card">
            <span class="btn-spinner lg"></span>
            <span>Loading hardware profile...</span>
          </div>
        }

        @if (fullResponse()) {
          <ui-card class="results-card" @fadeIn>
            <div class="tier-row">
              <span class="tier-badge" [class]="'tier-' + (fullResponse()?.tier || 'unknown').toLowerCase()">
                {{ formatTier(fullResponse()?.tier) }} tier
              </span>
            </div>

            <div class="specs-grid">
              <div class="spec-item">
                <span class="spec-label">GPU</span>
                <span class="spec-val font-mono">{{ fullResponse()!.specs.gpu || 'Not set' }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">VRAM</span>
                <span class="spec-val font-mono">{{ formatVram(fullResponse()!.specs.vram_mb) }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">CPU</span>
                <span class="spec-val font-mono">{{ fullResponse()!.specs.cpu || 'Not set' }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">RAM</span>
                <span class="spec-val font-mono">{{ fullResponse()!.specs.ram_gb ? fullResponse()!.specs.ram_gb + ' GB' : 'Not set' }}</span>
              </div>
            </div>

            @if (fullResponse()?.tier_scores) {
              <div class="scores">
                <h4>Performance Breakdown</h4>
                <div class="score-list">
                  <div class="score-row">
                    <span class="score-name">VRAM</span>
                    <div class="score-track">
                      <div class="score-fill" [style.width.%]="(fullResponse()!.tier_scores!.vram || 0) * 20"></div>
                    </div>
                    <span class="score-val">{{ formatScore(fullResponse()!.tier_scores!.vram) }}</span>
                  </div>
                  <div class="score-row">
                    <span class="score-name">GPU Gen</span>
                    <div class="score-track">
                      <div class="score-fill" [style.width.%]="(fullResponse()!.tier_scores!.gpu_gen || 0) * 20"></div>
                    </div>
                    <span class="score-val">{{ formatScore(fullResponse()!.tier_scores!.gpu_gen) }}</span>
                  </div>
                  <div class="score-row">
                    <span class="score-name">CPU</span>
                    <div class="score-track">
                      <div class="score-fill" [style.width.%]="(fullResponse()!.tier_scores!.cpu || 0) * 20"></div>
                    </div>
                    <span class="score-val">{{ formatScore(fullResponse()!.tier_scores!.cpu) }}</span>
                  </div>
                  <div class="score-row">
                    <span class="score-name">RAM</span>
                    <div class="score-track">
                      <div class="score-fill" [style.width.%]="(fullResponse()!.tier_scores!.ram || 0) * 20"></div>
                    </div>
                    <span class="score-val">{{ formatScore(fullResponse()!.tier_scores!.ram) }}</span>
                  </div>
                </div>
              </div>
            }
          </ui-card>
        }

        <button class="btn-different" (click)="switchToManualEntry()">
          Enter different specs instead
        </button>
      } @else {
        <!-- Manual entry mode -->
        @if (usingSavedHardware()) {
          <button class="btn-back-to-saved" (click)="switchToSavedHardware()">
            <lucide-icon name="arrow-left" [size]="14" [strokeWidth]="2"></lucide-icon>
            Back to saved hardware
          </button>
        }

        <div class="textarea-wrap">
          <textarea
            ui-textarea
            [(ngModel)]="rawText"
            placeholder="Example:
GPU: NVIDIA GeForce RTX 4070 Ti
VRAM: 12 GB GDDR6X
CPU: AMD Ryzen 7 7800X3D
RAM: 32 GB DDR5"
            rows="7"
            class="font-mono spec-textarea-extra"
          ></textarea>
        </div>

        @if (fullResponse() && !usingSavedHardware()) {
          <ui-card class="results-card" @fadeIn>
            <div class="tier-row">
              <span class="tier-badge" [class]="'tier-' + (fullResponse()?.tier || 'unknown').toLowerCase()">
                {{ formatTier(fullResponse()?.tier) }} tier
              </span>
            </div>

            <div class="specs-grid">
              <div class="spec-item">
                <span class="spec-label">GPU</span>
                <span class="spec-val font-mono">{{ fullResponse()!.specs.gpu || 'Not detected' }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">VRAM</span>
                <span class="spec-val font-mono">{{ formatVram(fullResponse()!.specs.vram_mb) }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">CPU</span>
                <span class="spec-val font-mono">{{ fullResponse()!.specs.cpu || 'Not detected' }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">RAM</span>
                <span class="spec-val font-mono">{{ fullResponse()!.specs.ram_gb ? fullResponse()!.specs.ram_gb + ' GB' : 'Not detected' }}</span>
              </div>
            </div>

            @if (fullResponse()?.tier_scores) {
              <div class="scores">
                <h4>Performance Breakdown</h4>
                <div class="score-list">
                  <div class="score-row">
                    <span class="score-name">VRAM</span>
                    <div class="score-track">
                      <div class="score-fill" [style.width.%]="(fullResponse()!.tier_scores!.vram || 0) * 20"></div>
                    </div>
                    <span class="score-val">{{ formatScore(fullResponse()!.tier_scores!.vram) }}</span>
                  </div>
                  <div class="score-row">
                    <span class="score-name">GPU Gen</span>
                    <div class="score-track">
                      <div class="score-fill" [style.width.%]="(fullResponse()!.tier_scores!.gpu_gen || 0) * 20"></div>
                    </div>
                    <span class="score-val">{{ formatScore(fullResponse()!.tier_scores!.gpu_gen) }}</span>
                  </div>
                  <div class="score-row">
                    <span class="score-name">CPU</span>
                    <div class="score-track">
                      <div class="score-fill" [style.width.%]="(fullResponse()!.tier_scores!.cpu || 0) * 20"></div>
                    </div>
                    <span class="score-val">{{ formatScore(fullResponse()!.tier_scores!.cpu) }}</span>
                  </div>
                  <div class="score-row">
                    <span class="score-name">RAM</span>
                    <div class="score-track">
                      <div class="score-fill" [style.width.%]="(fullResponse()!.tier_scores!.ram || 0) * 20"></div>
                    </div>
                    <span class="score-val">{{ formatScore(fullResponse()!.tier_scores!.ram) }}</span>
                  </div>
                </div>
              </div>
            }
          </ui-card>
        }
      }

      <div class="actions">
        <button ui-button variant="ghost" size="sm" (click)="back.emit()">
          <lucide-icon name="arrow-left" [size]="14" [strokeWidth]="2"></lucide-icon>
          Back
        </button>
        @if (usingSavedHardware() && !showManualEntry() && fullResponse()) {
          <button ui-button variant="primary" (click)="confirm()">
            Looks Good, Continue
            <lucide-icon name="arrow-right" [size]="14" [strokeWidth]="2"></lucide-icon>
          </button>
        } @else if (!fullResponse() || showManualEntry()) {
          <button ui-button variant="primary" (click)="analyzeSpecs()" [disabled]="loading() || !rawText.trim()">
            @if (loading()) {
              <span class="btn-spinner"></span>
              Scanning...
            } @else {
              Scan Hardware
            }
          </button>
        } @else {
          <button ui-button variant="primary" (click)="confirm()">
            Continue
            <lucide-icon name="arrow-right" [size]="14" [strokeWidth]="2"></lucide-icon>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .spec-input {
      max-width: 560px;
      margin: 0 auto;
    }
    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
      text-align: center;
    }
    .step-desc {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      text-align: center;
      margin-bottom: 1.5rem;
    }
    /* Enter different specs link */
    .btn-different {
      display: block;
      background: none;
      border: none;
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0;
      margin: 1rem auto 0;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
      transition: color 0.15s;
    }
    .btn-different:hover { color: var(--color-text); }

    /* Back to saved hardware link */
    .btn-back-to-saved {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: none;
      border: none;
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 500;
      padding: 0;
      margin-bottom: 1rem;
      cursor: pointer;
      transition: color 0.15s;
    }
    .btn-back-to-saved:hover { color: var(--color-text); }

    /* Loading state */
    .loading-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2.5rem;
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
    .btn-spinner.lg {
      width: 24px;
      height: 24px;
    }

    .textarea-wrap {
      margin-bottom: 1.5rem;
    }
    /* spec-textarea-extra: extra rules layered on top of the ui-textarea
       primitive's host classes. Things like font-size/line-height that are
       visually distinctive for the hardware-paste textarea (denser layout). */
    .spec-textarea-extra {
      font-size: 0.8125rem;
      line-height: 1.7;
    }

    /* Results card — layout container for parsed spec output. The ui-card
       primitive supplies the surface (bg/border/radius/padding/shadow); we
       only add the bottom margin to space it from the next section. */
    .results-card {
      display: block;
      margin-bottom: 1.5rem;
    }
    .tier-row {
      display: flex;
      justify-content: center;
      margin-bottom: 1.5rem;
    }
    .tier-badge {
      padding: 0.5rem 1.5rem;
      border-radius: 100px;
      font-weight: 700;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
    }
    .tier-low {
      background: rgba(239, 68, 68, 0.12);
      color: var(--color-error);
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    .tier-mid {
      background: rgba(234, 179, 8, 0.12);
      color: var(--color-warning);
      border: 1px solid rgba(234, 179, 8, 0.25);
    }
    .tier-high {
      background: rgba(34, 197, 94, 0.12);
      color: var(--color-success);
      border: 1px solid rgba(34, 197, 94, 0.25);
    }
    .tier-ultra {
      background: rgba(168, 85, 247, 0.12);
      color: #a855f7;
      border: 1px solid rgba(168, 85, 247, 0.25);
    }
    .tier-unknown {
      background: rgba(255, 255, 255, 0.05);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }

    .specs-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .spec-item {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    .spec-label {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--color-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .spec-val {
      font-size: 0.875rem;
      font-weight: 500;
    }

    /* Scores */
    .scores {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 1rem;
    }
    .scores h4 {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--color-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.75rem;
    }
    .score-list {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }
    .score-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .score-name {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-muted);
      min-width: 52px;
    }
    .score-track {
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 2px;
      overflow: hidden;
    }
    .score-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--color-gold), var(--color-blue));
      border-radius: 2px;
      transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .score-val {
      font-size: 0.75rem;
      color: var(--color-text-dim);
      min-width: 28px;
      text-align: right;
    }

    /* Actions */
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .btn-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(13, 13, 15, 0.3);
      border-top-color: #0D0D0F;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class SpecInputComponent implements OnInit {
  @Output() specsParsed = new EventEmitter<HardwareSpecs>();
  @Output() back = new EventEmitter<void>();

  rawText = '';
  loading = signal(false);
  fullResponse = signal<SpecsParseResponse | null>(null);
  usingSavedHardware = signal(false);
  showManualEntry = signal(false);
  savedLoading = signal(false);

  constructor(
    private api: ApiService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const hw = this.authService.savedHardware;
    if (hw && (hw.gpu_model || hw.cpu_model)) {
      this.usingSavedHardware.set(true);
      // Build a text representation of saved hardware and send to backend
      // to get full tier + tier_scores response
      const lines: string[] = [];
      if (hw.gpu_model) lines.push(`GPU: ${hw.gpu_model}`);
      if (hw.vram_mb) lines.push(`VRAM: ${Math.round(hw.vram_mb / 1024)} GB`);
      if (hw.cpu_model) lines.push(`CPU: ${hw.cpu_model}`);
      if (hw.ram_gb) lines.push(`RAM: ${hw.ram_gb} GB`);
      const formattedText = lines.join('\n');
      this.rawText = formattedText;
      this.savedLoading.set(true);
      this.api.parseSpecs(formattedText).subscribe({
        next: (response) => {
          this.fullResponse.set(response);
          this.savedLoading.set(false);
        },
        error: () => {
          // Fallback: show saved data without tier scores
          this.fullResponse.set({
            specs: {
              gpu: hw.gpu_model || '',
              cpu: hw.cpu_model || '',
              ram_gb: hw.ram_gb || 0,
              vram_mb: hw.vram_mb || 0,
            },
            tier: hw.hardware_tier || 'unknown',
          } as SpecsParseResponse);
          this.savedLoading.set(false);
        },
      });
    }
  }

  switchToManualEntry(): void {
    this.showManualEntry.set(true);
    this.fullResponse.set(null);
    this.rawText = '';
  }

  switchToSavedHardware(): void {
    this.showManualEntry.set(false);
    // Re-trigger the saved hardware load
    this.ngOnInit();
  }

  formatVram(vramMb: number | undefined): string {
    if (!vramMb) return 'Not detected';
    const gb = vramMb / 1024;
    return Math.round(gb) + ' GB';
  }

  formatScore(score: number | undefined): string {
    if (score === undefined) return '0';
    return Math.round(score * 10) / 10 + '/5';
  }

  protected formatTier(t: string | null | undefined): string {
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }

  analyzeSpecs(): void {
    this.loading.set(true);
    this.api.parseSpecs(this.rawText).subscribe({
      next: (response) => {
        this.fullResponse.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  confirm(): void {
    const response = this.fullResponse();
    if (response && response.specs) {
      this.specsParsed.emit(response.specs);
    }
  }
}
