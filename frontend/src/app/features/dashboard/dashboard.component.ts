import { Component, OnDestroy, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { fadeUp, staggerChildren } from '../../core/motion/animations';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { GenerationService } from '../../core/services/generation.service';
import { Modlist } from '../../shared/models/mod.model';
import { GenerationStatusResponse } from '../../shared/models/generation.model';
import { InProgressBadgeComponent } from '../../shared/components/in-progress-badge/in-progress-badge.component';
import { DatePipe } from '@angular/common';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  ArrowRight,
  Box,
  Folder,
  Plus,
  Tag,
  Trash2,
} from 'lucide-angular';
// Direct primitive imports — same pattern Tasks 5-9 adopted to avoid pulling
// in sibling primitives whose TS errors might surface via the barrel.
import { UiButtonComponent } from '../../shared/components/ui/button.component';
import { UiCardComponent } from '../../shared/components/ui/card.component';
import { UiBadgeComponent } from '../../shared/components/ui/badge.component';
import { UiDialogComponent } from '../../shared/components/ui/dialog.component';
import { DialogRef } from '@angular/cdk/dialog';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    InProgressBadgeComponent,
    LucideAngularModule,
    UiButtonComponent,
    UiCardComponent,
    UiBadgeComponent,
  ],
  // Provide UiDialogComponent as a service-like dependency. The wrapper does
  // `inject(Dialog)` in its own constructor, so we never need to render it
  // into the template; we just call `uiDialog.open(templateRef)` from code.
  // This matches the usage example in dialog.component.ts's docstring.
  providers: [
    UiDialogComponent,
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ArrowRight,
        Box,
        Folder,
        Plus,
        Tag,
        Trash2,
      }),
    },
  ],
  // Centralized triggers from core/motion/animations.ts. Replaces the
  // dashboard's prior inline fadeUp + staggerCards definitions — Plan 2 Task 14.
  animations: [fadeUp, staggerChildren],
  template: `
    <div class="dashboard-layout">
      <!-- Main Content -->
      <main class="dashboard-main">
        <!-- Welcome -->
        <div class="welcome" @fadeUp>
          <div>
            <h1 class="welcome-title">Welcome to ModdersOmni</h1>
            <p class="welcome-sub">Your generated modlists</p>
          </div>
          <a ui-button variant="primary" size="sm" routerLink="/setup" (click)="resetSetupWizard()">
            <lucide-icon name="plus" [size]="16" [strokeWidth]="2"></lucide-icon>
            New Build
          </a>
        </div>

        <!-- Resume banner — custom shape (pulse + body + auto-margin label + arrow); resists ui-button. -->
        @if (activeGenerationId()) {
          <a [routerLink]="['/generate', activeGenerationId()]" class="resume-banner">
            <span class="resume-pulse"></span>
            <span>A modlist generation is in progress.</span>
            @if (activeStatus(); as s) {
              <app-in-progress-badge
                [status]="badgeStatus(s.status)"
                [phaseIndex]="s.phase_index ?? 0"
                [totalPhases]="s.total_phases ?? 0"
                [elapsed]="formatElapsed(s.elapsed_seconds ?? 0)"
              />
            }
            <strong>Continue watching</strong>
            <lucide-icon name="arrow-right" [size]="14" [strokeWidth]="2"></lucide-icon>
          </a>
        }

        @if (loading()) {
          <div class="loading-state">
            <span class="load-spinner"></span>
            <p>Loading your modlists...</p>
          </div>
        } @else if (modlists().length === 0) {
          <div class="empty-state" @fadeUp>
            <div class="empty-icon">
              <lucide-icon name="box" [size]="32" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h2>No modlists yet</h2>
            <p>Generate your first AI-powered modlist by clicking New Build above.</p>
            <a ui-button variant="primary" size="md" routerLink="/setup" (click)="resetSetupWizard()">
              <lucide-icon name="plus" [size]="16" [strokeWidth]="2"></lucide-icon>
              New Build
            </a>
          </div>
        } @else {
          <!-- Stats — ui-card surfaces, font-mono on numeric stat values (data) -->
          <div class="stats-row" @staggerChildren>
            <ui-card class="stat-card">
              <div class="stat-icon stat-icon--gold">
                <lucide-icon name="folder" [size]="20" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <div class="stat-value font-mono">{{ modlists().length }}</div>
              <div class="stat-label">Modlists Generated</div>
            </ui-card>
            <ui-card class="stat-card">
              <div class="stat-icon stat-icon--blue">
                <lucide-icon name="tag" [size]="20" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <div class="stat-value font-mono">{{ totalMods() }}</div>
              <div class="stat-label">Total Mods</div>
            </ui-card>
          </div>

          <!-- Modlist preview cards — each card is a routerLink anchor, so we can't
               use <ui-card> as the wrapper element (ui-card is a non-anchor block).
               Inline anchor styling preserves clickability + hover micro-motion. -->
          <div class="modlist-grid" @staggerChildren>
            @for (ml of modlists(); track ml.id) {
              <a [routerLink]="['/modlist', ml.id]" class="modlist-card">
                <div class="card-top">
                  <div class="card-meta">
                    <!-- Brand chips (game/provider) stay inline — not semantic status. -->
                    <span class="card-game">Game {{ ml.game_id }}</span>
                    @if (ml.llm_provider && ml.llm_provider !== 'fallback') {
                      <span class="card-provider">{{ ml.llm_provider }}</span>
                    }
                    <!-- "Fallback" IS semantic warning state → ui-badge -->
                    @if (ml.used_fallback) {
                      <ui-badge variant="warning">Fallback</ui-badge>
                    }
                  </div>
                  <div class="card-actions">
                    <!-- Inline trash button — 28×28 hover-reveal pattern that
                         ui-button (h-8 = 32px, no group-hover opacity) can't match. -->
                    <button class="btn-delete" title="Delete modlist" (click)="confirmDelete($event, ml)">
                      <lucide-icon name="trash-2" [size]="14" [strokeWidth]="2"></lucide-icon>
                    </button>
                    <lucide-icon class="card-arrow" name="arrow-right" [size]="16" [strokeWidth]="2"></lucide-icon>
                  </div>
                </div>
                <div class="card-stats">
                  <span class="card-mod-count font-mono">{{ coreModCount(ml) }} mods</span>
                  @if (patchModCount(ml) > 0) {
                    <span class="card-patch-count font-mono">+ {{ patchModCount(ml) }} patches</span>
                  }
                </div>
                @if (ml.created_at) {
                  <span class="card-date text-muted font-mono">{{ ml.created_at | date:'MMM d, y' }}</span>
                }
              </a>
            }
          </div>
        }

        <!-- Delete confirmation dialog template — opened via UiDialogComponent
             wrapper (CDK Dialog under the hood: focus trap, Esc, backdrop click,
             ARIA, focus restore all handled). -->
        <ng-template #deleteDialogTpl>
          <h3 class="dialog-title">Delete modlist?</h3>
          <p class="dialog-body">
            This will permanently remove this modlist and its {{ deleteTarget()?.entries?.length ?? 0 }} mods. This cannot be undone.
          </p>
          <div class="dialog-actions">
            <button ui-button variant="secondary" size="sm" (click)="cancelDelete()">Cancel</button>
            <button ui-button variant="destructive" size="sm" [disabled]="deleting()" (click)="executeDelete()">
              {{ deleting() ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </ng-template>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .dashboard-layout {
      min-height: calc(100vh - var(--header-height));
    }

    /* ===== Main ===== */
    .dashboard-main {
      padding: 2rem 2.5rem;
      max-width: 1000px;
    }

    /* Welcome */
    .welcome {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
    }
    .welcome-title {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .welcome-sub {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin-top: 0.25rem;
    }

    /* Loading */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 5rem 2rem;
      gap: 1rem;
      color: var(--color-text-muted);
    }
    .load-spinner {
      width: 28px;
      height: 28px;
      border: 2px solid var(--color-border);
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Resume banner — custom layout, intentionally not ui-button */
    .resume-banner {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1.125rem;
      background: rgba(192, 160, 96, 0.08);
      border: 1px solid rgba(192, 160, 96, 0.2);
      border-radius: 10px;
      color: var(--color-text);
      font-size: 0.8125rem;
      text-decoration: none;
      margin-bottom: 1.5rem;
      transition: background 0.15s, border-color 0.15s;
    }
    .resume-banner:hover {
      background: rgba(192, 160, 96, 0.14);
      border-color: rgba(192, 160, 96, 0.35);
    }
    .resume-banner strong {
      color: var(--color-accent);
      margin-left: auto;
    }
    .resume-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-accent);
      animation: pulse 1.5s ease-in-out infinite;
      flex-shrink: 0;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }
    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
      color: var(--color-text-dim);
    }
    .empty-state h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .empty-state p {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin-bottom: 1.5rem;
    }

    /* Stats — surface itself comes from <ui-card>; we only keep the inner
       layout (icon + value + label) and override ui-card's default p-6 to a
       tighter 1.25rem so the stat tiles read as compact data tiles. */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      padding: 1.25rem !important;
      transition: border-color 0.25s, transform 0.25s var(--ease-out), box-shadow 0.25s;
    }
    .stat-card:hover {
      border-color: var(--color-border);
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .stat-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.875rem;
    }
    .stat-icon--gold { background: rgba(192, 160, 96, 0.12); color: var(--color-accent); }
    .stat-icon--blue { background: rgba(123, 164, 192, 0.12); color: var(--color-secondary); }
    .stat-value {
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.125rem;
      font-variant-numeric: tabular-nums;
    }
    .stat-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }

    /* Modlist grid */
    .modlist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .modlist-card {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      transition: border-color 0.2s, box-shadow 0.25s, transform 0.2s var(--ease-out);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      cursor: pointer;
    }
    .modlist-card:hover {
      border-color: rgba(196, 165, 90, 0.2);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(196, 165, 90, 0.06);
      transform: translateY(-2px);
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      align-items: center;
    }
    .card-game {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.1875rem 0.625rem;
      border-radius: 100px;
      background: rgba(123, 164, 192, 0.12);
      color: var(--color-secondary);
    }
    .card-provider {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.1875rem 0.625rem;
      border-radius: 100px;
      background: rgba(192, 160, 96, 0.12);
      color: var(--color-accent);
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .btn-delete {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--color-text-dim);
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
      opacity: 0;
    }
    .modlist-card:hover .btn-delete { opacity: 1; }
    .btn-delete:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
    .card-arrow {
      color: var(--color-text-dim);
      transition: color 0.15s, transform 0.15s;
      flex-shrink: 0;
    }
    .modlist-card:hover .card-arrow {
      color: var(--color-accent);
      transform: translateX(2px);
    }

    /* Confirm dialog content — the panel surface itself comes from
       UiDialogComponent's host classes; we only style the inner content. */
    .dialog-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .dialog-body {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.625rem;
    }

    .card-stats {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .card-mod-count {
      font-size: 1.125rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .card-patch-count {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
    }
    .card-date {
      font-size: 0.75rem;
      color: var(--color-text-dim);
    }
    /* text-muted helper — matches Tailwind token used elsewhere; mapped to
       our existing CSS-var muted color so visuals don't shift. */
    .text-muted { color: var(--color-text-muted); }

    @media (max-width: 640px) {
      .stats-row { grid-template-columns: 1fr; }
      .modlist-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  modlists = signal<Modlist[]>([]);
  loading = signal(true);
  deleteTarget = signal<Modlist | null>(null);
  deleting = signal(false);
  activeGenerationId = signal<string | null>(null);
  activeStatus = signal<GenerationStatusResponse | null>(null);

  private pollSub: Subscription | null = null;

  /** Reference to the delete-confirmation template, opened in a CDK Dialog. */
  @ViewChild('deleteDialogTpl', { static: true }) deleteDialogTpl!: TemplateRef<unknown>;
  private deleteDialogRef: DialogRef<unknown> | null = null;

  /** Locally-provided UiDialogComponent — used as a service to call .open(). */
  private uiDialog = inject(UiDialogComponent);

  totalMods = computed(() =>
    this.modlists().reduce((sum, ml) => sum + ml.entries.length, 0)
  );

  constructor(private api: ApiService, private gen: GenerationService) {}

  /** Clear any persisted wizard progress so "New Build" always lands on step 1
   * (game selection). Without this, sessionStorage from a prior run makes the
   * setup wizard's ngOnInit jump past the game-select step. */
  resetSetupWizard(): void {
    sessionStorage.removeItem('setup_wizard_progress');
    localStorage.removeItem('setup_wizard_state');
  }

  ngOnInit(): void {
    this.api.getMyModlists().subscribe({
      next: (modlists) => {
        this.modlists.set(modlists);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });

    // Check for an in-progress generation (from service memory or sessionStorage)
    const activeId = this.gen.generationId() || this.gen.getPersistedGenerationId();
    if (activeId) {
      this.gen.getStatus(activeId).subscribe({
        next: (status) => {
          if (status.status === 'running' || status.status === 'paused') {
            this.activeGenerationId.set(activeId);
            this.activeStatus.set(status);
            this.startStatusPolling(activeId);
          } else {
            sessionStorage.removeItem('active_generation_id');
          }
        },
        error: () => {
          sessionStorage.removeItem('active_generation_id');
        },
      });
    }
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.deleteDialogRef?.close();
  }

  /**
   * Poll /status every 15s while the generation is running/paused.
   * The plan's version attached a badge per in-progress modlist card, but
   * this dashboard tracks a single active generation (generations only
   * become modlist cards after they complete), so we poll the one active
   * generation and render the badge inside the existing resume-banner.
   */
  private startStatusPolling(generationId: string): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(15_000).pipe(
      switchMap(() => this.gen.getStatus(generationId)),
      takeWhile((s) => s.status === 'running' || s.status === 'paused', true),
    ).subscribe({
      next: (status) => {
        this.activeStatus.set(status);
        if (status.status !== 'running' && status.status !== 'paused') {
          this.activeGenerationId.set(null);
          sessionStorage.removeItem('active_generation_id');
        }
      },
      error: () => {
        // Transient poll error — leave the badge as-is; next tick retries.
      },
    });
  }

  /** Map backend status strings to the badge's status union. */
  badgeStatus(status: string): 'running' | 'paused' | 'failed' | 'complete' {
    if (status === 'running') return 'running';
    if (status === 'paused') return 'paused';
    if (status === 'error') return 'failed';
    return 'complete';
  }

  /** Format elapsed seconds as "3m 12s" (or "47s" under a minute). */
  formatElapsed(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  coreModCount(ml: Modlist): number {
    return ml.entries.filter(e => !e.is_patch).length;
  }

  patchModCount(ml: Modlist): number {
    return ml.entries.filter(e => e.is_patch).length;
  }

  confirmDelete(event: Event, ml: Modlist): void {
    event.preventDefault();
    event.stopPropagation();
    this.deleteTarget.set(ml);
    // Open the CDK-backed dialog. backdrop click + Esc close handled by CDK;
    // we route both back through cancelDelete() so signal state stays clean.
    this.deleteDialogRef = this.uiDialog.open(this.deleteDialogTpl);
    this.deleteDialogRef.closed.subscribe(() => {
      // If the user dismissed via Esc/backdrop, executeDelete() never ran —
      // make sure the target signal is cleared so a future click reopens fresh.
      if (this.deleteTarget() !== null && !this.deleting()) {
        this.deleteTarget.set(null);
      }
      this.deleteDialogRef = null;
    });
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteDialogRef?.close();
  }

  executeDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;

    this.deleting.set(true);
    this.api.deleteModlist(target.id).subscribe({
      next: () => {
        this.modlists.update(list => list.filter(ml => ml.id !== target.id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
        this.deleteDialogRef?.close();
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }
}
