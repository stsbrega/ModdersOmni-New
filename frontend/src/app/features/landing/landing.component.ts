import { Component, signal, inject, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  ArrowRight,
  Monitor,
  SlidersHorizontal,
  Star,
  Shield,
  Cpu,
  Download,
  LayoutGrid,
  Settings,
  Folder,
  Tag,
} from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
// Import primitives directly (not via the shared/components/ui barrel) so we
// don't drag in sibling primitives for type-checking. dialog.component.ts and
// select.component.ts have unrelated TS errors carried over from Task 4 that
// would otherwise break this feature's production build. Switch to the
// barrel import once those are resolved (tracked separately).
import { UiButtonComponent } from '../../shared/components/ui/button.component';
import { UiCardComponent } from '../../shared/components/ui/card.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent, LucideAngularModule, UiButtonComponent, UiCardComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ArrowRight,
        Monitor,
        SlidersHorizontal,
        Star,
        Shield,
        Cpu,
        Download,
        LayoutGrid,
        Settings,
        Folder,
        Tag,
      }),
    },
  ],
  animations: [
    trigger('fadeUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(24px)' }),
        animate('600ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('staggerIn', [
      transition(':enter', [
        query('.stagger-item', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger(100, [
            animate('500ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
  ],
  template: `
    <!-- Sticky Navbar -->
    <nav class="navbar" [class.scrolled]="scrolled()">
      <div class="nav-container">
        <a routerLink="/" class="nav-logo">
          <app-brand-logo></app-brand-logo>
        </a>
        <div class="nav-links">
          <a href="#features" class="nav-link" (click)="scrollTo($event, 'features')">Features</a>
          <a href="#how-it-works" class="nav-link" (click)="scrollTo($event, 'how-it-works')">How It Works</a>
        </div>
        <div class="nav-actions">
          @if (authService.isLoggedIn()) {
            <a ui-button variant="primary" size="sm" routerLink="/dashboard">Dashboard</a>
          } @else {
            <a routerLink="/auth/login" class="nav-link nav-signin">Sign In</a>
            <a ui-button variant="primary" size="sm" routerLink="/auth/register">Sign Up</a>
          }
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-grain"></div>
      <div class="hero-glow hero-glow--gold"></div>
      <div class="hero-glow hero-glow--blue"></div>

      <!-- Animated Nexus Background -->
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

      <div class="hero-content" @fadeUp>
        <div class="hero-badge">
          <span class="badge-dot"></span>
          AI-Powered Modding Assistant
        </div>
        <h1 class="hero-title">
          Your Perfect Modlist,<br>
          <span class="hero-title-accent">Built by AI</span>
        </h1>
        <p class="hero-subtitle">
          Tell us your hardware and playstyle. Our AI generates a stable,<br>
          compatible mod list tailored specifically for your setup.
        </p>
        <div class="hero-actions">
          <a ui-button variant="primary" size="lg" routerLink="/setup">
            Build My Modlist
            <lucide-icon name="arrow-right" [size]="16" [strokeWidth]="2"></lucide-icon>
          </a>
          <a ui-button variant="secondary" size="lg" href="#how-it-works" (click)="scrollTo($event, 'how-it-works')">
            See How It Works
          </a>
        </div>
        <div class="hero-games">
          <span class="hero-games-label">Supporting</span>
          <span class="game-tag game-tag--skyrim">Skyrim SE/AE</span>
          <span class="game-tag game-tag--fallout">Fallout 4</span>
        </div>
      </div>

      <!-- Mock Dashboard Preview -->
      <div class="hero-preview" @fadeUp>
        <div class="preview-window">
          <div class="preview-titlebar">
            <div class="preview-dots">
              <span></span><span></span><span></span>
            </div>
            <span class="preview-title">ModdersOmni — Dashboard</span>
          </div>
          <div class="preview-body">
            <div class="preview-sidebar">
              <div class="preview-sidebar-item active">
                <lucide-icon name="layout-grid" [size]="14" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <div class="preview-sidebar-item">
                <lucide-icon name="settings" [size]="14" [strokeWidth]="1.5"></lucide-icon>
              </div>
            </div>
            <div class="preview-main">
              <div class="preview-welcome">
                <div>
                  <div class="preview-welcome-title">Welcome back</div>
                  <div class="preview-welcome-sub">Your generated modlists</div>
                </div>
                <div class="preview-new-btn">+ New Build</div>
              </div>
              <div class="preview-stats">
                <div class="preview-stat">
                  <div class="preview-stat-icon preview-stat-icon--gold">
                    <lucide-icon name="folder" [size]="12" [strokeWidth]="1.5"></lucide-icon>
                  </div>
                  <div class="preview-stat-value">3</div>
                  <div class="preview-stat-label">Modlists</div>
                </div>
                <div class="preview-stat">
                  <div class="preview-stat-icon preview-stat-icon--blue">
                    <lucide-icon name="tag" [size]="12" [strokeWidth]="1.5"></lucide-icon>
                  </div>
                  <div class="preview-stat-value">127</div>
                  <div class="preview-stat-label">Total Mods</div>
                </div>
              </div>
              <div class="preview-cards">
                @for (card of previewCards; track card.game) {
                  <div class="preview-card">
                    <div class="preview-card-top">
                      <div class="preview-card-tags">
                        <span class="preview-card-game" [class]="'preview-card-game--' + card.color">{{ card.game }}</span>
                        <span class="preview-card-provider">{{ card.provider }}</span>
                      </div>
                      <lucide-icon name="arrow-right" [size]="12" [strokeWidth]="2" class="preview-card-arrow"></lucide-icon>
                    </div>
                    <div class="preview-card-stats">
                      <span class="preview-card-count">{{ card.mods }} mods</span>
                      @if (card.patches) {
                        <span class="preview-card-patches">+ {{ card.patches }} patches</span>
                      }
                    </div>
                    <span class="preview-card-date">{{ card.date }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="section" id="how-it-works">
      <div class="section-container">
        <div class="section-header">
          <span class="section-label">How It Works</span>
          <h2 class="section-title">Three steps to your<br>ideal mod setup</h2>
        </div>
        @if (stepsVisible()) {
          <div class="steps" @staggerIn>
            <div class="step stagger-item">
              <div class="step-number">01</div>
              <div class="step-icon">
                <lucide-icon name="monitor" [size]="28" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3 class="step-title">Choose Your Game</h3>
              <p class="step-desc">Select Skyrim SE/AE or Fallout 4 and pick your preferred playstyle — survival, combat overhaul, visual enhancement, and more.</p>
            </div>
            <div class="step-divider stagger-item">
              <lucide-icon name="arrow-right" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <div class="step stagger-item">
              <div class="step-number">02</div>
              <div class="step-icon">
                <lucide-icon name="sliders-horizontal" [size]="28" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3 class="step-title">Enter Your Specs</h3>
              <p class="step-desc">Paste your hardware info from NVIDIA App or system settings. Our parser auto-detects your GPU, VRAM, CPU, and RAM.</p>
            </div>
            <div class="step-divider stagger-item">
              <lucide-icon name="arrow-right" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <div class="step stagger-item">
              <div class="step-number">03</div>
              <div class="step-icon">
                <lucide-icon name="star" [size]="28" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3 class="step-title">Get Your Modlist</h3>
              <p class="step-desc">AI generates a curated, compatible mod list optimized for your hardware tier. Export directly to MO2 or Vortex.</p>
            </div>
          </div>
        }
      </div>
    </section>

    <!-- Features -->
    <section class="section section--dark" id="features">
      <div class="section-container">
        <div class="section-header">
          <span class="section-label">Features</span>
          <h2 class="section-title">Built for modders<br>who know what they want</h2>
        </div>
        @if (featuresVisible()) {
          <div class="features-grid" @staggerIn>
            <ui-card class="feature-card stagger-item">
              <div class="feature-icon feature-icon--gold">
                <lucide-icon name="shield" [size]="24" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3>AI Compatibility Checking</h3>
              <p>Every mod is checked against your full list for conflicts, missing dependencies, and load order issues before you install anything.</p>
            </ui-card>
            <ui-card class="feature-card stagger-item">
              <div class="feature-icon feature-icon--blue">
                <lucide-icon name="cpu" [size]="24" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3>Hardware-Aware Picks</h3>
              <p>Your GPU, VRAM, and CPU tier directly influence which texture resolutions, ENB presets, and script-heavy mods get recommended.</p>
            </ui-card>
            <ui-card class="feature-card stagger-item">
              <div class="feature-icon feature-icon--gold">
                <lucide-icon name="download" [size]="24" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3>One-Click Export</h3>
              <p>Export your final mod list as an MO2 profile or Vortex collection. Or download everything straight from Nexus with one click.</p>
            </ui-card>
          </div>
        }
      </div>
    </section>

    <!-- Social Proof -->
    <section class="proof-bar">
      <div class="proof-container">
        <div class="proof-item">
          <span class="proof-number">{{ modlistsGenerated() }}</span>
          <span class="proof-label">Modlists Generated</span>
        </div>
        <div class="proof-divider"></div>
        <div class="proof-item">
          <span class="proof-number">{{ gamesSupported() }}</span>
          <span class="proof-label">Games Supported</span>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="section cta-section">
      <div class="section-container" style="text-align: center;">
        <h2 class="cta-title">Ready to build your<br>perfect mod setup?</h2>
        <p class="cta-subtitle">Create a free account and save your hardware profile for instant modlists.</p>
        <a ui-button variant="primary" size="lg" routerLink="/auth/register">
          Create Free Account
          <lucide-icon name="arrow-right" [size]="16" [strokeWidth]="2"></lucide-icon>
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-container">
        <div class="footer-brand">
          <app-brand-logo></app-brand-logo>
        </div>
        <div class="footer-links">
          <a routerLink="/dashboard">Dashboard</a>
          <a routerLink="/setup">New Build</a>
          <a routerLink="/settings">Settings</a>
        </div>
        <p class="footer-copy">&copy; 2026 ModdersOmni. Open source under GPL-3.0.</p>
      </div>
    </footer>
  `,
  styles: [`
    :host {
      display: block;
    }

    /* ===== Navbar ===== */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 200;
      padding: 0 2rem;
      height: 64px;
      transition: background 0.3s, border-color 0.3s, backdrop-filter 0.3s;
    }
    .navbar.scrolled {
      background: rgba(13, 13, 15, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--color-border);
    }
    .nav-container {
      max-width: var(--max-width);
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
    }
    .nav-logo {
      display: flex;
      align-items: center;
      color: var(--color-text);
      transition: transform 0.2s var(--ease-out);
    }
    .nav-logo:hover {
      transform: translateY(-1px);
    }
    .nav-links {
      display: flex;
      gap: 2rem;
    }
    .nav-link {
      color: var(--color-text-muted);
      font-size: 0.875rem;
      font-weight: 500;
      transition: color 0.15s;
    }
    .nav-link:hover { color: var(--color-text); }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .nav-signin {
      color: var(--color-text-muted);
      font-size: 0.875rem;
      font-weight: 500;
      transition: color 0.15s;
    }
    .nav-signin:hover { color: var(--color-text); }

    /* ===== Hero ===== */
    .hero {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 120px 2rem 80px;
      overflow: hidden;
    }
    .hero-grain {
      position: absolute;
      inset: 0;
      opacity: 0.06;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      background-repeat: repeat;
      pointer-events: none;
    }
    .hero-glow {
      position: absolute;
      width: 650px;
      height: 650px;
      border-radius: 50%;
      filter: blur(130px);
      pointer-events: none;
      animation: glow-drift 12s ease-in-out infinite;
    }
    .hero-glow--gold {
      top: 5%;
      left: 12%;
      background: radial-gradient(circle, var(--color-gold-glow) 0%, transparent 70%);
      opacity: 0.6;
    }
    .hero-glow--blue {
      bottom: 8%;
      right: 8%;
      background: radial-gradient(circle, var(--color-blue-glow) 0%, transparent 70%);
      opacity: 0.5;
      animation-delay: -6s;
      animation-direction: reverse;
    }
    @keyframes glow-drift {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(20px, -15px) scale(1.05); }
      66% { transform: translate(-10px, 10px) scale(0.95); }
    }
    .hero-content {
      position: relative;
      z-index: 1;
      text-align: center;
      max-width: 720px;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(196, 165, 90, 0.08);
      border: 1px solid rgba(196, 165, 90, 0.18);
      color: var(--color-gold);
      padding: 0.375rem 1rem;
      border-radius: 100px;
      font-size: 0.8125rem;
      font-weight: 500;
      margin-bottom: 2rem;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      background: var(--color-gold);
      border-radius: 50%;
      animation: pulse-dot 2s ease-in-out infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .hero-title {
      font-family: var(--font-display);
      font-size: clamp(2.5rem, 5.5vw, 4.25rem);
      font-weight: 500;
      line-height: 1.1;
      letter-spacing: -0.02em;
      margin-bottom: 1.5rem;
      color: var(--color-text);
    }
    .hero-title-accent {
      background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-hover) 40%, var(--color-blue) 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradient-shift 6s ease-in-out infinite;
    }
    @keyframes gradient-shift {
      0%, 100% { background-position: 0% center; }
      50% { background-position: 100% center; }
    }
    .hero-subtitle {
      font-size: 1.125rem;
      color: var(--color-text-muted);
      line-height: 1.7;
      margin-bottom: 2.5rem;
    }
    .hero-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 3rem;
    }

    /* Game tags */
    .hero-games {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }
    .hero-games-label {
      font-size: 0.8125rem;
      color: var(--color-text-dim);
      font-weight: 500;
    }
    .game-tag {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.75rem;
      border-radius: 6px;
      letter-spacing: 0.03em;
    }
    .game-tag--skyrim {
      background: rgba(123, 164, 192, 0.12);
      color: var(--color-blue);
      border: 1px solid rgba(123, 164, 192, 0.2);
    }
    .game-tag--fallout {
      background: rgba(192, 160, 96, 0.12);
      color: var(--color-gold);
      border: 1px solid rgba(192, 160, 96, 0.2);
    }

    /* ===== Animated Nexus Background ===== */
    .nexus-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
      opacity: 0;
      animation: nexus-fade-in 2.5s ease-out 0.3s forwards;
    }
    @keyframes nexus-fade-in { to { opacity: 1; } }

    .nexus-lines {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .nx-line {
      stroke: var(--color-gold);
      stroke-width: 0.5;
      opacity: 0;
      animation: nx-draw 1.8s ease-out forwards, nx-pulse 5s ease-in-out infinite;
    }
    @keyframes nx-draw {
      from { stroke-dasharray: 600; stroke-dashoffset: 600; opacity: 0; }
      to { stroke-dasharray: 600; stroke-dashoffset: 0; opacity: 0.05; }
    }
    @keyframes nx-pulse {
      0%, 100% { opacity: 0.03; }
      50% { opacity: 0.07; }
    }
    .l1 { animation-delay: 0.2s, 0.2s; }
    .l2 { animation-delay: 0.4s, 0.7s; }
    .l3 { animation-delay: 0.6s, 1.2s; }
    .l4 { animation-delay: 0.3s, 0.5s; }
    .l5 { animation-delay: 0.55s, 0.9s; }
    .l6 { animation-delay: 0.75s, 1.4s; }
    .l7 { animation-delay: 0.9s, 0.3s; }
    .l8 { animation-delay: 0.45s, 1.0s; }
    .l9 { animation-delay: 0.65s, 1.6s; }
    .l10 { animation-delay: 0.8s, 0.6s; }
    .l11 { animation-delay: 0.95s, 1.3s; }
    .l12 { animation-delay: 0.5s, 0.8s; }
    .l13 { animation-delay: 0.7s, 1.5s; }
    .l14 { animation-delay: 0.85s, 0.4s; }
    .l15 { animation-delay: 1.0s, 1.7s; }

    .nexus-node {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--color-gold);
      opacity: 0;
      animation: nx-node-in 0.6s ease-out forwards, nx-node-glow 4s ease-in-out infinite;
      box-shadow: 0 0 8px rgba(196, 165, 90, 0.3);
    }
    @keyframes nx-node-in {
      from { transform: scale(0); opacity: 0; }
      to { transform: scale(1); opacity: 0.2; }
    }
    @keyframes nx-node-glow {
      0%, 100% { opacity: 0.12; box-shadow: 0 0 6px rgba(196, 165, 90, 0.15); }
      50% { opacity: 0.3; box-shadow: 0 0 14px rgba(196, 165, 90, 0.35); }
    }
    .n1 { left: 12%; top: 19%; animation-delay: 0.2s, 0.5s; }
    .n2 { left: 35%; top: 12.5%; animation-delay: 0.4s, 1.0s; }
    .n3 { left: 60%; top: 25%; animation-delay: 0.6s, 0.3s; }
    .n4 { left: 85%; top: 15%; animation-delay: 0.7s, 0.8s; }
    .n5 { left: 20%; top: 50%; animation-delay: 0.35s, 1.2s; }
    .n6 { left: 45%; top: 44%; animation-delay: 0.55s, 0.6s; }
    .n7 { left: 70%; top: 62.5%; animation-delay: 0.75s, 1.5s; }
    .n8 { left: 35%; top: 75%; animation-delay: 0.5s, 0.9s; }
    .n9 { left: 55%; top: 81%; animation-delay: 0.85s, 0.4s; }
    .n10 { left: 90%; top: 75%; animation-delay: 0.65s, 1.1s; }
    .n11 { left: 8%; top: 85%; animation-delay: 0.45s, 0.7s; }
    .n12 { left: 78%; top: 38%; animation-delay: 0.8s, 1.3s; }

    /* ===== Mock Preview ===== */
    .hero-preview {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 800px;
      margin-top: 4rem;
    }
    .preview-window {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
      will-change: transform;
      animation: subtle-float 8s ease-in-out infinite;
    }
    @keyframes subtle-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    .preview-titlebar {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: var(--color-bg-elevated);
      border-bottom: 1px solid var(--color-border);
    }
    .preview-dots {
      display: flex;
      gap: 6px;
    }
    .preview-dots span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
    }
    .preview-dots span:first-child { background: #ef4444; }
    .preview-dots span:nth-child(2) { background: #eab308; }
    .preview-dots span:last-child { background: #22c55e; }
    .preview-title {
      font-size: 0.75rem;
      color: var(--color-text-dim);
      flex: 1;
    }
    .preview-body {
      display: flex;
      min-height: 280px;
    }
    .preview-sidebar {
      width: 44px;
      background: rgba(255, 255, 255, 0.02);
      border-right: 1px solid var(--color-border);
      padding: 0.75rem 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.375rem;
    }
    .preview-sidebar-item {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-dim);
    }
    .preview-sidebar-item.active {
      background: rgba(196, 165, 90, 0.12);
      color: var(--color-gold);
      border: 1px solid rgba(196, 165, 90, 0.2);
    }
    .preview-main {
      flex: 1;
      padding: 0.875rem 1rem;
      overflow: hidden;
    }

    /* Mock dashboard welcome */
    .preview-welcome {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .preview-welcome-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text);
    }
    .preview-welcome-sub {
      font-size: 0.5625rem;
      color: var(--color-text-muted);
      margin-top: 1px;
    }
    .preview-new-btn {
      font-size: 0.5625rem;
      font-weight: 600;
      background: var(--color-gold);
      color: #0D0D0F;
      padding: 0.25rem 0.625rem;
      border-radius: 5px;
    }

    /* Mock dashboard stats */
    .preview-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .preview-stat {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 0.5rem 0.625rem;
    }
    .preview-stat-icon {
      width: 22px;
      height: 22px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.375rem;
    }
    .preview-stat-icon--gold { background: rgba(192, 160, 96, 0.12); color: var(--color-gold); }
    .preview-stat-icon--blue { background: rgba(123, 164, 192, 0.12); color: var(--color-blue); }
    .preview-stat-value {
      font-size: 0.875rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 1px;
    }
    .preview-stat-label {
      font-size: 0.5rem;
      color: var(--color-text-muted);
    }

    /* Mock dashboard cards */
    .preview-cards {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .preview-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 0.625rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      transition: border-color 0.2s;
    }
    .preview-card:hover {
      border-color: rgba(196, 165, 90, 0.2);
    }
    .preview-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .preview-card-tags {
      display: flex;
      gap: 0.25rem;
    }
    .preview-card-game {
      font-size: 0.5rem;
      font-weight: 600;
      padding: 0.125rem 0.375rem;
      border-radius: 100px;
    }
    .preview-card-game--blue {
      background: rgba(123, 164, 192, 0.12);
      color: var(--color-blue);
    }
    .preview-card-game--gold {
      background: rgba(192, 160, 96, 0.12);
      color: var(--color-gold);
    }
    .preview-card-provider {
      font-size: 0.5rem;
      font-weight: 600;
      padding: 0.125rem 0.375rem;
      border-radius: 100px;
      background: rgba(192, 160, 96, 0.12);
      color: var(--color-gold);
    }
    .preview-card-arrow {
      color: var(--color-text-dim);
      transition: color 0.15s, transform 0.15s;
    }
    .preview-card:hover .preview-card-arrow {
      color: var(--color-gold);
      transform: translateX(2px);
    }
    .preview-card-stats {
      display: flex;
      align-items: baseline;
      gap: 0.375rem;
    }
    .preview-card-count {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .preview-card-patches {
      font-size: 0.5625rem;
      color: var(--color-text-muted);
    }
    .preview-card-date {
      font-size: 0.5rem;
      color: var(--color-text-dim);
    }

    /* ===== Sections ===== */
    .section {
      padding: 6rem 2rem;
    }
    .section--dark {
      background: var(--color-bg-card);
    }
    .section-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }
    .section-header {
      text-align: center;
      margin-bottom: 4rem;
    }
    .section-label {
      display: inline-block;
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-gold);
      margin-bottom: 1rem;
    }
    .section-title {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 3vw, 2.5rem);
      font-weight: 500;
      line-height: 1.2;
      color: var(--color-text);
    }

    /* ===== Steps ===== */
    .steps {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: 2rem;
    }
    .step {
      flex: 1;
      max-width: 320px;
      text-align: center;
    }
    .step-number {
      font-family: var(--font-display);
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-gold);
      margin-bottom: 1.25rem;
      letter-spacing: 0.05em;
    }
    .step-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--color-border);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
      color: var(--color-text);
      transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
    }
    .step:hover .step-icon {
      border-color: rgba(196, 165, 90, 0.25);
      box-shadow: 0 0 20px rgba(196, 165, 90, 0.1);
      background: rgba(196, 165, 90, 0.06);
    }
    .step-title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.625rem;
    }
    .step-desc {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      line-height: 1.6;
    }
    .step-divider {
      display: flex;
      align-items: center;
      color: var(--color-text-dim);
      padding-top: 4.5rem;
    }

    /* ===== Features Grid ===== */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
    }
    .feature-card {
      background: var(--color-bg-dark);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 2rem;
      transition: border-color 0.25s, transform 0.3s var(--ease-out), box-shadow 0.3s;
      position: relative;
    }
    .feature-card::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: radial-gradient(ellipse at 50% 0%, rgba(196, 165, 90, 0.04) 0%, transparent 70%);
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }
    .feature-card:hover {
      border-color: rgba(196, 165, 90, 0.15);
      transform: translateY(-4px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(196, 165, 90, 0.08);
    }
    .feature-card:hover::before {
      opacity: 1;
    }
    .feature-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
    }
    .feature-icon--gold {
      background: rgba(192, 160, 96, 0.12);
      color: var(--color-gold);
    }
    .feature-icon--blue {
      background: rgba(123, 164, 192, 0.12);
      color: var(--color-blue);
    }
    .feature-card h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .feature-card p {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      line-height: 1.6;
    }

    /* ===== Social Proof Bar ===== */
    .proof-bar {
      border-top: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      padding: 3rem 2rem;
    }
    .proof-container {
      max-width: var(--max-width);
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3rem;
    }
    .proof-item {
      text-align: center;
    }
    .proof-number {
      display: block;
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 0.25rem;
      background: linear-gradient(180deg, var(--color-text) 0%, var(--color-text-muted) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .proof-label {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
    }
    .proof-divider {
      width: 1px;
      height: 40px;
      background: var(--color-border);
    }

    /* ===== CTA Section ===== */
    .cta-section {
      padding: 8rem 2rem;
      position: relative;
      overflow: hidden;
    }
    .cta-section::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 400px;
      background: radial-gradient(ellipse, rgba(196, 165, 90, 0.06) 0%, transparent 70%);
      pointer-events: none;
    }
    .cta-title {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 3vw, 2.5rem);
      font-weight: 500;
      line-height: 1.2;
      margin-bottom: 1rem;
    }
    .cta-subtitle {
      font-size: 1.0625rem;
      color: var(--color-text-muted);
      margin-bottom: 2.5rem;
    }

    /* ===== Footer ===== */
    .footer {
      border-top: 1px solid var(--color-border);
      padding: 2.5rem 2rem;
    }
    .footer-container {
      max-width: var(--max-width);
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .footer-brand {
      display: flex;
      align-items: center;
    }
    .footer-links {
      display: flex;
      gap: 2rem;
    }
    .footer-links a {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      transition: color 0.15s;
    }
    .footer-links a:hover { color: var(--color-text); }
    .footer-copy {
      font-size: 0.75rem;
      color: var(--color-text-dim);
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .steps {
        flex-direction: column;
        align-items: center;
      }
      .step-divider {
        padding-top: 0;
        transform: rotate(90deg);
      }
      .features-grid {
        grid-template-columns: 1fr;
      }
      .proof-container {
        flex-direction: column;
        gap: 1.5rem;
      }
      .proof-divider {
        width: 40px;
        height: 1px;
      }
      .footer-container {
        flex-direction: column;
        gap: 1.5rem;
        text-align: center;
      }
      .hero-subtitle br { display: none; }
      .nav-links { display: none; }
      .preview-sidebar { display: none; }
    }
  `],
})
export class LandingComponent implements OnInit, OnDestroy, AfterViewInit {
  scrolled = signal(false);
  stepsVisible = signal(false);
  featuresVisible = signal(false);
  modlistsGenerated = signal('0');
  gamesSupported = signal('2');

  readonly previewCards = [
    { game: 'Skyrim SE', color: 'blue', provider: 'groq', mods: 48, patches: 12, date: 'Feb 24, 2026' },
    { game: 'Fallout 4', color: 'gold', provider: 'anthropic', mods: 35, patches: 8, date: 'Feb 20, 2026' },
    { game: 'Skyrim AE', color: 'blue', provider: 'deepseek', mods: 44, patches: 0, date: 'Feb 18, 2026' },
  ];

  private apiService = inject(ApiService);

  constructor(public authService: AuthService) {}

  private scrollHandler = () => {
    this.scrolled.set(window.scrollY > 20);
  };

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.scrollHandler();

    this.apiService.getStats().subscribe({
      next: (stats) => {
        this.modlistsGenerated.set(stats.modlists_generated.toLocaleString());
        this.gamesSupported.set(stats.games_supported.toString());
      },
      error: () => {},
    });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id === 'how-it-works') this.stepsVisible.set(true);
            if (id === 'features') this.featuresVisible.set(true);
          }
        });
      },
      { threshold: 0.15 },
    );

    const howItWorks = document.getElementById('how-it-works');
    const features = document.getElementById('features');
    if (howItWorks) this.observer.observe(howItWorks);
    if (features) this.observer.observe(features);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollHandler);
    this.observer?.disconnect();
  }

  scrollTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
