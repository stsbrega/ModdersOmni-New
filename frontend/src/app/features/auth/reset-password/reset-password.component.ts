import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink, BrandLogoComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <app-brand-logo [showText]="false" size="lg"></app-brand-logo>

          @if (success()) {
            <div class="icon-success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1>Password reset!</h1>
            <p>Your password has been updated successfully.</p>
            <a routerLink="/auth/login" class="btn-primary">Sign In</a>
          } @else if (!token) {
            <h1>Invalid link</h1>
            <p>This password reset link is invalid or has expired.</p>
            <a routerLink="/auth/forgot-password" class="btn-primary">Request New Link</a>
          } @else {
            <h1>Set new password</h1>
            <p>Enter your new password below.</p>
          }
        </div>

        @if (!success() && token) {
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label for="password">New Password</label>
              <input
                id="password"
                type="password"
                class="input"
                [(ngModel)]="password"
                name="password"
                placeholder="At least 8 characters"
                required
                minlength="8"
              >
            </div>
            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                class="input"
                [(ngModel)]="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter your password"
                required
              >
              @if (confirmPassword && password !== confirmPassword) {
                <span class="field-error">Passwords do not match</span>
              }
            </div>
            <button
              type="submit"
              class="btn-primary"
              [disabled]="loading() || password.length < 8 || password !== confirmPassword"
            >
              @if (loading()) {
                <span class="btn-spinner"></span>
                Resetting...
              } @else {
                Reset Password
              }
            </button>
          </form>
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
    .field-error {
      font-size: 0.75rem;
      color: #ef4444;
    }

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
      text-decoration: none;
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
  `],
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  loading = signal(false);
  success = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private notifications: NotificationService,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] || '';
  }

  onSubmit(): void {
    if (!this.token || !this.password || this.password !== this.confirmPassword) return;
    this.loading.set(true);

    this.authService.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        this.notifications.error(err.error?.detail || 'Failed to reset password. The link may have expired.');
      },
    });
  }
}
