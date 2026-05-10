import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeUp, staggerChildren } from '../../core/motion/animations';
import { InstallGuideService } from '../../core/services/install-guide.service';
import { ModlistStore } from '../../core/services/modlist-store.service';
import { GameDataService } from '../../core/services/game-data.service';
import { NotificationService } from '../../core/services/notification.service';
import { InstallGuide, GuideSection, GuideStep } from '../../shared/models/mod.model';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Download,
  HelpCircle,
} from 'lucide-angular';
// Direct primitive imports — same pattern Tasks 5-8 adopted.
import { UiButtonComponent } from '../../shared/components/ui/button.component';

type TabId = 'mo2' | 'vortex';

@Component({
  selector: 'app-modlist-guide',
  standalone: true,
  imports: [LucideAngularModule, UiButtonComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertTriangle,
        ArrowLeft,
        ChevronRight,
        Download,
        HelpCircle,
      }),
    },
  ],
  // Centralized triggers from core/motion/animations.ts. Replaces the inline
  // fadeUp + staggerSteps definitions — Plan 3 Task 9 (Plan 2 Task 14 follow-up).
  animations: [fadeUp, staggerChildren],
  template: `
    <div class="guide-page">
      @if (loading()) {
        <div class="loading">
          <span class="load-spinner"></span>
          <p>Building your install guide...</p>
        </div>
      } @else if (guide()) {
        <div class="guide-header" @fadeUp>
          <div>
            <button ui-button variant="ghost" size="sm" (click)="goBack()">
              <lucide-icon name="arrow-left" [size]="14" [strokeWidth]="2"></lucide-icon>
              Back to Loadout
            </button>
            <span class="page-label">Install Guide</span>
            <h1>{{ guide()!.game_name }}</h1>
            <p class="subtitle">
              @if (guide()!.game_version) {
                <!-- Brand-gold pill, not a semantic status — keep inline. font-mono on the version string. -->
                <span class="version-pill font-mono">{{ guide()!.game_version }}</span>
              } @else {
                <button class="version-btn" (click)="promptVersion()">
                  <lucide-icon name="help-circle" [size]="12" [strokeWidth]="2"></lucide-icon>
                  Set game version for tailored instructions
                </button>
              }
              · {{ guide()!.mod_count }} mods
              @if (guide()!.patch_count) { + {{ guide()!.patch_count }} patches }
            </p>
          </div>
          <div class="header-actions">
            <a ui-button variant="secondary" size="md" [href]="mo2PluginUrl()" download="moddersomni_import.py"
               title="MO2 import plugin — needed for step 3">
              <lucide-icon name="download" [size]="14" [strokeWidth]="2"></lucide-icon>
              Download MO2 plugin
            </a>
            <a ui-button variant="primary" size="md" [href]="markdownUrl()" [download]="'moddersomni-guide-' + shortId() + '.md'">
              <lucide-icon name="download" [size]="14" [strokeWidth]="2"></lucide-icon>
              Download guide (.md)
            </a>
          </div>
        </div>

        @if (guide()!.version_notes.length) {
          <div class="version-notes" @fadeUp>
            <div class="version-notes-header">
              <lucide-icon name="alert-triangle" [size]="16" [strokeWidth]="2"></lucide-icon>
              Before you start
            </div>
            @for (note of guide()!.version_notes; track $index) {
              <p>{{ note }}</p>
            }
          </div>
        }

        <div class="tabs" role="tablist" @fadeUp>
          <button
            class="tab"
            [class.active]="activeTab() === 'mo2'"
            (click)="setTab('mo2')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'mo2'">
            <span class="tab-label">Mod Organizer 2</span>
            <span class="tab-sub">Recommended · automated</span>
          </button>
          <button
            class="tab"
            [class.active]="activeTab() === 'vortex'"
            (click)="setTab('vortex')"
            role="tab"
            [attr.aria-selected]="activeTab() === 'vortex'">
            <span class="tab-label">Vortex</span>
            <span class="tab-sub">Official · manual</span>
          </button>
        </div>

        <div class="section-summary" @fadeUp>
          <p>{{ activeSection().summary }}</p>
        </div>

        <div class="steps" @staggerChildren>
          @for (step of activeSection().steps; track step.title; let i = $index) {
            <div class="step-card">
              <div class="step-number font-mono">{{ i + 1 }}</div>
              <div class="step-content">
                <h3>{{ stripLeadingNumber(step.title) }}</h3>
                <p class="step-body">{{ step.body }}</p>
              </div>
            </div>
          }
        </div>

        @if (guide()!.troubleshooting.length) {
          <div class="troubleshooting" @fadeUp>
            <button class="troubleshoot-toggle" (click)="toggleTroubleshooting()" [attr.aria-expanded]="troubleshootingOpen()">
              <lucide-icon
                name="chevron-right"
                [size]="16"
                [strokeWidth]="2"
                class="chevron"
                [class.expanded]="troubleshootingOpen()"
              ></lucide-icon>
              Troubleshooting — common problems
            </button>
            @if (troubleshootingOpen()) {
              <div class="troubleshoot-list" @fadeUp>
                @for (step of guide()!.troubleshooting; track step.title) {
                  <div class="step-card trouble-card">
                    <h3>{{ step.title }}</h3>
                    <p class="step-body">{{ step.body }}</p>
                  </div>
                }
              </div>
            }
          </div>
        }
      } @else {
        <div class="empty-state">
          <p>Couldn't load the install guide for this modlist.</p>
          <button ui-button variant="primary" size="md" (click)="goBack()">Back to Loadout</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .guide-page {
      max-width: 820px;
      margin: 0 auto;
      padding: 2.5rem 2rem;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 6rem 2rem;
      gap: 1rem;
      color: var(--color-text-muted);
      font-size: 0.875rem;
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

    .guide-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem;
      margin-bottom: 1.75rem;
      flex-wrap: wrap;
    }
    .page-label {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-accent);
      margin: 0.75rem 0 0.375rem;
    }
    h1 {
      font-family: var(--font-display);
      font-size: 1.875rem;
      font-weight: 500;
      letter-spacing: -0.01em;
      margin: 0 0 0.375rem;
    }
    .subtitle {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-size: 0.875rem;
      color: var(--color-text-muted);
      margin: 0;
      flex-wrap: wrap;
    }
    .version-pill {
      display: inline-block;
      padding: 0.2rem 0.625rem;
      border-radius: 999px;
      background: color-mix(in oklch, var(--color-accent) 12%, transparent);
      border: 1px solid color-mix(in oklch, var(--color-accent) 25%, transparent);
      color: var(--color-accent);
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .version-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: none;
      border: 1px dashed var(--color-border);
      color: var(--color-text-muted);
      padding: 0.25rem 0.625rem;
      border-radius: 6px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .version-btn:hover {
      color: var(--color-accent);
      border-color: var(--color-accent);
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 2.25rem;
      flex-wrap: wrap;
    }
    /* btn-back / btn-download / btn-primary CSS removed — replaced by ui-button. */

    .version-notes {
      padding: 1rem 1.25rem;
      background: rgba(234, 179, 8, 0.04);
      border: 1px solid rgba(234, 179, 8, 0.18);
      border-left: 3px solid rgba(234, 179, 8, 0.5);
      border-radius: var(--radius-md);
      margin-bottom: 1.5rem;
    }
    .version-notes-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-warning, #eab308);
      font-weight: 600;
      font-size: 0.8125rem;
      letter-spacing: 0.02em;
      margin-bottom: 0.625rem;
    }
    .version-notes p {
      font-size: 0.8125rem;
      color: var(--color-text);
      margin: 0 0 0.5rem;
      line-height: 1.55;
    }
    .version-notes p:last-child { margin-bottom: 0; }

    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .tab {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
      padding: 0.75rem 1rem;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text-muted);
      cursor: pointer;
      text-align: left;
      position: relative;
      overflow: hidden;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .tab:hover { border-color: var(--color-border); color: var(--color-text); }
    .tab.active {
      border-color: color-mix(in oklch, var(--color-accent) 35%, transparent);
      background: color-mix(in oklch, var(--color-accent) 5%, transparent);
      color: var(--color-text);
    }
    /* Gold strip on the active tab — unambiguous selection indicator */
    .tab.active::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
    }
    .tab-label {
      font-family: var(--font-display);
      font-size: 1rem;
      font-weight: 600;
    }
    .tab-sub {
      font-size: 0.6875rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-text-dim);
    }
    .tab.active .tab-sub { color: var(--color-accent); }

    .section-summary {
      padding: 0.875rem 1rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      margin-bottom: 1rem;
    }
    .section-summary p {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      line-height: 1.55;
    }

    .steps {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }
    .step-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      transition: border-color 0.2s, transform 0.2s var(--ease-out);
    }
    .step-card:hover {
      border-color: color-mix(in oklch, var(--color-accent) 25%, transparent);
      transform: translateX(2px);
    }
    .step-number {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in oklch, var(--color-accent) 10%, transparent);
      border: 1px solid color-mix(in oklch, var(--color-accent) 25%, transparent);
      color: var(--color-accent);
      font-family: var(--font-display);
      font-size: 0.8125rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      margin-top: 2px;
    }
    .step-content { flex: 1; min-width: 0; }
    .trouble-card .step-number {
      background: rgba(234, 179, 8, 0.08);
      border-color: rgba(234, 179, 8, 0.25);
      color: var(--color-warning, #eab308);
    }
    .step-card h3 {
      font-size: 0.9375rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: var(--color-text);
    }
    .step-body {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      margin: 0;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .troubleshooting {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--color-border);
    }
    .troubleshoot-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: none;
      border: none;
      color: var(--color-text-muted);
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0;
      cursor: pointer;
      transition: color 0.15s;
    }
    .troubleshoot-toggle:hover { color: var(--color-accent); }
    .chevron {
      transition: transform 0.2s;
    }
    .chevron.expanded { transform: rotate(90deg); }
    .troubleshoot-list {
      margin-top: 0.875rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .trouble-card {
      border-color: rgba(234, 179, 8, 0.18);
    }
    .trouble-card:hover { border-color: rgba(234, 179, 8, 0.35); }

    .empty-state {
      text-align: center;
      padding: 5rem 2rem;
      color: var(--color-text-muted);
    }
    .empty-state button[ui-button] { margin-top: 1.5rem; }
  `],
})
export class ModlistGuideComponent implements OnInit {
  guide = signal<InstallGuide | null>(null);
  loading = signal(true);
  activeTab = signal<TabId>('mo2');
  troubleshootingOpen = signal(false);

  activeSection = computed<GuideSection>(() => {
    const g = this.guide();
    if (!g) {
      return { id: 'empty', title: '', summary: '', steps: [] as GuideStep[] };
    }
    return this.activeTab() === 'mo2' ? g.mo2_section : g.vortex_section;
  });

  shortId = computed(() => {
    const g = this.guide();
    return g ? g.modlist_id.slice(0, 8) : '';
  });

  /**
   * Markdown is generated client-side now — `markdownUrl` becomes a `blob:`
   * URL we mint on demand. The previous backend endpoint
   * `/modlist/{id}/guide.md` is gone with the API service.
   */
  markdownUrl = computed(() => {
    const g = this.guide();
    if (!g) return '#';
    const md = this.markdownText;
    if (!md) return '#';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    return URL.createObjectURL(blob);
  });

  /**
   * Static path served from `frontend/public/plugins/`. Plan 3 Task 5
   * lands the rewritten plugin file there.
   */
  mo2PluginUrl = computed(() => '/plugins/moddersomni_import.py');

  private modlistId: string | null = null;
  private versionOverride: string | null = null;
  /** Cached markdown text — populated after the guide builds. */
  private markdownText = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private installGuide: InstallGuideService,
    private modlistStore: ModlistStore,
    private gameData: GameDataService,
    private notifications: NotificationService,
  ) {}

  ngOnInit(): void {
    this.modlistId = this.route.snapshot.paramMap.get('id');
    this.versionOverride = this.route.snapshot.queryParamMap.get('version');
    if (!this.modlistId) {
      this.loading.set(false);
      return;
    }

    void this.loadGuide(this.modlistId, this.versionOverride);
  }

  /**
   * Build the install guide entirely client-side from the locally-stored
   * modlist + the static games.json metadata. Replaces the deleted
   * `GET /api/modlist/{id}/guide` endpoint.
   */
  private async loadGuide(modlistId: string, versionOverride: string | null): Promise<void> {
    const ml = this.modlistStore.get(modlistId);
    if (!ml) {
      this.loading.set(false);
      this.notifications.error('Modlist not found in local storage.');
      return;
    }

    try {
      const games = await this.gameData.getGames();
      const game = games.find((g) => g.id === ml.game_id);
      if (!game) {
        this.loading.set(false);
        this.notifications.error('Game metadata not found.');
        return;
      }
      // Apply optional version override to a clone so we don't mutate the
      // stored modlist (the user can flip versions without affecting the
      // canonical record on disk).
      const effective = versionOverride
        ? { ...ml, game_version: versionOverride }
        : ml;
      const guide = this.installGuide.buildGuide(effective, game);
      this.guide.set(guide);
      this.markdownText = this.installGuide.guideToMarkdown(
        guide,
        effective.entries,
        game.nexus_domain,
      );
      this.loading.set(false);
    } catch {
      this.loading.set(false);
      this.notifications.error('Failed to build install guide.');
    }
  }

  setTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  toggleTroubleshooting(): void {
    this.troubleshootingOpen.update(v => !v);
  }

  stripLeadingNumber(title: string): string {
    // Titles from the backend come prefixed with "N. " so they also read clearly
    // in the downloadable Markdown. In the UI the number is shown in the step
    // badge, so we strip the prefix here to avoid visual duplication.
    return title.replace(/^\s*\d+\.\s*/, '');
  }

  goBack(): void {
    const id = this.modlistId;
    if (id) {
      this.router.navigate(['/modlist', id]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  promptVersion(): void {
    const g = this.guide();
    if (!g) return;
    const slug = g.game_slug;
    const options = slug === 'skyrimse'
      ? ['SE (1.5.97)', 'AE (1.6.1170+)']
      : slug === 'fallout4'
        ? ['Standard (pre-Next-Gen)', 'Next-Gen (1.10.980+)']
        : [];
    if (!options.length) return;

    // Minimal prompt — no design dependency. Prefer a dropdown modal later
    // if this needs a richer UX. For now this is hit only by users who open
    // the guide for a modlist generated before game_version was persisted.
    const choice = window.prompt(
      `Choose your game version:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
      '1',
    );
    if (!choice) return;
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= options.length) return;

    const chosenKey = slug === 'skyrimse'
      ? (idx === 0 ? 'SE' : 'AE')
      : (idx === 0 ? 'Standard' : 'Next-Gen');

    this.versionOverride = chosenKey;
    // Reload the guide with the new version (client-side rebuild — no API).
    if (this.modlistId) {
      this.loading.set(true);
      void this.loadGuide(this.modlistId, chosenKey);
      // Reflect the choice in the URL so refresh/share preserves it.
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { version: chosenKey },
        queryParamsHandling: 'merge',
      });
    }
  }
}
