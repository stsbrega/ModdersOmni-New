import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Coffee,
  ExternalLink,
  Heart,
  Info,
} from 'lucide-angular';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        Coffee,
        ExternalLink,
        Heart,
        Info,
      }),
    },
  ],
  template: `
    <div class="support-page">
      <div class="page-header">
        <div class="header-badge">SUPPORT</div>
        <h1 class="page-title">Support ModdersOmni</h1>
        <p class="page-subtitle">
          ModdersOmni is a passion project built for the modding community — free for
          everyone, no strings attached. If you enjoy what it does, any support means
          the world and helps keep it alive.
        </p>
      </div>

      <!-- Donation platforms -->
      <!-- Donation cards & buttons stay inline: brand-tinted surfaces (Ko-fi #ff5e3a,
           Patreon #ff6630) and brand-colored CTAs that don't map to ui-card / ui-button
           semantic variants. The icons themselves swap to lucide. -->
      <div class="donation-grid">
        <!-- Ko-fi -->
        <div class="donation-card donation-card--kofi">
          <div class="platform-icon">
            <lucide-icon name="coffee" [size]="32" [strokeWidth]="1.5"></lucide-icon>
          </div>
          <div class="platform-info">
            <h2 class="platform-name">Ko-fi</h2>
            <p class="platform-desc">
              Buy me a coffee — one-time or recurring. Every donation goes directly
              toward server compute.
            </p>
          </div>
          <a
            href="https://ko-fi.com/moddersomni"
            target="_blank"
            rel="noopener noreferrer"
            class="donate-btn donate-btn--kofi"
          >
            Donate on Ko-fi
            <lucide-icon name="external-link" [size]="14" [strokeWidth]="2"></lucide-icon>
          </a>
        </div>

        <!-- Patreon -->
        <div class="donation-card donation-card--patreon">
          <div class="platform-icon">
            <lucide-icon name="heart" [size]="32" [strokeWidth]="1.5"></lucide-icon>
          </div>
          <div class="platform-info">
            <h2 class="platform-name">Patreon</h2>
            <p class="platform-desc">
              Become a patron for recurring monthly support. Great if you use
              ModdersOmni regularly and want to keep it running.
            </p>
          </div>
          <a
            href="https://www.patreon.com/c/ModdersOmni"
            target="_blank"
            rel="noopener noreferrer"
            class="donate-btn donate-btn--patreon"
          >
            Support on Patreon
            <lucide-icon name="external-link" [size]="14" [strokeWidth]="2"></lucide-icon>
          </a>
        </div>
      </div>

      <!-- BYOK callout — signal-carrying tinted surface (indigo info tint),
           kept inline (per the migration carve-out for branded/signal surfaces). -->
      <div class="byok-callout">
        <div class="byok-icon">
          <lucide-icon name="info" [size]="22" [strokeWidth]="1.5"></lucide-icon>
        </div>
        <div class="byok-body">
          <strong>Using your own API keys?</strong>
          <p>
            If you add your own Groq, Gemini, Anthropic, or OpenAI keys in
            <a routerLink="/settings" class="inline-link">Settings</a>, generations
            run on your account and may be subject to charges from that provider
            depending on your plan with them.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .support-page {
      max-width: 760px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }

    /* ── Header ── */
    .page-header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .header-badge {
      display: inline-block;
      background: color-mix(in oklch, var(--color-accent) 10%, transparent);
      color: var(--color-accent);
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      padding: 0.3rem 0.9rem;
      border-radius: 100px;
      margin-bottom: 1rem;
    }
    .page-title {
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.625rem;
    }
    .page-subtitle {
      color: var(--color-text-muted);
      font-size: 0.9375rem;
      line-height: 1.6;
      max-width: 560px;
      margin: 0 auto;
    }

    /* ── Donation Grid ── */
    .donation-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    .donation-card {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.75rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .donation-card--kofi {
      border-color: rgba(255, 94, 58, 0.2);
    }
    .donation-card--kofi:hover {
      border-color: rgba(255, 94, 58, 0.4);
      box-shadow: 0 0 24px rgba(255, 94, 58, 0.06);
    }
    .donation-card--patreon {
      border-color: rgba(255, 102, 48, 0.2);
    }
    .donation-card--patreon:hover {
      border-color: rgba(255, 102, 48, 0.4);
      box-shadow: 0 0 24px rgba(255, 102, 48, 0.06);
    }

    .platform-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .donation-card--kofi .platform-icon {
      background: rgba(255, 94, 58, 0.1);
      color: #ff5e3a;
    }
    .donation-card--patreon .platform-icon {
      background: rgba(255, 102, 48, 0.1);
      color: #ff6630;
    }

    .platform-name {
      font-family: var(--font-display);
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 0.375rem;
    }
    .platform-desc {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.55;
    }
    .platform-info {
      flex: 1;
    }

    .donate-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.7rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: opacity 0.15s, transform 0.15s;
    }
    .donate-btn:hover {
      opacity: 0.88;
      transform: translateY(-1px);
    }
    .donate-btn--kofi {
      background: #ff5e3a;
      color: #fff;
    }
    .donate-btn--patreon {
      background: #ff6630;
      color: #fff;
    }

    /* ── BYOK Callout ── */
    .byok-callout {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      background: var(--color-surface-1);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: var(--radius-lg);
      padding: 1.25rem 1.5rem;
    }
    .byok-icon {
      width: 40px;
      height: 40px;
      background: rgba(99, 102, 241, 0.1);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6366f1;
      flex-shrink: 0;
    }
    .byok-body strong {
      font-size: 0.875rem;
      display: block;
      margin-bottom: 0.25rem;
    }
    .byok-body p {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      line-height: 1.55;
    }
    .inline-link {
      color: var(--color-accent);
      font-weight: 600;
    }

    /* ── Responsive ── */
    @media (max-width: 600px) {
      .donation-grid {
        grid-template-columns: 1fr;
      }
      .byok-callout {
        flex-direction: column;
      }
    }
  `],
})
export class SupportComponent {}
