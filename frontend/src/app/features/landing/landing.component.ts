import { Component, signal, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { fadeUp } from '../../core/motion/animations';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  ArrowRight,
  Monitor,
  SlidersHorizontal,
  Star,
} from 'lucide-angular';
import { BrandMarkComponent } from '../../shared/components/brand-mark/brand-mark.component';
import { UiButtonComponent, UiTerminalLogComponent, type TerminalLogEntry } from '../../shared/components/ui';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, BrandMarkComponent, LucideAngularModule, UiButtonComponent, UiTerminalLogComponent],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        ArrowRight,
        Monitor,
        SlidersHorizontal,
        Star,
      }),
    },
  ],
  animations: [fadeUp],
  template: `
    <!-- Sticky Navbar -->
    <nav class="navbar" [class.scrolled]="scrolled()">
      <div class="nav-container">
        <a routerLink="/" class="nav-logo">
          <app-brand-mark></app-brand-mark>
        </a>
        <div class="nav-links">
          <a href="#how-it-works" class="nav-link" (click)="scrollTo($event, 'how-it-works')">How It Works</a>
        </div>
        <div class="nav-actions">
          <a ui-button variant="secondary" size="sm" routerLink="/dashboard">Dashboard</a>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-grain"></div>
      <div class="hero-glow hero-glow--gold"></div>
      <div class="hero-glow hero-glow--blue"></div>

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

      <!-- Terminal Log Preview -->
      <div class="hero-preview" @fadeUp>
        <div class="preview-window">
          <div class="preview-titlebar">
            <div class="preview-dots"><span></span><span></span><span></span></div>
            <span class="preview-title">moddersomni — generation log</span>
          </div>
          <div class="preview-body">
            <ui-terminal-log [entries]="heroEntries()"></ui-terminal-log>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="section" id="how-it-works">
      <div class="section-container">
        <div class="section-header">
          <span class="section-label">How It Works</span>
          <h2 class="section-title">Three steps to your ideal mod setup</h2>
        </div>
        @defer (on viewport) {
          <div class="steps">
            <div class="step">
              <div class="step-number">01</div>
              <div class="step-icon">
                <lucide-icon name="monitor" [size]="28" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3 class="step-title">Choose Your Game</h3>
              <p class="step-desc">Select Skyrim SE/AE or Fallout 4 and pick your preferred playstyle — survival, combat overhaul, visual enhancement, and more.</p>
            </div>
            <div class="step-divider">
              <lucide-icon name="arrow-right" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <div class="step">
              <div class="step-number">02</div>
              <div class="step-icon">
                <lucide-icon name="sliders-horizontal" [size]="28" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3 class="step-title">Enter Your Specs</h3>
              <p class="step-desc">Paste your hardware info from NVIDIA App or system settings. Our parser auto-detects your GPU, VRAM, CPU, and RAM.</p>
            </div>
            <div class="step-divider">
              <lucide-icon name="arrow-right" [size]="24" [strokeWidth]="1.5"></lucide-icon>
            </div>
            <div class="step">
              <div class="step-number">03</div>
              <div class="step-icon">
                <lucide-icon name="star" [size]="28" [strokeWidth]="1.5"></lucide-icon>
              </div>
              <h3 class="step-title">Get Your Modlist</h3>
              <p class="step-desc">AI generates a curated, compatible mod list optimized for your hardware tier. Export directly to MO2 or Vortex.</p>
            </div>
          </div>
        } @placeholder (minimum 0ms) {
          <div class="steps-placeholder" style="min-height: 200px;"></div>
        }
      </div>
    </section>

    <!-- CTA -->
    <section class="section cta-section">
      <div class="section-container" style="text-align: center;">
        <h2 class="cta-title">Ready to build your<br>perfect mod setup?</h2>
        <p class="cta-subtitle">Bring your own LLM key, generate a phased modlist in minutes, and export to Mod Organizer 2 or Vortex.</p>
        <a ui-button variant="primary" size="lg" routerLink="/setup">
          Start Building
          <lucide-icon name="arrow-right" [size]="16" [strokeWidth]="2"></lucide-icon>
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-container">
        <app-brand-mark size="sm" [showText]="true"></app-brand-mark>
        <p class="footer-copy">&copy; 2026 ModdersOmni · Open source under GPL-3.0</p>
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
      transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
    }
    .navbar.scrolled {
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border);
      box-shadow: var(--shadow-sm);
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
      background: radial-gradient(circle, color-mix(in oklch, var(--color-accent) 25%, transparent) 0%, transparent 70%);
      opacity: 0.6;
    }
    .hero-glow--blue {
      bottom: 8%;
      right: 8%;
      background: radial-gradient(circle, color-mix(in oklch, var(--color-secondary) 20%, transparent) 0%, transparent 70%);
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
      background: color-mix(in oklch, var(--color-accent) 10%, transparent);
      border: 1px solid color-mix(in oklch, var(--color-accent) 25%, transparent);
      color: var(--color-accent);
      padding: 0.375rem 1rem;
      border-radius: 100px;
      font-size: 0.8125rem;
      font-weight: 500;
      margin-bottom: 2rem;
    }
    .badge-dot {
      width: 6px;
      height: 6px;
      background: var(--color-accent);
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
      background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent) 40%, var(--color-secondary) 100%);
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
      color: var(--color-secondary);
      border: 1px solid rgba(123, 164, 192, 0.2);
    }
    .game-tag--fallout {
      background: rgba(192, 160, 96, 0.12);
      color: var(--color-accent);
      border: 1px solid rgba(192, 160, 96, 0.2);
    }

    /* ===== Terminal Preview Window ===== */
    .hero-preview {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 720px;
      margin-top: 4rem;
    }
    .preview-window {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
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
      background: var(--color-surface-2);
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
    /* Let the UiTerminalLogComponent own its own chrome — only constrain height */
    .preview-body {
      min-height: 320px;
      max-height: 380px;
      overflow-y: auto;
    }
    /* Remove UiTerminalLogComponent's own border/radius inside the window frame */
    .preview-body ui-terminal-log :host-context .terminal-log,
    .preview-body ::ng-deep .terminal-log {
      border: none;
      border-radius: 0;
      background: transparent;
    }

    /* ===== Sections ===== */
    .section {
      padding: 6rem 2rem;
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
      color: var(--color-accent);
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
      color: var(--color-accent);
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
      border-color: color-mix(in oklch, var(--color-accent) 25%, transparent);
      box-shadow: 0 0 20px color-mix(in oklch, var(--color-accent) 10%, transparent);
      background: color-mix(in oklch, var(--color-accent) 6%, transparent);
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
      background: radial-gradient(ellipse, color-mix(in oklch, var(--color-accent) 6%, transparent) 0%, transparent 70%);
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
      padding: 2rem;
    }
    .footer-container {
      max-width: var(--max-width);
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
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
      .footer-container { flex-direction: column; gap: 1rem; text-align: center; }
      .hero-subtitle br { display: none; }
      .nav-links { display: none; }
    }
  `],
})
export class LandingComponent implements OnInit, OnDestroy, AfterViewInit {
  scrolled = signal(false);
  heroEntries = signal<TerminalLogEntry[]>([]);

  private static readonly DEMO_SCRIPT: TerminalLogEntry[] = [
    { level: 'info', text: 'phase 1/13 — essentials' },
    { level: 'info', text: 'searching nexus: unofficial patches' },
    { level: 'ok',   text: 'added: Unofficial Skyrim Special Edition Patch' },
    { level: 'ok',   text: 'added: SkyUI' },
    { level: 'info', text: 'phase 2/13 — UI improvements' },
    { level: 'ok',   text: 'added: A Quality World Map' },
    { level: 'ok',   text: 'added: SmoothCam' },
    { level: 'warn', text: 'deferred: mod conflicts with SkyUI patch' },
    { level: 'ok',   text: 'patch added: USSEP × SkyUI compatibility patch' },
    { level: 'info', text: 'phase 3/13 — gameplay overhaul' },
    { level: 'ok',   text: 'added: Wildcat Combat' },
    { level: 'info', text: 'phase complete — 47 mods · 0 conflicts' },
  ];

  private heroDemoTimer: number | undefined;

  private scrollHandler = () => {
    this.scrolled.set(window.scrollY > 20);
  };

  ngOnInit(): void {
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.scrollHandler();
  }

  ngAfterViewInit(): void {
    this.startHeroDemo();
  }

  private startHeroDemo(): void {
    const script = LandingComponent.DEMO_SCRIPT;
    let i = 0;
    const tick = (): void => {
      if (i < script.length) {
        this.heroEntries.set(script.slice(0, i + 1));
        i++;
        this.heroDemoTimer = window.setTimeout(tick, 700 + Math.random() * 400);
      } else {
        // Pause at the end, then restart from the top
        this.heroDemoTimer = window.setTimeout(() => {
          i = 0;
          this.heroEntries.set([]);
          tick();
        }, 2500);
      }
    };
    tick();
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollHandler);
    if (this.heroDemoTimer) clearTimeout(this.heroDemoTimer);
  }

  scrollTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
