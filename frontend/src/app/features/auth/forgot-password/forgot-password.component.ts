import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, BrandLogoComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <app-brand-logo [showText]="false" size="lg"></app-brand-logo>

          @if (sent()) {
            <div class="icon-success">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </div>
            <h1>Check your email</h1>
            <p>If an account exists for <strong>{{ email }}</strong>, we've sent password reset instructions.</p>
            <a routerLink="/auth/login" class="btn-secondary">Back to Sign In</a>
          } @else {
            <h1>Reset your password</h1>
            <p>Enter your email and we'll send you a reset link.</p>
          }
        </div>

        @if (!sent()) {
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input
                id="email"
                type="email"
                class="input"
                [(ngModel)]="email"
                name="email"
                placeholder="you@example.com"
                required
              >
            </div>
            <button type="submit" class="btn-primary" [disabled]="loading() || !email">
              @if (loading()) {
                <span class="btn-spinner"></span>
                Sending...
              } @else {
                Send Reset Link
              }
            </button>
          </form>

          <p class="auth-footer">
            <a routerLink="/auth/login">Back to Sign In</a>
          </p>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: var(--color-bg);
    }
    .auth-card {
      width: 100%;
      max-width: 400px;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 2.5rem;
    }
    .auth-header {
      text-align: center;
      margin-bottom: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .auth-header h1 {
      font-size: 1.375rem;
      font-weight: 600;
    }
    .auth-header p {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      line-height: 1.5;
    }
    .auth-header strong {
      color: var(--color-text);
    }
    .icon-success {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .form-group label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-text-muted);
    }
    .input {
      width: 100%;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      color: var(--color-text);
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .input:focus { border-color: var(--color-accent); }
    .input::placeholder { color: var(--color-text-dim); }

    .btn-primary {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: var(--color-accent);
      color: #0D0D0F;
      padding: 0.7rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      transition: background 0.2s, box-shadow 0.3s;
      margin-top: 0.5rem;
    }
    .btn-primary:hover {
      background: var(--color-accent);
      box-shadow: var(--shadow-md);
    }
    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(13, 13, 15, 0.3);
      border-top-color: #0D0D0F;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      padding: 0.6rem 1.5rem;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      color: var(--color-text);
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s;
    }
    .btn-secondary:hover {
      border-color: var(--color-border);
      background: rgba(255, 255, 255, 0.03);
    }

    .auth-footer {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.8125rem;
    }
    .auth-footer a {
      color: var(--color-accent);
      font-weight: 500;
    }
  `],
})
export class ForgotPasswordComponent {
  email = '';
  loading = signal(false);
  sent = signal(false);

  constructor(private authService: AuthService) {}

  onSubmit(): void {
    if (!this.email) return;
    this.loading.set(true);

    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: () => {
        this.loading.set(false);
        // Always show success to prevent email enumeration
        this.sent.set(true);
      },
    });
  }
}
