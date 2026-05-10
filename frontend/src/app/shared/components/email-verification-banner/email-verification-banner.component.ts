import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

const DISMISS_KEY = 'moddersomni:email-banner-dismissed';

@Component({
  selector: 'app-email-verification-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="banner" role="status">
        <div class="banner-content">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span>Verify your email to secure your account.</span>
          <button
            type="button"
            class="resend"
            (click)="resend()"
            [disabled]="resending()"
          >
            {{ resending() ? 'Sending…' : 'Resend verification link' }}
          </button>
        </div>
        <button
          type="button"
          class="dismiss"
          (click)="dismiss()"
          aria-label="Dismiss verification banner"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    }
  `,
  styles: [`
    .banner {
      position: sticky;
      top: 0;
      z-index: 101;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 0.5rem 1rem;
      background: color-mix(in oklch, var(--color-accent) 15%, var(--color-bg));
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
      font-size: 0.8125rem;
    }
    .banner-content {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      flex-wrap: wrap;
      justify-content: center;
    }
    .banner-content svg {
      color: var(--color-accent);
      flex-shrink: 0;
    }
    .resend {
      background: var(--color-accent);
      color: #0D0D0F;
      border: none;
      padding: 0.25rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
    }
    .resend:hover:not(:disabled) {
      background: var(--color-accent);
    }
    .resend:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .dismiss {
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      padding: 0.25rem;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background 0.15s;
    }
    .dismiss:hover {
      color: var(--color-text);
      background: rgba(255, 255, 255, 0.06);
    }
    @media (max-width: 640px) {
      .banner {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
      }
    }
  `],
})
export class EmailVerificationBannerComponent {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  protected readonly dismissed = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === 'true',
  );
  protected readonly resending = signal(false);

  protected readonly visible = computed(() => {
    const user = this.auth.user();
    return !!user && !user.email_verified && !this.dismissed();
  });

  dismiss(): void {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // SSR or storage disabled — session-only dismissal
    }
    this.dismissed.set(true);
  }

  resend(): void {
    if (this.resending()) return;
    this.resending.set(true);
    this.auth.resendVerification().subscribe({
      next: () => {
        this.resending.set(false);
        this.notifications.success('Verification email sent. Check your inbox.');
      },
      error: () => {
        this.resending.set(false);
        this.notifications.error('Could not resend. Try again in a moment.');
      },
    });
  }
}
