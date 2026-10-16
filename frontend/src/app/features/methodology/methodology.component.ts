import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Check,
  Eye,
  Info,
  Star,
} from 'lucide-angular';
// Direct primitive imports — same pattern Tasks 5-11 adopted.
import { UiButtonComponent } from '../../shared/components/ui/button.component';

@Component({
  selector: 'app-methodology',
  standalone: true,
  imports: [RouterLink, LucideAngularModule, UiButtonComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Check,
        Eye,
        Info,
        Star,
      }),
    },
  ],
  template: `
    <div class="methodology-page">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-badge">Transparency</div>
        <h1 class="hero-title">How We Build Your Modlist</h1>
        <p class="hero-subtitle">
          An honest look at how ModdersOmni selects mods, checks its own work,
          and what it costs you to run.
        </p>
      </section>

      <!-- Table of Contents -->
      <nav class="toc">
        <a href="#pipeline" class="toc-link" (click)="scrollTo($event, 'pipeline')">The Pipeline</a>
        <span class="toc-dot"></span>
        <a href="#review" class="toc-link" (click)="scrollTo($event, 'review')">Overseer Review</a>
        <span class="toc-dot"></span>
        <a href="#quality" class="toc-link" (click)="scrollTo($event, 'quality')">Model Quality</a>
        <span class="toc-dot"></span>
        <a href="#cost" class="toc-link" (click)="scrollTo($event, 'cost')">Costs</a>
        <span class="toc-dot"></span>
        <a href="#free" class="toc-link" (click)="scrollTo($event, 'free')">Free to Use</a>
      </nav>

      <!-- Section 1: Pipeline Overview -->
      <section id="pipeline" class="content-section">
        <div class="section-label font-mono">01</div>
        <h2 class="section-title">The Phased Pipeline</h2>
        <p class="section-intro">
          Instead of asking an AI to generate an entire modlist in one shot (which produces
          generic, low-quality results), we break the build into specialized phases. Each phase
          focuses on a specific category, giving the AI time to search, evaluate, and reason
          about compatibility within that domain. Skyrim builds run the 10 phases below;
          Fallout 4 builds run a similar set of 9.
        </p>

        <div class="pipeline-grid">
          @for (phase of phases; track phase.name; let i = $index) {
            <div class="phase-card stagger-item">
              <div class="phase-number font-mono">{{ (i + 1).toString().padStart(2, '0') }}</div>
              <div class="phase-info">
                <span class="phase-name">{{ phase.name }}</span>
                <span class="phase-complexity" [class]="'complexity-' + phase.complexity">
                  {{ phase.label }}
                </span>
              </div>
              <p class="phase-desc">{{ phase.description }}</p>
            </div>
          }
        </div>

        <div class="callout">
          <div class="callout-icon">
            <lucide-icon name="info" [size]="20" [strokeWidth]="1.5"></lucide-icon>
          </div>
          <div class="callout-text">
            <strong>Why phases matter:</strong> A single prompt asking for "100 mods for Skyrim"
            produces lists heavy on popular picks with poor load ordering. Our phased approach
            lets the AI search Nexus Mods in real time, read mod descriptions, check compatibility
            notes, and reason about each category independently — producing modlists that
            actually work together.
          </div>
        </div>
      </section>

      <!-- Section 2: Overseer Review -->
      <section id="review" class="content-section">
        <div class="section-label font-mono">02</div>
        <h2 class="section-title">A Second Opinion on Every Phase</h2>
        <p class="section-intro">
          After each phase, a separate overseer pass reviews the mods that were just added.
          It starts fresh, without the builder's search history, so it judges the picks on
          their merits instead of defending them.
        </p>

        <div class="dispatch-visual">
          <div class="dispatch-tiers">
            @for (step of reviewSteps; track step.name) {
              <div class="tier-card stagger-item" [class]="'tier-' + step.level">
                <div class="tier-header">
                  <span class="tier-badge" [class]="'badge-' + step.level">{{ step.badge }}</span>
                  <span class="tier-name">{{ step.name }}</span>
                </div>
                <p class="tier-desc">{{ step.description }}</p>
              </div>
            }
          </div>
        </div>

        <div class="callout callout-gold">
          <div class="callout-icon">
            <lucide-icon name="star" [size]="20" [strokeWidth]="1.5"></lucide-icon>
          </div>
          <div class="callout-text">
            <strong>Reviews never break your build.</strong> If the overseer errors out or
            returns something unreadable, the modlist is left exactly as it was. It is told
            that a wrong rejection is worse than a wrong approval, so it only removes mods
            it is confident about.
          </div>
        </div>

        <div class="transparency-box">
          <h3 class="transparency-title">
            <lucide-icon name="eye" [size]="18" [strokeWidth]="1.5"></lucide-icon>
            What you see during generation
          </h3>
          <p class="transparency-desc">
            Every search, every mod page the AI reads, and every mod it adds shows up in a
            live timeline as it happens. If your provider rate-limits or errors, the build
            pauses with its progress saved so you can switch keys and resume.
          </p>
          <div class="event-examples">
            <div class="event-example">
              <span class="event-label font-mono">searching</span>
              <span class="event-detail">"Searching Nexus: weather overhaul"</span>
            </div>
            <div class="event-example">
              <span class="event-label font-mono">mod_added</span>
              <span class="event-detail">"Added Cathedral Weathers (Lighting &amp; Weather)"</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Model Quality Differences -->
      <section id="quality" class="content-section">
        <div class="section-label font-mono">03</div>
        <h2 class="section-title">What "Better" Actually Means</h2>
        <p class="section-intro">
          You pick which model builds your list. We want to be honest about where premium
          AI models make a real difference versus where they're overkill. Not every phase
          benefits equally from a more expensive model.
        </p>

        <div class="quality-grid">
          <div class="quality-card stagger-item quality-high">
            <h3 class="quality-heading">Where Premium Models Shine</h3>
            <p class="quality-context">These phases involve complex reasoning about mod interactions,
              playstyle interpretation, and conflict resolution.</p>
            <ul class="quality-list">
              <li>
                <strong>Gameplay &amp; Combat</strong> — Understanding the difference between
                "immersive survival" and "action RPG" requires nuanced interpretation of your
                preferences to select matching overhauls.
              </li>
              <li>
                <strong>Compatibility Patches</strong> — Identifying which mods conflict and
                finding the right patches requires reading multiple mod descriptions and reasoning
                about load order dependencies.
              </li>
              <li>
                <strong>Quest Content</strong> — Evaluating quest mods for quality, lore
                consistency, and compatibility with gameplay overhauls benefits from stronger reasoning.
              </li>
              <li>
                <strong>Curated Picks</strong> — Premium models are better at surfacing
                lesser-known, high-quality mods instead of just recommending the
                most-endorsed options everyone already knows.
              </li>
            </ul>
          </div>

          <div class="quality-card stagger-item quality-low">
            <h3 class="quality-heading">Where Budget Models Do Fine</h3>
            <p class="quality-context">These phases involve well-known mods where the "correct" choice
              is relatively obvious regardless of model quality.</p>
            <ul class="quality-list">
              <li>
                <strong>Essentials &amp; Bug Fixes</strong> — SKSE, USSEP, Engine Fixes —
                these are the same picks regardless of which AI model you use.
              </li>
              <li>
                <strong>UI Improvements</strong> — SkyUI, TrueHUD, and similar must-have
                UI mods are well-established consensus picks.
              </li>
              <li>
                <strong>Textures</strong> — Texture pack selection is mostly about VRAM budget
                (which we calculate from your hardware specs), not nuanced reasoning.
              </li>
              <li>
                <strong>Audio</strong> — Sound and music mods are largely
                preference-agnostic. The top options are well-endorsed and compatible.
              </li>
            </ul>
          </div>
        </div>

        <div class="honesty-box">
          <h3 class="honesty-title">Our honest take</h3>
          <p>
            For the first ~50 mods (essentials, UI, textures, bug fixes), you'll get a solid
            modlist from any model — free or premium. The quality difference shows most when
            building larger, more complex lists where mod interactions compound. If you're just
            building a lightweight setup, a free model is genuinely fine. We'd rather be honest
            about this than push you toward expensive models.
          </p>
        </div>
      </section>

      <!-- Section 4: Costs -->
      <section id="cost" class="content-section">
        <div class="section-label font-mono">04</div>
        <h2 class="section-title">What It Costs</h2>
        <p class="section-intro">
          ModdersOmni has no servers in the middle. Your browser talks to your AI provider
          directly, using your key, so the only cost is what that provider charges you.
        </p>

        <div class="cost-details">
          <div class="cost-detail stagger-item">
            <div class="cost-detail-label">What you pay for</div>
            <p>
              Providers bill per token. Output tokens usually cost several times more than input
              tokens. Larger size presets run more searches and add more mods, so they use
              more tokens.
            </p>
          </div>
          <div class="cost-detail stagger-item">
            <div class="cost-detail-label">Why costs vary</div>
            <p>
              A build that requires more Nexus searches (e.g., niche playstyles) uses more tokens
              than one with well-known mod categories. The compatibility patch phase can vary
              significantly based on how many potential conflicts exist in your modlist.
            </p>
          </div>
          <div class="cost-detail stagger-item">
            <div class="cost-detail-label">Keeping it cheap</div>
            <p>
              Start with a small or medium size preset and a fast, low-cost model. Or use a
              provider's free tier, or a local Ollama model, and pay nothing at all.
            </p>
          </div>
        </div>
      </section>

      <!-- Section 5: Free to Use -->
      <section id="free" class="content-section">
        <div class="section-label font-mono">05</div>
        <h2 class="section-title">Free to Use</h2>
        <p class="section-intro">
          ModdersOmni itself is free and open source. There are no accounts, no paid tiers,
          and no paywalled features.
        </p>

        <div class="free-tier-grid">
          <div class="free-card stagger-item">
            <div class="free-card-icon">
              <lucide-icon name="check" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h3>No account needed</h3>
            <p>Your keys, hardware specs and modlists are saved in this browser only.
              Nothing is uploaded to us.</p>
          </div>
          <div class="free-card stagger-item">
            <div class="free-card-icon">
              <lucide-icon name="check" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h3>Free AI options</h3>
            <p>Groq, Gemini and OpenRouter offer free tiers, and Ollama runs models on your own
              machine. Any of them can build a complete modlist.</p>
          </div>
          <div class="free-card stagger-item">
            <div class="free-card-icon">
              <lucide-icon name="check" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h3>Every size, every feature</h3>
            <p>All size presets, the overseer review, and the Mod Organizer 2 import plugin are
              available to everyone.</p>
          </div>
          <div class="free-card stagger-item">
            <div class="free-card-icon">
              <lucide-icon name="check" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h3>No limits from us</h3>
            <p>Generate as many modlists as you like. The only limits are your AI provider's
              own rate limits.</p>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta-section">
        <h2 class="cta-title">Ready to build?</h2>
        <p class="cta-subtitle">Add an AI key and have a modlist in minutes.</p>
        <div class="cta-actions">
          <a ui-button variant="primary" size="lg" routerLink="/setup">Start Building</a>
          <a ui-button variant="secondary" size="lg" routerLink="/settings">Add an AI Key</a>
        </div>
      </section>
    </div>
  `,
  styles: [`
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .methodology-page {
      max-width: 820px;
      margin: 0 auto;
      padding: 3rem 2rem 6rem;
    }
    .methodology-page > section,
    .methodology-page > nav {
      animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .methodology-page > section:nth-child(1) { animation-delay: 0s; }
    .methodology-page > nav:nth-child(2) { animation-delay: 0.08s; }
    .methodology-page > section:nth-child(3) { animation-delay: 0.16s; }
    .methodology-page > section:nth-child(4) { animation-delay: 0.24s; }
    .methodology-page > section:nth-child(5) { animation-delay: 0.32s; }
    .methodology-page > section:nth-child(6) { animation-delay: 0.4s; }
    .methodology-page > section:nth-child(7) { animation-delay: 0.48s; }

    /* Hero */
    .hero {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2.5rem;
      border-bottom: 1px solid var(--color-border);
    }
    .hero-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-accent);
      background: color-mix(in oklch, var(--color-accent) 10%, transparent);
      border: 1px solid color-mix(in oklch, var(--color-accent) 20%, transparent);
      padding: 0.25rem 0.75rem;
      border-radius: 100px;
      margin-bottom: 1.25rem;
    }
    .hero-title {
      font-family: var(--font-display);
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, var(--color-text) 30%, var(--color-accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-subtitle {
      font-size: 1.0625rem;
      color: var(--color-text-muted);
      line-height: 1.7;
      max-width: 580px;
      margin: 0 auto;
    }

    /* Table of Contents */
    .toc {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin-bottom: 4rem;
      flex-wrap: wrap;
    }
    .toc-link {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      transition: color 0.15s;
    }
    .toc-link:hover { color: var(--color-accent); }
    .toc-dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--color-text-dim);
    }

    /* Section Layout */
    .content-section {
      margin-bottom: 5rem;
    }
    .section-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-accent);
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .section-title {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }
    .section-intro {
      font-size: 1rem;
      color: var(--color-text-muted);
      line-height: 1.75;
      margin-bottom: 2rem;
    }

    /* Pipeline Grid */
    .pipeline-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .phase-card {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1rem;
      transition: border-color 0.2s;
    }
    .phase-card:hover {
      border-color: var(--color-border);
    }
    .phase-number {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--color-text-dim);
      font-variant-numeric: tabular-nums;
      margin-bottom: 0.375rem;
    }
    .phase-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.375rem;
    }
    .phase-name {
      font-size: 0.875rem;
      font-weight: 600;
    }
    .phase-complexity {
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
    }
    .complexity-low {
      color: #22c55e;
      background: rgba(34, 197, 94, 0.1);
    }
    .complexity-medium {
      color: #eab308;
      background: rgba(234, 179, 8, 0.1);
    }
    .complexity-high {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
    .phase-desc {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      line-height: 1.5;
    }

    /* Callout */
    .callout {
      display: flex;
      gap: 0.875rem;
      padding: 1.25rem;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      margin-bottom: 2rem;
    }
    .callout-gold {
      border-color: color-mix(in oklch, var(--color-accent) 20%, transparent);
      background: color-mix(in oklch, var(--color-accent) 4%, transparent);
    }
    .callout-icon {
      flex-shrink: 0;
      color: var(--color-text-muted);
      margin-top: 2px;
    }
    .callout-gold .callout-icon { color: var(--color-accent); }
    .callout-text {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      line-height: 1.65;
    }
    .callout-text strong {
      color: var(--color-text);
    }

    /* Dispatch Tiers */
    .dispatch-tiers {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .tier-card {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      transition: border-color 0.2s;
    }
    .tier-card:hover { border-color: var(--color-border); }
    .tier-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.625rem;
    }
    .tier-badge {
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
    }
    .badge-budget {
      color: #22c55e;
      background: rgba(34, 197, 94, 0.12);
    }
    .badge-standard {
      color: #eab308;
      background: rgba(234, 179, 8, 0.12);
    }
    .badge-premium {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.12);
    }
    .tier-name {
      font-size: 0.9375rem;
      font-weight: 600;
    }
    .tier-desc {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.55;
      margin-bottom: 0.75rem;
    }
    .tier-phases {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .tier-phase-label {
      font-size: 0.6875rem;
      color: var(--color-text-dim);
      font-weight: 500;
    }
    .tier-phase-tag {
      font-size: 0.6875rem;
      color: var(--color-text-muted);
      background: var(--color-surface-2);
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }
    .tier-cost {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.625rem;
      border-top: 1px solid var(--color-border);
    }
    .tier-cost-label {
      font-size: 0.6875rem;
      color: var(--color-text-dim);
    }
    .tier-cost-value {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-accent);
      font-variant-numeric: tabular-nums;
    }

    /* Transparency Box */
    .transparency-box {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .transparency-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--color-text);
    }
    .transparency-desc {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      line-height: 1.65;
      margin-bottom: 1rem;
    }
    .event-examples {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .event-example {
      display: flex;
      gap: 0.75rem;
      padding: 0.625rem 0.875rem;
      background: var(--color-surface-2);
      border-radius: var(--radius-sm);
      font-size: 0.8125rem;
      align-items: baseline;
    }
    .event-label {
      flex-shrink: 0;
      font-weight: 600;
      color: var(--color-accent);
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
      font-size: 0.75rem;
    }
    .event-detail {
      color: var(--color-text-muted);
      font-style: italic;
    }

    /* Quality Grid */
    .quality-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    @media (max-width: 640px) {
      .quality-grid { grid-template-columns: 1fr; }
    }
    .quality-card {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
    }
    .quality-high { border-top: 2px solid rgba(239, 68, 68, 0.4); }
    .quality-low { border-top: 2px solid rgba(34, 197, 94, 0.4); }
    .quality-heading {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
    }
    .quality-context {
      font-size: 0.8125rem;
      color: var(--color-text-dim);
      margin-bottom: 1rem;
      line-height: 1.5;
    }
    .quality-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .quality-list li {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.6;
      padding-left: 1rem;
      position: relative;
    }
    .quality-list li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.5em;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--color-text-dim);
    }
    .quality-list li strong {
      color: var(--color-text);
    }

    /* Honesty Box */
    .honesty-box {
      background: color-mix(in oklch, var(--color-accent) 4%, transparent);
      border: 1px solid color-mix(in oklch, var(--color-accent) 15%, transparent);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
    }
    .honesty-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-accent);
      margin-bottom: 0.625rem;
    }
    .honesty-box p {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      line-height: 1.7;
    }

    /* Cost Table */
    .cost-table-wrapper {
      overflow-x: auto;
      margin-bottom: 2rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
    }
    .cost-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }
    .cost-table th {
      text-align: left;
      padding: 0.75rem 1rem;
      font-weight: 600;
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-dim);
      background: var(--color-surface-1);
      border-bottom: 1px solid var(--color-border);
    }
    .cost-table td {
      padding: 0.75rem 1rem;
      color: var(--color-text-muted);
      border-bottom: 1px solid var(--color-border);
    }
    .cost-table tr:last-child td { border-bottom: none; }
    .build-badge {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }
    .build-small { color: #22c55e; background: rgba(34, 197, 94, 0.1); }
    .build-medium { color: #eab308; background: rgba(234, 179, 8, 0.1); }
    .build-large { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

    /* Cost Details */
    .cost-details {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 1rem;
    }
    .cost-detail {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
    }
    .cost-detail-label {
      font-size: 0.8125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .cost-detail p {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.6;
    }

    /* Free Tier Grid */
    .free-tier-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 640px) {
      .free-tier-grid { grid-template-columns: 1fr; }
    }
    .free-card {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
    }
    .free-card-icon {
      color: var(--color-success);
      margin-bottom: 0.625rem;
    }
    .free-card h3 {
      font-size: 0.9375rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
    }
    .free-card p {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.55;
    }

    /* CTA */
    .cta-section {
      text-align: center;
      padding: 3rem 0;
      border-top: 1px solid var(--color-border);
    }
    .cta-title {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .cta-subtitle {
      font-size: 1rem;
      color: var(--color-text-muted);
      margin-bottom: 1.5rem;
    }
    .cta-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
    }
    /* CTA buttons now use the shared ui-button primitive (variant=primary|secondary).
       Keeping .cta-actions for layout only — the button styling lives in the primitive. */
  `],
})
export class MethodologyComponent {
  /** Mirrors public/data/build-phases.skyrim.json. Colour shows what drives the picks. */
  phases = [
    { name: 'Essentials & Frameworks', complexity: 'low', label: 'core', description: 'Script extenders, engine fixes and the frameworks other mods depend on (SKSE, USSEP, etc.)' },
    { name: 'UI & Interface', complexity: 'low', label: 'core', description: 'Inventory, HUD, map and mod-configuration menus' },
    { name: 'Fixes & Bug Patches', complexity: 'low', label: 'core', description: 'Stability patches and engine-level fixes beyond the unofficial patch' },
    { name: 'Foundation Textures & Meshes', complexity: 'medium', label: 'hardware', description: 'Landscape, architecture and gear textures sized to your VRAM' },
    { name: 'Animation & Physics', complexity: 'high', label: 'playstyle', description: 'Skeleton, movement and combat animations, and physics' },
    { name: 'Audio', complexity: 'low', label: 'core', description: 'Sound overhauls, ambient audio, and music' },
    { name: 'Gameplay & Playstyle', complexity: 'high', label: 'playstyle', description: 'Combat, skills, survival and economy mods matched to how you play' },
    { name: 'Locations & World', complexity: 'high', label: 'playstyle', description: 'City overhauls, town expansions and new places to explore' },
    { name: 'Lighting & Weather', complexity: 'medium', label: 'hardware', description: 'Weather, interior lighting, and an ENB only if your GPU can take it' },
    { name: 'Compatibility Patches', complexity: 'medium', label: 'review', description: 'Reviews the whole list and finds patches for mods that touch the same systems' },
  ];

  reviewSteps = [
    {
      name: 'Build',
      level: 'standard',
      badge: 'step 1',
      description: 'Your chosen model searches Nexus Mods, reads mod pages and adds the best fits for the phase.',
    },
    {
      name: 'Phase review',
      level: 'standard',
      badge: 'step 2',
      description: 'The overseer checks the new additions for conflicts, duplicates and poor fits, then approves, flags or rejects each one.',
    },
    {
      name: 'Final review',
      level: 'standard',
      badge: 'step 3',
      description: 'Once every phase is done, a last pass looks at the whole list together for cross-phase problems.',
    },
  ];

  scrollTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
