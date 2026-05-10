import {
  Component,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { fadeUp, stackBuild } from '../../core/motion/animations';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  CheckCircle,
  ChevronDown,
  Circle,
  Download,
  Eye,
  FileText,
  Flag,
  HelpCircle,
  Pause,
  Play,
  PlusCircle,
  RefreshCw,
  Repeat,
  Search,
  SearchX,
  Shuffle,
  Users,
  XCircle,
  Zap,
} from 'lucide-angular';
import { GenerationService } from '../../core/services/generation.service';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  GenerationEvent,
  ModAddedEvent,
  PatchAddedEvent,
  ProvidersReadyEvent,
} from '../../shared/models/generation.model';
import { LlmProvider } from '../../shared/models/mod.model';
import { detectProvider } from '../../core/utils/key-detection';
// Direct primitive imports — same pattern landing/setup/settings adopted in
// Tasks 5-7 to avoid pulling in sibling primitives that may have unrelated
// TS errors via the barrel.
import { UiButtonComponent } from '../../shared/components/ui/button.component';
import { UiInputComponent } from '../../shared/components/ui/input.component';
import { UiBadgeComponent } from '../../shared/components/ui/badge.component';
import { UiCardComponent } from '../../shared/components/ui/card.component';

/** Flat item for the timeline — either a phase accordion header or a regular event. */
interface TimelineItem {
  event: GenerationEvent;
  phase: number;        // 0 = before any phase
  isHeader: boolean;    // true for phase_start events (rendered as accordion header)
  phaseComplete: boolean;
  phaseName: string;
  phaseModCount: number;
}

/**
 * Map each SSE event type to a Lucide icon name + CSS color class.
 * Replaces the old iconFor() function that returned raw SVG strings via
 * [innerHTML]. Keeps the visual semantics (gold for phase markers, green
 * for additions, red for errors, amber for warnings, purple for providers).
 */
interface EventIcon { name: string; cls: string; }
const EVENT_ICONS: Record<string, EventIcon> = {
  providers_ready:       { name: 'users',         cls: 'icon-purple' },
  phase_start:           { name: 'zap',           cls: 'icon-gold' },
  searching:             { name: 'search',        cls: 'icon-dim' },
  search_results:        { name: 'file-text',     cls: 'icon-dim' },
  reading_mod:           { name: 'eye',           cls: 'icon-dim' },
  mod_added:             { name: 'plus-circle',   cls: 'icon-green' },
  patch_added:           { name: 'shuffle',       cls: 'icon-blue' },
  knowledge_flag:        { name: 'flag',          cls: 'icon-amber' },
  thinking:              { name: 'circle',        cls: 'icon-dim' },
  phase_complete:        { name: 'check-circle',  cls: 'icon-gold' },
  retrying:              { name: 'refresh-cw',    cls: 'icon-amber' },
  provider_error:        { name: 'x-circle',      cls: 'icon-red' },
  provider_switch:       { name: 'repeat',        cls: 'icon-dim' },
  paused:                { name: 'pause',         cls: 'icon-amber' },
  resumed:               { name: 'play',          cls: 'icon-green' },
  complete:              { name: 'check-circle',  cls: 'icon-green' },
  error:                 { name: 'x-circle',      cls: 'icon-red' },
  sweep_start:           { name: 'refresh-cw',    cls: 'icon-gold' },
  missing_requested_mod: { name: 'search-x',      cls: 'icon-amber' },
  sweep_complete:        { name: 'check-circle',  cls: 'icon-dim' },
};
const FALLBACK_EVENT_ICON: EventIcon = { name: 'circle', cls: 'icon-dim' };

@Component({
  selector: 'app-generation',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    LucideAngularModule,
    UiButtonComponent,
    UiInputComponent,
    UiBadgeComponent,
    UiCardComponent,
  ],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        AlertCircle,
        AlertTriangle,
        ArrowDown,
        CheckCircle,
        ChevronDown,
        Circle,
        Download,
        Eye,
        FileText,
        Flag,
        HelpCircle,
        Pause,
        Play,
        PlusCircle,
        RefreshCw,
        Repeat,
        Search,
        SearchX,
        Shuffle,
        Users,
        XCircle,
        Zap,
      }),
    },
  ],
  // Centralized triggers from core/motion/animations.ts. fadeUp replaces the
  // old inline fadeIn (timeline rows / banners). stackBuild is the new
  // spring-overshoot motion on each mod-added card — Plan 2 Task 14.
  animations: [fadeUp, stackBuild],
  template: `
    <div class="generation-page">
      <!-- ── Generation Not Found ── -->
      @if (generationNotFound()) {
        <div class="not-found-banner" @fadeUp>
          <lucide-icon name="alert-circle" [size]="40" [strokeWidth]="1.5"></lucide-icon>
          <h2>Generation Not Found</h2>
          <p>This generation may have expired or doesn't exist. Start a new one from the setup wizard.</p>
          <a ui-button variant="primary" size="md" routerLink="/setup">Start New Modlist</a>
        </div>
      }

      <!-- ── Connection Lost Banner ── -->
      @if (gen.status() === 'running' && !gen.connected()) {
        <div class="connection-banner">
          <span class="conn-spinner"></span>
          Connection lost — reconnecting...
        </div>
      }

      <!-- ── Animated Nexus Background ── -->
      @if (gen.status() === 'running') {
        <div class="nexus-bg" aria-hidden="true">
          <div class="nexus-node n1"></div>
          <div class="nexus-node n2"></div>
          <div class="nexus-node n3"></div>
          <div class="nexus-node n4"></div>
          <div class="nexus-node n5"></div>
          <div class="nexus-node n6"></div>
          <div class="nexus-node n7"></div>
          <div class="nexus-node n8"></div>
          <div class="nexus-node n9"></div>
          <div class="nexus-node n10"></div>
          <div class="nexus-node n11"></div>
          <div class="nexus-node n12"></div>
          <svg class="nexus-lines" viewBox="0 0 1000 800" preserveAspectRatio="none">
            <line x1="120" y1="150" x2="350" y2="100" class="nx-line l1"/>
            <line x1="350" y1="100" x2="600" y2="200" class="nx-line l2"/>
            <line x1="600" y1="200" x2="850" y2="120" class="nx-line l3"/>
            <line x1="120" y1="150" x2="200" y2="400" class="nx-line l4"/>
            <line x1="200" y1="400" x2="450" y2="350" class="nx-line l5"/>
            <line x1="450" y1="350" x2="600" y2="200" class="nx-line l6"/>
            <line x1="450" y1="350" x2="700" y2="500" class="nx-line l7"/>
            <line x1="700" y1="500" x2="850" y2="120" class="nx-line l8"/>
            <line x1="200" y1="400" x2="350" y2="600" class="nx-line l9"/>
            <line x1="350" y1="600" x2="550" y2="650" class="nx-line l10"/>
            <line x1="550" y1="650" x2="700" y2="500" class="nx-line l11"/>
            <line x1="700" y1="500" x2="900" y2="600" class="nx-line l12"/>
            <line x1="350" y1="100" x2="450" y2="350" class="nx-line l13"/>
            <line x1="120" y1="150" x2="350" y2="600" class="nx-line l14"/>
            <line x1="850" y1="120" x2="900" y2="600" class="nx-line l15"/>
          </svg>
        </div>
      }

      <!-- ── Top: Phase Progress ── -->
      <header class="phase-bar" @fadeUp>
        <div class="phase-bar-inner">
          <div class="phase-label">
            @if (gen.currentPhase(); as phase) {
              <span class="phase-number font-mono">Phase {{ phase.number }}/{{ phase.total_phases }}</span>
              <span class="phase-name">{{ phase.phase }}</span>
            } @else if (gen.status() === 'complete') {
              <span class="phase-done">Generation Complete</span>
            } @else if (gen.status() === 'error') {
              <span class="phase-error">Generation Failed</span>
            } @else if (gen.status() === 'paused') {
              <span class="phase-paused">Paused</span>
            } @else {
              <span class="phase-name">Initializing…</span>
            }
            @if (gen.runningCount() > 0) {
              <span class="size-pill">
                {{ gen.runningCount() }} mods added · {{ formatGB(gen.runningSize()) }} so far
              </span>
            }
          </div>
          <div class="phase-track">
            @for (seg of phaseSegments(); track seg.num) {
              <div
                class="phase-seg"
                [class.completed]="seg.state === 'completed'"
                [class.active]="seg.state === 'active'"
                [class.pending]="seg.state === 'pending'"
              ></div>
            }
          </div>
        </div>
      </header>

      <!-- ── Main Content ── -->
      <div class="gen-body">
        <!-- Left: Timeline -->
        <section class="timeline-panel">
          <div class="panel-header">
            <h2>Activity</h2>
            <div class="panel-header-right">
              <span class="event-count">{{ gen.events().length }} events</span>
              <button class="log-download-btn" (click)="downloadLog()" title="Download generation debug log">
                <lucide-icon name="download" [size]="14" [strokeWidth]="2"></lucide-icon>
              </button>
            </div>
          </div>
          <div class="timeline-scroll" #timelineEl>
            @for (item of timelineItems(); track $index) {
              @if (item.isHeader) {
                <!-- Phase accordion header -->
                <div
                  class="phase-group-header"
                  [class.completed]="item.phaseComplete"
                  [class.collapsed]="collapsedPhases().has(item.phase)"
                  (click)="item.phaseComplete ? togglePhase(item.phase) : null"
                  @fadeUp
                >
                  <div class="tl-icon">
                    @if (item.phaseComplete && collapsedPhases().has(item.phase)) {
                      <lucide-icon class="icon-green" name="check-circle" [size]="14" [strokeWidth]="2"></lucide-icon>
                    } @else {
                      <lucide-icon class="icon-gold" name="zap" [size]="14" [strokeWidth]="2"></lucide-icon>
                    }
                  </div>
                  <div class="tl-body">
                    <div class="phase-header-content">
                      <span class="tl-phase-badge font-mono">Phase {{ item.phase }}</span>
                      <span class="phase-header-name">{{ item.phaseName }}</span>
                      @if (item.phaseComplete) {
                        <span class="phase-complete-tag">{{ item.phaseModCount }} mods</span>
                      }
                    </div>
                  </div>
                  @if (item.phaseComplete) {
                    <lucide-icon class="phase-chevron" [class.open]="!collapsedPhases().has(item.phase)" name="chevron-down" [size]="16" [strokeWidth]="2"></lucide-icon>
                  }
                </div>
              } @else if (!collapsedPhases().has(item.phase) || isTerminalEvent(item.event)) {
                <!-- Regular timeline event (hidden when parent phase is collapsed) -->
                <div
                  class="tl-item"
                  [class]="'tl-' + item.event.type"
                  @fadeUp
                >
                  <div class="tl-icon">
                    <lucide-icon
                      [class]="iconClassFor(item.event)"
                      [name]="iconNameFor(item.event)"
                      [size]="14"
                      [strokeWidth]="2"
                    ></lucide-icon>
                  </div>
                  <div class="tl-body">
                    @switch (item.event.type) {
                      @case ('providers_ready') {
                        <div class="tl-providers-ready">
                          <strong>{{ $any(item.event).count }} provider{{ $any(item.event).count !== 1 ? 's' : '' }} available</strong>
                          <ul class="tl-provider-list">
                            @for (p of $any(item.event).providers; track p.provider_id) {
                              <li><span class="tl-provider-name">{{ p.name }}</span> <span class="tl-provider-model font-mono">{{ p.model }}</span></li>
                            }
                          </ul>
                        </div>
                      }
                      @case ('searching') {
                        <span class="tl-muted">Searching: <em>"{{ $any(item.event).query }}"</em></span>
                      }
                      @case ('search_results') {
                        <span class="tl-muted">Found {{ $any(item.event).count }} mods</span>
                      }
                      @case ('reading_mod') {
                        <span class="tl-dim">Reading mod <span class="font-mono">#{{ $any(item.event).mod_id }}</span>…</span>
                      }
                      @case ('mod_added') {
                        <div class="tl-mod-add">
                          <strong>{{ $any(item.event).name }}</strong>
                          <span class="tl-reason">{{ $any(item.event).reason }}</span>
                        </div>
                      }
                      @case ('patch_added') {
                        <div class="tl-patch-add">
                          <strong>{{ $any(item.event).name }}</strong>
                          <span class="tl-patches-list">patches {{ $any(item.event).patches_mods?.join(', ') }}</span>
                        </div>
                      }
                      @case ('knowledge_flag') {
                        <div class="tl-flag">
                          <ui-badge [variant]="$any(item.event).severity === 'critical' ? 'danger' : 'warning'">
                            {{ $any(item.event).severity }}
                          </ui-badge>
                          {{ $any(item.event).mod_a }} &harr; {{ $any(item.event).mod_b }}: {{ $any(item.event).issue }}
                        </div>
                      }
                      @case ('thinking') {
                        <span class="tl-thinking">{{ $any(item.event).text }}</span>
                      }
                      @case ('phase_complete') {
                        <span class="tl-phase-done">Phase {{ $any(item.event).number }} complete — {{ $any(item.event).mod_count }} mods added</span>
                      }
                      @case ('retrying') {
                        <span class="tl-retry">Retrying in {{ $any(item.event).wait_seconds }}s ({{ $any(item.event).reason }})</span>
                      }
                      @case ('provider_error') {
                        <span class="tl-provider-err">{{ $any(item.event).message }}</span>
                      }
                      @case ('provider_switch') {
                        <span class="tl-switch">Switched to {{ $any(item.event).to_provider }}</span>
                      }
                      @case ('paused') {
                        <span class="tl-paused-msg">Paused — all providers failed</span>
                        @if ($any(item.event).provider_errors?.length) {
                          <ul class="tl-error-list">
                            @for (err of $any(item.event).provider_errors; track err.provider) {
                              <li class="tl-error-item" [attr.data-type]="err.type">
                                <span class="tl-err-icon">{{ getErrorIcon(err.type) }}</span>
                                <span class="tl-err-provider">{{ err.provider }}</span>
                                <span class="tl-err-detail">{{ getErrorLabel(err.type) }}</span>
                              </li>
                            }
                          </ul>
                        } @else {
                          <span class="tl-paused-reason">{{ $any(item.event).reason }}</span>
                        }
                      }
                      @case ('resumed') {
                        <span class="tl-resumed-msg">Resumed at Phase {{ $any(item.event).phase_number }}</span>
                      }
                      @case ('complete') {
                        <span class="tl-complete-msg">Generation complete!</span>
                      }
                      @case ('error') {
                        <span class="tl-error-msg">{{ $any(item.event).message }}</span>
                      }
                      @case ('sweep_start') {
                        <div class="tl-sweep-start">
                          <strong>Final sweep</strong>
                          <span class="tl-reason">
                            Searching for {{ $any(item.event).missing_count }}
                            mod{{ $any(item.event).missing_count === 1 ? '' : 's' }}
                            you asked for that weren't added yet:
                            {{ $any(item.event).missing_mods.join(', ') }}
                          </span>
                        </div>
                      }
                      @case ('missing_requested_mod') {
                        <div class="tl-missing-mod">
                          <ui-badge variant="warning">Not found</ui-badge>
                          Couldn't locate "{{ $any(item.event).name }}" on Nexus.
                        </div>
                      }
                      @case ('sweep_complete') {
                        @if ($any(item.event).still_missing_count === 0) {
                          <span class="tl-muted">
                            Sweep complete — added
                            {{ $any(item.event).added_by_sweep.length }} requested
                            mod{{ $any(item.event).added_by_sweep.length === 1 ? '' : 's' }}.
                          </span>
                        } @else {
                          <span class="tl-sweep-incomplete">
                            Sweep complete — added {{ $any(item.event).added_by_sweep.length }},
                            {{ $any(item.event).still_missing_count }} could not be found.
                          </span>
                        }
                      }
                    }
                  </div>
                </div>
              }
            }

            @if (gen.status() === 'running') {
              <div class="tl-item tl-working">
                <div class="tl-icon"><div class="dot-pulse"></div></div>
                <div class="tl-body"><span class="tl-dim">Working…</span></div>
              </div>
            }
          </div>

          @if (!userAtBottom()) {
            <button class="scroll-btn" (click)="scrollToBottom()">
              <lucide-icon name="arrow-down" [size]="14" [strokeWidth]="2"></lucide-icon>
              New events
            </button>
          }
        </section>

        <!-- Right: Modlist Builder -->
        <section class="modlist-panel">
          <div class="panel-header">
            <h2>Modlist</h2>
            <span class="mod-count">{{ gen.modsAdded().length }} mods · {{ gen.patchesAdded().length }} patches</span>
          </div>

          <!-- Terminal state banners -->
          @if (gen.status() === 'complete') {
            <div class="banner banner-success" @fadeUp>
              <lucide-icon class="banner-icon icon-green" name="check-circle" [size]="20" [strokeWidth]="2"></lucide-icon>
              <div class="banner-text">
                <strong>Your modlist is ready!</strong>
                <p>{{ gen.modsAdded().length }} mods and {{ gen.patchesAdded().length }} patches selected.</p>
              </div>
              <a ui-button variant="primary" size="md" [routerLink]="['/modlist', gen.modlistId()]">View Modlist</a>
            </div>
          }

          @if (gen.status() === 'error') {
            <div class="banner banner-error" @fadeUp>
              <lucide-icon class="banner-icon icon-red" name="x-circle" [size]="20" [strokeWidth]="2"></lucide-icon>
              <div class="banner-text">
                <strong>Generation failed</strong>
                <p>{{ gen.errorMessage() }}</p>
              </div>
              <a ui-button variant="secondary" size="md" routerLink="/setup">Start Over</a>
            </div>
          }

          @if (gen.status() === 'paused') {
            <div class="banner banner-paused" @fadeUp>
              <lucide-icon class="banner-icon icon-amber" name="pause" [size]="20" [strokeWidth]="2"></lucide-icon>
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
                      Save & Start
                    </button>
                  </form>
                  <p style="margin:0.5rem 0 0;font-size:0.75rem;color:var(--color-text-muted)">Key is auto-detected and saved to your account. <a routerLink="/settings" style="color:var(--color-accent)">Manage keys in Settings</a></p>
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
                      Update & Resume
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
          }

          <!-- Mod cards — each card uses @stackBuild on enter so newly added
               mods slide up from below with a spring overshoot, reading as
               "stacking onto a load order" rather than a generic fade-in. -->
          <div class="mod-cards">
            @for (mod of gen.modsAdded(); track mod.mod_id) {
              <ui-card class="mod-card" @stackBuild>
                <div class="mod-card-top">
                  <span class="lo-badge font-mono">#{{ mod.load_order }}</span>
                  <span class="mod-name">{{ mod.name }}</span>
                </div>
                <p class="mod-reason">{{ mod.reason }}</p>
              </ui-card>
            }
            @for (patch of gen.patchesAdded(); track patch.mod_id) {
              <ui-card class="mod-card patch-card" @stackBuild>
                <div class="mod-card-top">
                  <span class="lo-badge patch-badge font-mono">P</span>
                  <span class="mod-name">{{ patch.name }}</span>
                </div>
                <p class="mod-reason">Patches: {{ patch.patches_mods.join(', ') }}</p>
              </ui-card>
            }
          </div>

          <!-- Knowledge flags -->
          @if (knowledgeFlags().length) {
            <div class="flags-section">
              <h3>Compatibility Notes</h3>
              @for (flag of knowledgeFlags(); track $index) {
                <div class="flag-card" [class.critical]="flag.severity === 'critical'">
                  <ui-badge [variant]="flag.severity === 'critical' ? 'danger' : 'warning'">
                    {{ flag.severity }}
                  </ui-badge>
                  <div>
                    <strong>{{ flag.mod_a }} &harr; {{ flag.mod_b }}</strong>
                    <p>{{ flag.issue }}</p>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: var(--color-bg);
      }

      /* ── Not Found ── */
      .not-found-banner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 4rem 2rem;
        text-align: center;
        color: var(--color-text-muted);
      }
      .not-found-banner lucide-icon { color: var(--color-text-dim); }
      .not-found-banner h2 {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text);
        margin: 0;
      }
      .not-found-banner p {
        font-size: 0.875rem;
        max-width: 400px;
        line-height: 1.5;
        margin: 0;
      }

      /* ── Lucide icon color utilities ──
         Used by EVENT_ICONS map + inline lucide-icon usages. The map drives
         which class lights up per event type — keeps the visual semantic the
         same as before (gold = phase, green = added, red = error, etc.) */
      .icon-gold   { color: var(--color-accent); }
      .icon-green  { color: #22c55e; }
      .icon-amber  { color: #f59e0b; }
      .icon-red    { color: #ef4444; }
      .icon-blue   { color: #6b9fbf; }
      .icon-purple { color: #8b5cf6; }
      .icon-dim    { color: var(--color-text-dim); }
      .banner-icon { flex-shrink: 0; }

      /* ── Connection Banner ── */
      .connection-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: rgba(234, 179, 8, 0.12);
        border-bottom: 1px solid rgba(234, 179, 8, 0.2);
        font-size: 0.8125rem;
        color: var(--color-warning, #eab308);
        position: sticky;
        top: 0;
        z-index: 20;
      }
      .conn-spinner {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(234, 179, 8, 0.3);
        border-top-color: #eab308;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* ── Phase Bar ── */
      .phase-bar {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--color-surface-1);
        border-bottom: 1px solid var(--color-border);
        padding: 0.875rem 1.5rem;
      }
      .phase-bar-inner {
        max-width: 1400px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 1.25rem;
      }
      .phase-label {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        flex-shrink: 0;
        min-width: 220px;
      }
      .phase-number {
        background: var(--color-accent);
        color: #0D0D0F;
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .phase-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text);
      }
      .phase-done {
        color: #22c55e;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .phase-error {
        color: #ef4444;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .phase-paused {
        color: #f59e0b;
        font-weight: 600;
        font-size: 0.875rem;
      }
      .size-pill {
        display: inline-block;
        padding: 0.15rem 0.55rem;
        border-radius: 999px;
        background: rgba(201, 168, 108, 0.12);
        color: var(--color-accent, #c9a86c);
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      .phase-track {
        flex: 1;
        display: flex;
        gap: 3px;
        height: 6px;
      }
      .phase-seg {
        flex: 1;
        border-radius: 3px;
        transition: background 0.4s;
      }
      .phase-seg.completed {
        background: var(--color-accent);
      }
      .phase-seg.active {
        background: var(--color-accent);
        animation: seg-pulse 1.5s ease-in-out infinite;
      }
      .phase-seg.pending {
        background: var(--color-border);
      }
      @keyframes seg-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.45;
        }
      }

      /* ── Body Grid ── */
      .gen-body {
        max-width: 1400px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 1px;
        min-height: calc(100vh - 52px);
        background: var(--color-border);
      }

      /* ── Panel shared ── */
      .timeline-panel,
      .modlist-panel {
        background: var(--color-bg);
        display: flex;
        flex-direction: column;
      }
      .panel-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        padding: 1rem 1.25rem 0.75rem;
        border-bottom: 1px solid var(--color-border);
      }
      .panel-header h2 {
        font-size: 0.8125rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-muted);
      }
      .event-count,
      .mod-count {
        font-size: 0.75rem;
        color: var(--color-text-dim);
      }
      .panel-header-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .log-download-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: 1px solid var(--color-border);
        border-radius: 5px;
        background: transparent;
        color: var(--color-text-dim);
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
      }
      .log-download-btn:hover {
        color: var(--color-accent);
        border-color: var(--color-accent);
      }

      /* ── Timeline ── */
      .timeline-panel {
        position: relative;
      }
      .timeline-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem 1rem;
        scroll-behavior: smooth;
      }
      .timeline-scroll::-webkit-scrollbar {
        width: 5px;
      }
      .timeline-scroll::-webkit-scrollbar-thumb {
        background: var(--color-border);
        border-radius: 3px;
      }

      .tl-item {
        display: flex;
        gap: 0.625rem;
        padding: 0.375rem 0;
        align-items: flex-start;
        font-size: 0.8125rem;
        line-height: 1.45;
      }
      .tl-icon {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-dim);
      }
      .tl-icon svg {
        width: 14px;
        height: 14px;
      }
      .tl-body {
        flex: 1;
        min-width: 0;
      }

      /* ── Phase Accordion Header ── */
      .phase-group-header {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.5rem 0;
        margin-top: 0.5rem;
        font-size: 0.8125rem;
        line-height: 1.45;
        border-radius: 6px;
        transition: background 0.15s, opacity 0.3s;
      }
      .phase-group-header.completed {
        cursor: pointer;
        padding: 0.5rem 0.375rem;
        margin-left: -0.375rem;
        margin-right: -0.375rem;
      }
      .phase-group-header.completed:hover {
        background: rgba(196, 165, 90, 0.06);
      }
      .phase-group-header.completed.collapsed {
        opacity: 0.7;
        margin-top: 0.25rem;
        padding-top: 0.35rem;
        padding-bottom: 0.35rem;
      }
      .phase-group-header.completed.collapsed:hover {
        opacity: 1;
      }
      .phase-group-header .tl-icon {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .phase-group-header .tl-icon svg {
        width: 14px;
        height: 14px;
      }
      .phase-group-header .tl-body {
        flex: 1;
        min-width: 0;
      }
      .phase-header-content {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: var(--color-accent);
      }
      .phase-header-name {
        color: var(--color-accent);
      }
      .phase-complete-tag {
        font-size: 0.6875rem;
        font-weight: 500;
        color: #22c55e;
        margin-left: auto;
      }
      .phase-chevron {
        flex-shrink: 0;
        color: var(--color-text-dim);
        transition: transform 0.25s ease;
        transform: rotate(-90deg);
      }
      .phase-chevron.open {
        transform: rotate(0deg);
      }

      /* Legacy phase badge (reused in accordion headers) */
      .tl-phase-badge {
        background: rgba(196, 165, 90, 0.15);
        color: var(--color-accent);
        font-size: 0.625rem;
        font-weight: 700;
        padding: 0.15rem 0.4rem;
        border-radius: 3px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      /* Text variants */
      .tl-muted {
        color: var(--color-text-muted);
      }
      .tl-muted em {
        color: var(--color-text);
        font-style: normal;
      }
      .tl-dim {
        color: var(--color-text-dim);
      }
      .tl-thinking {
        color: var(--color-text-dim);
        font-style: italic;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Mod added */
      .tl-mod_added .tl-icon {
        color: #22c55e;
      }
      .tl-mod-add strong {
        color: var(--color-text);
        display: block;
      }
      .tl-reason {
        color: var(--color-text-dim);
        font-size: 0.75rem;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Patch added */
      .tl-patch_added .tl-icon {
        color: #6b9fbf;
      }
      .tl-patch-add strong {
        color: var(--color-text);
        display: block;
      }
      .tl-patches-list {
        color: var(--color-text-dim);
        font-size: 0.75rem;
      }

      /* Final sweep + missing-mod warnings */
      .tl-sweep_start .tl-icon {
        color: var(--color-accent);
      }
      .tl-sweep-start strong {
        color: var(--color-text);
        display: block;
      }
      .tl-missing_requested_mod .tl-icon {
        color: #f59e0b;
      }
      .tl-missing-mod {
        font-size: 0.8125rem;
        color: var(--color-text);
      }
      .tl-missing-mod ui-badge {
        margin-right: 0.35rem;
        text-transform: uppercase;
      }
      .tl-sweep_complete .tl-icon {
        color: var(--color-text-muted);
      }
      .tl-sweep-incomplete {
        color: #f59e0b;
      }

      /* Knowledge flag */
      .tl-flag {
        font-size: 0.75rem;
        color: var(--color-text-muted);
      }
      .tl-flag ui-badge {
        margin-right: 0.25rem;
        text-transform: uppercase;
      }

      /* Phase complete */
      .tl-phase-done {
        color: var(--color-accent);
        font-weight: 500;
        font-size: 0.75rem;
      }

      /* Retry / error */
      .tl-retry {
        color: #f59e0b;
        font-size: 0.75rem;
      }
      .tl-provider-err {
        color: #ef4444;
        font-size: 0.75rem;
      }
      .tl-switch {
        color: var(--color-text-muted);
        font-size: 0.75rem;
      }
      .tl-providers-ready {
        font-size: 0.8125rem;
      }
      .tl-providers-ready strong {
        color: #8b5cf6;
      }
      .tl-provider-list {
        list-style: none;
        padding: 0;
        margin: 0.25rem 0 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
      }
      .tl-provider-list li {
        font-size: 0.75rem;
        background: var(--color-surface-2, rgba(255,255,255,0.05));
        border-radius: 4px;
        padding: 0.125rem 0.5rem;
      }
      .tl-provider-name {
        font-weight: 500;
      }
      .tl-provider-model {
        color: var(--color-text-muted);
        margin-left: 0.25rem;
      }
      .tl-paused-msg {
        color: #f59e0b;
        font-weight: 500;
      }
      .tl-resumed-msg {
        color: #22c55e;
        font-weight: 500;
      }
      .tl-complete-msg {
        color: #22c55e;
        font-weight: 600;
      }
      .tl-error-msg {
        color: #ef4444;
        font-weight: 500;
      }
      .tl-paused-reason {
        color: #f59e0b;
        font-size: 0.8125rem;
        display: block;
        margin-top: 0.25rem;
      }
      .tl-error-list, .banner-error-list {
        list-style: none;
        padding: 0;
        margin: 0.375rem 0 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .tl-error-item, .banner-error-item {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        color: var(--color-text-muted);
      }
      .tl-err-icon, .banner-err-icon {
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
      .tl-error-item[data-type="rate_limit"] .tl-err-icon,
      .banner-error-item[data-type="rate_limit"] .banner-err-icon {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }
      .tl-error-item[data-type="timeout"] .tl-err-icon,
      .banner-error-item[data-type="timeout"] .banner-err-icon {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }
      .tl-err-provider, .banner-err-provider {
        font-weight: 600;
        color: var(--color-text);
        font-family: monospace;
        font-size: 0.6875rem;
      }
      .tl-err-detail, .banner-err-detail {
        color: var(--color-text-dim);
      }

      /* Working indicator */
      .dot-pulse {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--color-accent);
        animation: dot-blink 1.2s ease-in-out infinite;
      }
      @keyframes dot-blink {
        0%,
        100% {
          opacity: 0.2;
        }
        50% {
          opacity: 1;
        }
      }

      /* Scroll-to-bottom button */
      .scroll-btn {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--color-surface-2);
        border: 1px solid var(--color-border);
        color: var(--color-text-muted);
        padding: 0.35rem 0.75rem;
        border-radius: 20px;
        font-size: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        cursor: pointer;
        box-shadow: var(--shadow-md);
        transition:
          background 0.15s,
          color 0.15s;
      }
      .scroll-btn:hover {
        background: var(--color-surface-1);
        color: var(--color-text);
      }

      /* ── Modlist Panel ── */
      .modlist-panel {
        overflow-y: auto;
        padding-bottom: 2rem;
      }

      /* Banners */
      .banner {
        margin: 1rem 1.25rem;
        padding: 1rem;
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border: 1px solid;
      }
      .banner > svg {
        flex-shrink: 0;
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
      .banner-success {
        background: rgba(34, 197, 94, 0.06);
        border-color: rgba(34, 197, 94, 0.2);
      }
      .banner-error {
        background: rgba(239, 68, 68, 0.06);
        border-color: rgba(239, 68, 68, 0.2);
      }
      .banner-paused {
        background: rgba(245, 158, 11, 0.06);
        border-color: rgba(245, 158, 11, 0.2);
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
      /* Tighten the ui-input field width inside the inline pause-form so it
         shares the row gracefully with the Save/Resume button. */
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
      .link-muted:hover {
        color: var(--color-text-muted);
      }
      /* Inline spinner used inside ui-button while resuming. Kept here (as a
         child <span>) instead of refactoring ui-button to expose a loading
         prop — same approach Settings/Setup take. */
      .btn-spinner {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(13, 13, 15, 0.3);
        border-top-color: #0d0d0f;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* ── Mod Cards ── */
      .mod-cards {
        padding: 0.75rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      /* ui-card brings bg/border/radius/shadow at p-6; the timeline's per-row
         density needs tighter padding + a hover border accent. */
      .mod-card {
        padding: 0.625rem 0.75rem !important;
        transition: border-color 0.15s;
      }
      .mod-card:hover {
        border-color: var(--color-border);
      }
      .mod-card-top {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .lo-badge {
        font-size: 0.625rem;
        font-weight: 700;
        color: var(--color-accent);
        background: rgba(196, 165, 90, 0.1);
        padding: 0.1rem 0.35rem;
        border-radius: 3px;
        flex-shrink: 0;
      }
      .patch-badge {
        color: #6b9fbf !important;
        background: rgba(107, 159, 191, 0.1) !important;
      }
      .mod-name {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text);
      }
      .mod-reason {
        font-size: 0.75rem;
        color: var(--color-text-dim);
        margin: 0.25rem 0 0 0;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .patch-card {
        border-left: 2px solid rgba(107, 159, 191, 0.4);
      }

      /* ── Knowledge Flags ── */
      .flags-section {
        padding: 0.75rem 1.25rem;
        border-top: 1px solid var(--color-border);
      }
      .flags-section h3 {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-dim);
        margin-bottom: 0.5rem;
      }
      .flag-card {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem 0.625rem;
        background: rgba(245, 158, 11, 0.05);
        border: 1px solid rgba(245, 158, 11, 0.12);
        border-radius: var(--radius-sm);
        margin-bottom: 0.375rem;
        font-size: 0.75rem;
      }
      .flag-card.critical {
        background: rgba(239, 68, 68, 0.05);
        border-color: rgba(239, 68, 68, 0.12);
      }
      .flag-card ui-badge {
        text-transform: uppercase;
        flex-shrink: 0;
        height: fit-content;
      }
      .flag-card strong {
        font-size: 0.75rem;
        display: block;
        color: var(--color-text);
      }
      .flag-card p {
        font-size: 0.6875rem;
        color: var(--color-text-muted);
        margin: 0.15rem 0 0;
      }

      /* ── Animated Nexus Background ── */
      .nexus-bg {
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
        opacity: 0;
        animation: nexus-fade-in 2s ease-out 0.5s forwards;
      }
      @keyframes nexus-fade-in {
        to { opacity: 1; }
      }

      .nexus-lines {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .nx-line {
        stroke: var(--color-accent);
        stroke-width: 0.5;
        opacity: 0;
        animation: line-draw 1.5s ease-out forwards, line-pulse 4s ease-in-out infinite;
      }
      @keyframes line-draw {
        from { stroke-dasharray: 600; stroke-dashoffset: 600; opacity: 0; }
        to { stroke-dasharray: 600; stroke-dashoffset: 0; opacity: 0.06; }
      }
      @keyframes line-pulse {
        0%, 100% { opacity: 0.04; }
        50% { opacity: 0.08; }
      }
      .l1 { animation-delay: 0.2s, 0.2s; }
      .l2 { animation-delay: 0.35s, 0.6s; }
      .l3 { animation-delay: 0.5s, 1.0s; }
      .l4 { animation-delay: 0.3s, 0.4s; }
      .l5 { animation-delay: 0.55s, 0.8s; }
      .l6 { animation-delay: 0.7s, 1.2s; }
      .l7 { animation-delay: 0.85s, 0.3s; }
      .l8 { animation-delay: 0.4s, 0.9s; }
      .l9 { animation-delay: 0.6s, 1.4s; }
      .l10 { animation-delay: 0.75s, 0.5s; }
      .l11 { animation-delay: 0.9s, 1.1s; }
      .l12 { animation-delay: 0.45s, 0.7s; }
      .l13 { animation-delay: 0.65s, 1.3s; }
      .l14 { animation-delay: 0.8s, 0.2s; }
      .l15 { animation-delay: 0.95s, 1.5s; }

      .nexus-node {
        position: absolute;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--color-accent);
        opacity: 0;
        animation: node-appear 0.6s ease-out forwards, node-glow 3s ease-in-out infinite;
        box-shadow: 0 0 8px rgba(196, 165, 90, 0.3);
      }
      @keyframes node-appear {
        from { transform: scale(0); opacity: 0; }
        to { transform: scale(1); opacity: 0.25; }
      }
      @keyframes node-glow {
        0%, 100% { opacity: 0.15; box-shadow: 0 0 6px rgba(196, 165, 90, 0.2); }
        50% { opacity: 0.35; box-shadow: 0 0 14px rgba(196, 165, 90, 0.4); }
      }
      /* Node positions matching the SVG line endpoints */
      .n1 { left: 12%; top: 19%; animation-delay: 0.2s, 0.5s; }
      .n2 { left: 35%; top: 12.5%; animation-delay: 0.35s, 1.0s; }
      .n3 { left: 60%; top: 25%; animation-delay: 0.5s, 0.3s; }
      .n4 { left: 85%; top: 15%; animation-delay: 0.65s, 0.8s; }
      .n5 { left: 20%; top: 50%; animation-delay: 0.3s, 1.2s; }
      .n6 { left: 45%; top: 44%; animation-delay: 0.55s, 0.6s; }
      .n7 { left: 70%; top: 62.5%; animation-delay: 0.7s, 1.5s; }
      .n8 { left: 35%; top: 75%; animation-delay: 0.45s, 0.9s; }
      .n9 { left: 55%; top: 81%; animation-delay: 0.8s, 0.4s; }
      .n10 { left: 90%; top: 75%; animation-delay: 0.6s, 1.1s; }
      .n11 { left: 8%; top: 85%; animation-delay: 0.4s, 0.7s; }
      .n12 { left: 78%; top: 38%; animation-delay: 0.75s, 1.3s; }

      /* Ensure content sits above the nexus */
      .phase-bar, .gen-body {
        position: relative;
        z-index: 1;
      }

      /* ── Mobile ── */
      @media (max-width: 800px) {
        .gen-body {
          grid-template-columns: 1fr;
        }
        .timeline-panel {
          max-height: 50vh;
        }
        .phase-label {
          min-width: 0;
        }
      }
    `,
  ],
})
export class GenerationComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('timelineEl') timelineEl!: ElementRef<HTMLDivElement>;

  apiKeyInput = '';
  resuming = signal(false);
  private providers = signal<LlmProvider[]>([]);
  userAtBottom = signal(true);
  private prevEventCount = 0;
  private shouldAutoScroll = true;

  // Derived helpers
  phaseSegments = computed(() => {
    const total = this.gen.totalPhases();
    const current = this.gen.currentPhase();
    const completedPhases = new Set<number>();

    for (const evt of this.gen.events()) {
      if (evt.type === 'phase_complete') {
        completedPhases.add((evt as any).number);
      }
    }

    const segments: { num: number; state: 'completed' | 'active' | 'pending' }[] = [];
    for (let i = 1; i <= total; i++) {
      if (completedPhases.has(i)) {
        segments.push({ num: i, state: 'completed' });
      } else if (current && current.number === i) {
        segments.push({ num: i, state: 'active' });
      } else {
        segments.push({ num: i, state: 'pending' });
      }
    }
    return segments;
  });

  knowledgeFlags = computed(() =>
    this.gen
      .events()
      .filter((e) => e.type === 'knowledge_flag')
      .map((e) => e as any)
  );

  // ── Phase collapse state ──
  collapsedPhases = signal<Set<number>>(new Set());
  private autoCollapsedPhases = new Set<number>();

  /** Flat timeline items: phase headers + events, each tagged with phase metadata. */
  timelineItems = computed<TimelineItem[]>(() => {
    const events = this.gen.events();
    const items: TimelineItem[] = [];
    let currentPhase = 0;
    let currentPhaseName = '';

    // Pre-scan: which phases are complete and their mod counts
    const completionMap = new Map<number, number>();
    for (const evt of events) {
      if (evt.type === 'phase_complete') {
        completionMap.set((evt as any).number, (evt as any).mod_count || 0);
      }
    }

    for (const evt of events) {
      if (evt.type === 'phase_start') {
        const num = (evt as any).number;
        currentPhase = num;
        currentPhaseName = (evt as any).phase;
        items.push({
          event: evt,
          phase: num,
          isHeader: true,
          phaseComplete: completionMap.has(num),
          phaseName: currentPhaseName,
          phaseModCount: completionMap.get(num) || 0,
        });
      } else {
        items.push({
          event: evt,
          phase: currentPhase,
          isHeader: false,
          phaseComplete: false,
          phaseName: currentPhaseName,
          phaseModCount: 0,
        });
      }
    }
    return items;
  });

  togglePhase(num: number): void {
    this.collapsedPhases.update(set => {
      const next = new Set(set);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }

  isTerminalEvent(evt: GenerationEvent): boolean {
    return evt.type === 'complete' || evt.type === 'error'
      || evt.type === 'paused' || evt.type === 'resumed';
  }

  getErrorIcon(errorType: string): string {
    switch (errorType) {
      case 'auth_error': return '\u00D7';     // ×
      case 'rate_limit': return '\u29D7';     // ⧗
      case 'token_limit': return '\u0024';    // $
      case 'timeout': return '\u25F7';        // ◷
      case 'connection': return '\u2298';     // ⊘
      default: return '\u0021';               // !
    }
  }

  getErrorLabel(errorType: string): string {
    switch (errorType) {
      case 'auth_error': return 'Invalid API key';
      case 'rate_limit': return 'Rate limited';
      case 'token_limit': return 'Quota exceeded';
      case 'timeout': return 'Request timed out';
      case 'connection': return 'Connection failed';
      default: return 'Error';
    }
  }

  isAuthError = computed(() => {
    const info = this.gen.pauseInfo();
    if (!info) return false;
    // Prefer structured error data
    if (info.provider_errors?.length) {
      return info.provider_errors.some(e => e.type === 'auth_error');
    }
    // Fallback to string matching for backward compat
    const reason = (info.reason || '').toLowerCase();
    return (
      reason.includes('api key') ||
      reason.includes('auth') ||
      reason.includes('401') ||
      reason.includes('invalid key')
    );
  });

  // True when no LLM providers were available at all (free-tier keys not configured
  // server-side and no BYOK keys added). Paused immediately on phase 1 with 0 mods.
  isNoProviders = computed(() => {
    const events = this.gen.events();
    const ready = events.find(e => e.type === 'providers_ready') as { count?: number; free_tier?: boolean } | undefined;
    return ready?.count === 0 && ready?.free_tier === true && this.gen.modsAdded().length === 0;
  });

  constructor(
    public gen: GenerationService,
    private api: ApiService,
    private notifications: NotificationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  generationNotFound = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.generationNotFound.set(true);
      return;
    }

    // If we already have events for this generation, just reconnect
    if (this.gen.generationId() === id && this.gen.events().length > 0) {
      this.gen.reconnectIfNeeded(id);
    } else {
      // Verify the generation exists on the backend before connecting
      this.gen.getStatus(id).subscribe({
        next: (status) => {
          if (status.status === 'complete' && status.modlist_id) {
            // Already done — redirect to the modlist
            this.router.navigate(['/modlist', status.modlist_id], { replaceUrl: true });
          } else {
            this.gen.reconnectIfNeeded(id);
          }
        },
        error: () => {
          this.generationNotFound.set(true);
        },
      });
    }

    this.api.getLlmProviders().subscribe({
      next: (p) => this.providers.set(p),
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    // Don't disconnect — let the service persist across navigation.
    // Only disconnect on terminal states to free resources.
    const status = this.gen.status();
    if (status === 'complete' || status === 'error') {
      this.gen.disconnectEvents();
    }
  }

  ngAfterViewChecked(): void {
    const el = this.timelineEl?.nativeElement;
    if (!el) return;

    const evtCount = this.gen.events().length;
    if (evtCount > this.prevEventCount && this.shouldAutoScroll) {
      el.scrollTop = el.scrollHeight;
      this.prevEventCount = evtCount;
    }

    // Track if user has scrolled up
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    this.userAtBottom.set(atBottom);
    if (atBottom) {
      this.shouldAutoScroll = true;
    }

    // Auto-collapse completed phases after a brief delay
    for (const item of this.timelineItems()) {
      if (item.isHeader && item.phaseComplete && !this.autoCollapsedPhases.has(item.phase)) {
        this.autoCollapsedPhases.add(item.phase);
        const phaseNum = item.phase;
        setTimeout(() => {
          this.collapsedPhases.update(s => new Set([...s, phaseNum]));
        }, 1200);
      }
    }
  }

  scrollToBottom(): void {
    const el = this.timelineEl?.nativeElement;
    if (el) {
      this.shouldAutoScroll = true;
      el.scrollTop = el.scrollHeight;
    }
  }

  resume(): void {
    const id = this.gen.generationId();
    if (!id) return;
    this.resuming.set(true);
    this.gen.resumeGeneration(id).subscribe({
      next: () => {
        this.resuming.set(false);
        this.gen.connectToEvents(id);
      },
      error: (err) => {
        this.resuming.set(false);
        this.notifications.error(err.error?.detail || 'Resume failed');
      },
    });
  }

  downloadLog(): void {
    const genId = this.gen.generationId();
    if (!genId) return;
    this.api.getGenerationLog(genId).subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generation-${genId.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.notifications.error('Failed to download generation log');
      },
    });
  }

  updateKeyAndResume(): void {
    if (!this.apiKeyInput) return;
    this.resuming.set(true);

    // Auto-detect provider from key prefix pattern
    const detection = detectProvider(this.apiKeyInput.trim(), this.providers());
    const providerKey = detection?.providerId ?? 'unknown';

    this.api.saveLlmKeys({ [providerKey]: this.apiKeyInput }).subscribe({
      next: () => {
        this.apiKeyInput = '';
        this.resume();
      },
      error: () => {
        this.resuming.set(false);
        this.notifications.error('Failed to save API key');
      },
    });
  }

  /** Lookup the lucide icon name for an SSE event type. See EVENT_ICONS map. */
  iconNameFor(evt: GenerationEvent): string {
    return (EVENT_ICONS[evt.type] ?? FALLBACK_EVENT_ICON).name;
  }

  /** Color CSS class (icon-gold / icon-green / etc.) for an SSE event type. */
  iconClassFor(evt: GenerationEvent): string {
    return (EVENT_ICONS[evt.type] ?? FALLBACK_EVENT_ICON).cls;
  }

  formatGB(bytes: number): string {
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }
}
