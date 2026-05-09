import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { GenerationService } from '../../core/services/generation.service';
import { AuthService } from '../../core/services/auth.service';
import { Modlist } from '../../shared/models/mod.model';
import { GenerationStatusResponse } from '../../shared/models/generation.model';
import { InProgressBadgeComponent } from '../../shared/components/in-progress-badge/in-progress-badge.component';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, InProgressBadgeComponent],
  animations: [
    trigger('fadeUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px)' }),
        animate('400ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('staggerCards', [
      transition(':enter', [
        query('.modlist-card, .stat-card', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger(80, [
            animate('350ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
  ],
  template: `
    <div class="dashboard-layout">
      <!-- Main Content -->
      <main class="dashboard-main">
        <!-- Welcome -->
        <div class="welcome" @fadeUp>
          <div>
            @if (modlists().length === 0) {
              <h1 class="welcome-title">Welcome, {{ auth.user()?.display_name || 'modder' }}</h1>
            } @else {
              <h1 class="welcome-title">Welcome back, {{ auth.user()?.display_name || 'modder' }}</h1>
            }
            <p class="welcome-sub">Your generated modlists</p>
          </div>
          <a routerLink="/setup" (click)="resetSetupWizard()" class="btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Build
          </a>
        </div>

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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
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
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <h2>No modlists yet</h2>
            <p>Generate your first AI-powered modlist by clicking New Build above.</p>
            <a routerLink="/setup" (click)="resetSetupWizard()" class="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Build
            </a>
          </div>
        } @else {
          <!-- Stats -->
          <div class="stats-row" @staggerCards>
            <div class="stat-card">
              <div class="stat-icon stat-icon--gold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
              </div>
              <div class="stat-value">{{ modlists().length }}</div>
              <div class="stat-label">Modlists Generated</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon--blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
              </div>
              <div class="stat-value">{{ totalMods() }}</div>
              <div class="stat-label">Total Mods</div>
            </div>
          </div>

          <!-- Modlist cards -->
          <div class="modlist-grid" @staggerCards>
            @for (ml of modlists(); track ml.id) {
              <a [routerLink]="['/modlist', ml.id]" class="modlist-card">
                <div class="card-top">
                  <div class="card-meta">
                    <span class="card-game">Game {{ ml.game_id }}</span>
                    @if (ml.llm_provider && ml.llm_provider !== 'fallback') {
                      <span class="card-provider">{{ ml.llm_provider }}</span>
                    }
                    @if (ml.used_fallback) {
                      <span class="card-fallback">Fallback</span>
                    }
                  </div>
                  <div class="card-actions">
                    <button class="btn-delete" title="Delete modlist" (click)="confirmDelete($event, ml)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="card-arrow">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>
                <div class="card-stats">
                  <span class="card-mod-count">{{ coreModCount(ml) }} mods</span>
                  @if (patchModCount(ml) > 0) {
                    <span class="card-patch-count">+ {{ patchModCount(ml) }} patches</span>
                  }
                </div>
                @if (ml.created_at) {
                  <span class="card-date">{{ ml.created_at | date:'MMM d, y' }}</span>
                }
              </a>
            }
          </div>

          <!-- Delete confirmation overlay -->
          @if (deleteTarget()) {
            <div class="confirm-overlay" (click)="cancelDelete()">
              <div class="confirm-dialog" (click)="$event.stopPropagation()">
                <h3>Delete modlist?</h3>
                <p>This will permanently remove this modlist and its {{ deleteTarget()!.entries.length }} mods. This cannot be undone.</p>
                <div class="confirm-actions">
                  <button class="btn-cancel" (click)="cancelDelete()">Cancel</button>
                  <button class="btn-confirm-delete" (click)="executeDelete()" [disabled]="deleting()">
                    {{ deleting() ? 'Deleting...' : 'Delete' }}
                  </button>
                </div>
              </div>
            </div>
          }
        }
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
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--color-gold);
      color: #0D0D0F;
      padding: 0.5rem 1.25rem;
      border-radius: 8px;
      font-size: 0.8125rem;
      font-weight: 600;
      transition: background 0.2s, box-shadow 0.3s;
    }
    .btn-primary:hover {
      background: var(--color-gold-hover);
      box-shadow: var(--shadow-gold);
      transform: translateY(-1px);
    }
    .btn-primary:active { transform: translateY(0); }

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
      border-top-color: var(--color-gold);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Resume banner */
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
      color: var(--color-gold);
      margin-left: auto;
    }
    .resume-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-gold);
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

    /* Stats */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      transition: border-color 0.25s, transform 0.25s var(--ease-out), box-shadow 0.25s;
    }
    .stat-card:hover {
      border-color: var(--color-border-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow-card);
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
    .stat-icon--gold { background: rgba(192, 160, 96, 0.12); color: var(--color-gold); }
    .stat-icon--blue { background: rgba(123, 164, 192, 0.12); color: var(--color-blue); }
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
      background: var(--color-bg-card);
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
    }
    .card-game {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.1875rem 0.625rem;
      border-radius: 100px;
      background: rgba(123, 164, 192, 0.12);
      color: var(--color-blue);
    }
    .card-provider {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.1875rem 0.625rem;
      border-radius: 100px;
      background: rgba(192, 160, 96, 0.12);
      color: var(--color-gold);
    }
    .card-fallback {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.1875rem 0.625rem;
      border-radius: 100px;
      background: rgba(234, 179, 8, 0.12);
      color: var(--color-warning);
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
      color: var(--color-gold);
      transform: translateX(2px);
    }

    /* Confirm overlay */
    .confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .confirm-dialog {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      max-width: 380px;
      width: 90%;
    }
    .confirm-dialog h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .confirm-dialog p {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.5;
      margin-bottom: 1.25rem;
    }
    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.625rem;
    }
    .btn-cancel {
      padding: 0.4375rem 1rem;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .btn-cancel:hover {
      border-color: var(--color-border-hover);
      color: var(--color-text);
    }
    .btn-confirm-delete {
      padding: 0.4375rem 1rem;
      border-radius: 6px;
      border: none;
      background: #ef4444;
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
    }
    .btn-confirm-delete:hover { background: #dc2626; }
    .btn-confirm-delete:disabled { opacity: 0.6; cursor: not-allowed; }
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

  totalMods = computed(() =>
    this.modlists().reduce((sum, ml) => sum + ml.entries.length, 0)
  );

  constructor(private api: ApiService, private gen: GenerationService, protected auth: AuthService) {}

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
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
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
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }
}
