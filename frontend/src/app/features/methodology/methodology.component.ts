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
          An honest look at how ModdersOmni selects mods, routes AI models,
          and works to minimize your costs while maximizing quality.
        </p>
      </section>

      <!-- Table of Contents -->
      <nav class="toc">
        <a href="#pipeline" class="toc-link" (click)="scrollTo($event, 'pipeline')">The Pipeline</a>
        <span class="toc-dot"></span>
        <a href="#smart-dispatch" class="toc-link" (click)="scrollTo($event, 'smart-dispatch')">Smart Dispatch</a>
        <span class="toc-dot"></span>
        <a href="#quality" class="toc-link" (click)="scrollTo($event, 'quality')">Model Quality</a>
        <span class="toc-dot"></span>
        <a href="#cost" class="toc-link" (click)="scrollTo($event, 'cost')">Cost Breakdown</a>
        <span class="toc-dot"></span>
        <a href="#free-tier" class="toc-link" (click)="scrollTo($event, 'free-tier')">Free Tier</a>
      </nav>

      <!-- Section 1: Pipeline Overview -->
      <section id="pipeline" class="content-section">
        <div class="section-label font-mono">01</div>
        <h2 class="section-title">The 13-Phase Pipeline</h2>
        <p class="section-intro">
          Instead of asking an AI to generate an entire modlist in one shot (which produces
          generic, low-quality results), we break the build into specialized phases. Each phase
          focuses on a specific category, giving the AI time to search, evaluate, and reason
          about compatibility within that domain.
        </p>

        <div class="pipeline-grid">
          @for (phase of phases; track phase.name; let i = $index) {
            <div class="phase-card stagger-item">
              <div class="phase-number font-mono">{{ (i + 1).toString().padStart(2, '0') }}</div>
              <div class="phase-info">
                <span class="phase-name">{{ phase.name }}</span>
                <span class="phase-complexity" [class]="'complexity-' + phase.complexity">
                  {{ phase.complexity }}
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

      <!-- Section 2: Smart Dispatch -->
      <section id="smart-dispatch" class="content-section">
        <div class="section-label font-mono">02</div>
        <h2 class="section-title">Smart Dispatch: Saving You Money</h2>
        <p class="section-intro">
          Not every phase needs the most expensive AI model. Our Smart Dispatcher automatically
          routes each phase to the most cost-effective model that can handle its complexity —
          so you only pay premium prices when premium reasoning actually matters.
        </p>

        <div class="dispatch-visual">
          <div class="dispatch-tiers">
            @for (tier of dispatchTiers; track tier.name) {
              <div class="tier-card stagger-item" [class]="'tier-' + tier.level">
                <div class="tier-header">
                  <span class="tier-badge" [class]="'badge-' + tier.level">{{ tier.level }}</span>
                  <span class="tier-name">{{ tier.name }}</span>
                </div>
                <p class="tier-desc">{{ tier.description }}</p>
                <div class="tier-phases">
                  <span class="tier-phase-label">Used for:</span>
                  @for (p of tier.phases; track p) {
                    <span class="tier-phase-tag">{{ p }}</span>
                  }
                </div>
                <div class="tier-cost">
                  <span class="tier-cost-label">Approx. cost</span>
                  <span class="tier-cost-value">{{ tier.cost }}</span>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="callout callout-gold">
          <div class="callout-icon">
            <lucide-icon name="star" [size]="20" [strokeWidth]="1.5"></lucide-icon>
          </div>
          <div class="callout-text">
            <strong>Your keys take priority.</strong> If you bring your own API keys (BYOK),
            we'll always use those first — at no server cost. Smart Dispatch only
            uses server-side free models when you don't have a suitable key
            for the phase's complexity level.
          </div>
        </div>

        <div class="transparency-box">
          <h3 class="transparency-title">
            <lucide-icon name="eye" [size]="18" [strokeWidth]="1.5"></lucide-icon>
            What you see during generation
          </h3>
          <p class="transparency-desc">
            Every generation shows you exactly which model handles each phase, why it was chosen,
            and how many tokens it used. We emit real-time events so you can
            watch the routing decisions as they happen — no hidden costs.
          </p>
          <div class="event-examples">
            <div class="event-example">
              <span class="event-label font-mono">dispatch_strategy</span>
              <span class="event-detail">"Using your BYOK keys for generation phases"</span>
            </div>
            <div class="event-example">
              <span class="event-label font-mono">model_selected</span>
              <span class="event-detail">"Phase: Gameplay Overhaul → Claude Sonnet (premium) — complex phase needs strong reasoning"</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Model Quality Differences -->
      <section id="quality" class="content-section">
        <div class="section-label font-mono">03</div>
        <h2 class="section-title">What "Better" Actually Means</h2>
        <p class="section-intro">
          We want to be honest about where premium AI models make a real difference
          versus where they're overkill. Not every phase benefits equally from a
          more expensive model.
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
            building a lightweight setup, the free tier is genuinely fine. We'd rather be honest
            about this than oversell premium tiers.
          </p>
        </div>
      </section>

      <!-- Section 4: Cost Breakdown -->
      <section id="cost" class="content-section">
        <div class="section-label font-mono">04</div>
        <h2 class="section-title">Cost Breakdown</h2>
        <p class="section-intro">
          Generation cost depends on which AI model is used for each phase.
        </p>

        <p class="cost-note">
          Free-tier generations use server-hosted models (Gemini Flash, Groq, Cerebras)
          at no cost to you. BYOK users consume their own provider quota.
        </p>

        <div class="cost-details">
          <div class="cost-detail stagger-item">
            <div class="cost-detail-label">How tokens convert to credits</div>
            <p>
              Output tokens cost ~3x input tokens (they're harder to generate). We apply
              per-model rates: budget models ≈ $0.50/M tokens, standard ≈ $2/M, premium ≈ $8/M.
              Smart Dispatch minimizes cost by using cheaper models where they're sufficient.
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
            <div class="cost-detail-label">BYOK savings</div>
            <p>
              Bringing your own API keys means zero credit cost for those phases. If you have
              keys for Anthropic + Groq, for example, Smart Dispatch routes premium phases
              to your Claude key and budget phases to Groq — all at no credit cost to you.
            </p>
          </div>
        </div>
      </section>

      <!-- Section 5: Free Tier -->
      <section id="free-tier" class="content-section">
        <div class="section-label font-mono">05</div>
        <h2 class="section-title">The Free Tier Is Real</h2>
        <p class="section-intro">
          Free tier modlists use free AI models that cost us nothing to run.
          We're not losing money on free users — so there's no catch, no
          bait-and-switch, and no artificial degradation.
        </p>

        <div class="free-tier-grid">
          <div class="free-card stagger-item">
            <div class="free-card-icon">
              <lucide-icon name="check" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h3>Up to ~50 mods</h3>
            <p>Enough for a solid essentials + textures + UI setup. Perfect for trying the app
              or building lightweight modlists.</p>
          </div>
          <div class="free-card stagger-item">
            <div class="free-card-icon">
              <lucide-icon name="check" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h3>Same search quality</h3>
            <p>Free models search the same Nexus Mods database with the same tools. They find
              the same mods — just with less nuanced selection for complex phases.</p>
          </div>
          <div class="free-card stagger-item">
            <div class="free-card-icon">
              <lucide-icon name="check" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h3>Public modlists</h3>
            <p>Every modlist — free or premium — is publicly viewable. We never paywall content.
              Paid tiers unlock larger lists and one-click install via mod manager plugins.</p>
          </div>
          <div class="free-card stagger-item">
            <div class="free-card-icon">
              <lucide-icon name="check" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <h3>No time limits</h3>
            <p>Generate as many free-tier modlists as you want. No daily caps, no trial period,
              no "free for 7 days" tricks.</p>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta-section">
        <h2 class="cta-title">Ready to build?</h2>
        <p class="cta-subtitle">Start with the free tier. Upgrade if you want more.</p>
        <div class="cta-actions">
          <a ui-button variant="primary" size="lg" routerLink="/setup">Start Building</a>
          <a ui-button variant="secondary" size="lg" routerLink="/auth/register">Create Account</a>
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
      color: var(--color-gold);
      background: rgba(196, 165, 90, 0.1);
      border: 1px solid rgba(196, 165, 90, 0.2);
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
      background: linear-gradient(135deg, var(--color-text) 30%, var(--color-gold) 100%);
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
    .toc-link:hover { color: var(--color-gold); }
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
      color: var(--color-gold);
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
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1rem;
      transition: border-color 0.2s;
    }
    .phase-card:hover {
      border-color: var(--color-border-hover);
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
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      margin-bottom: 2rem;
    }
    .callout-gold {
      border-color: rgba(196, 165, 90, 0.2);
      background: rgba(196, 165, 90, 0.04);
    }
    .callout-icon {
      flex-shrink: 0;
      color: var(--color-text-muted);
      margin-top: 2px;
    }
    .callout-gold .callout-icon { color: var(--color-gold); }
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
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      transition: border-color 0.2s;
    }
    .tier-card:hover { border-color: var(--color-border-hover); }
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
      background: var(--color-bg-elevated);
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
      color: var(--color-gold);
      font-variant-numeric: tabular-nums;
    }

    /* Transparency Box */
    .transparency-box {
      background: var(--color-bg-card);
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
      background: var(--color-bg-elevated);
      border-radius: var(--radius-sm);
      font-size: 0.8125rem;
      align-items: baseline;
    }
    .event-label {
      flex-shrink: 0;
      font-weight: 600;
      color: var(--color-gold);
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
      background: var(--color-bg-card);
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
      background: rgba(196, 165, 90, 0.04);
      border: 1px solid rgba(196, 165, 90, 0.15);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
    }
    .honesty-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-gold);
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
      background: var(--color-bg-card);
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
      background: var(--color-bg-card);
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
      background: var(--color-bg-card);
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
  phases = [
    { name: 'Essentials', complexity: 'low', description: 'Core frameworks and must-have utilities (SKSE, USSEP, etc.)' },
    { name: 'UI Improvements', complexity: 'low', description: 'HUD, menus, inventory, and quality-of-life interface mods' },
    { name: 'Bug Fixes', complexity: 'low', description: 'Stability patches and engine-level fixes beyond the unofficial patch' },
    { name: 'Textures', complexity: 'low', description: 'Visual overhauls matched to your VRAM budget' },
    { name: 'Lighting & Weather', complexity: 'medium', description: 'ENB presets, weather systems, and interior lighting matched to your GPU' },
    { name: 'Environment', complexity: 'medium', description: 'Landscape, flora, water, and world-space visual improvements' },
    { name: 'Audio', complexity: 'medium', description: 'Sound overhauls, ambient audio, and music replacements' },
    { name: 'Animations', complexity: 'medium', description: 'Movement, combat animations, and character behavior' },
    { name: 'Gameplay Overhaul', complexity: 'high', description: 'Core gameplay systems tailored to your playstyle preferences' },
    { name: 'Combat', complexity: 'high', description: 'Combat mechanics, enemy AI, and difficulty tuned to your style' },
    { name: 'Quests & Content', complexity: 'high', description: 'New quests, locations, and story content that fit your build' },
    { name: 'Followers & NPCs', complexity: 'medium', description: 'NPC overhauls, followers, and character enhancements' },
    { name: 'Compatibility Patches', complexity: 'high', description: 'Conflict resolution, load order fixes, and inter-mod patches' },
  ];

  dispatchTiers = [
    {
      name: 'Budget Models',
      level: 'budget',
      description: 'Fast, cost-effective models for straightforward phases where the "right" mods are well-established.',
      phases: ['Essentials', 'UI', 'Textures', 'Bug Fixes'],
      cost: '~$0.50/M tokens',
    },
    {
      name: 'Standard Models',
      level: 'standard',
      description: 'Balanced models for phases that need some reasoning about hardware compatibility and preferences.',
      phases: ['Lighting', 'Environment', 'Audio', 'Animations', 'Followers'],
      cost: '~$2/M tokens',
    },
    {
      name: 'Premium Models',
      level: 'premium',
      description: 'Strongest reasoning for complex phases involving mod interactions, playstyle interpretation, and conflict resolution.',
      phases: ['Gameplay', 'Combat', 'Quests', 'Compatibility'],
      cost: '~$8/M tokens',
    },
  ];

  scrollTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
