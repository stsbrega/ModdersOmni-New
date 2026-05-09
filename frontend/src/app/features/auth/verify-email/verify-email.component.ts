import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <app-brand-logo [showText]="false" size="lg"></app-brand-logo>

          @if (verifying()) {
            <div class="spinner"></div>
            <p>Verifying your email...</p>
          } @else if (success()) {
            <div class="icon-success">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1>Email verified!</h1>
            <p>Your email has been verified successfully.</p>
            <a routerLink="/dashboard" class="btn-primary">Go to Dashboard</a>
          } @else {
            <div class="icon-error">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
            <h1>Verification failed</h1>
            <p>{{ errorMessage() }}</p>
            <a routerLink="/auth/login" class="btn-primary">Back to Sign In</a>
          }
        </div>
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
      background: var(--color-bg-dark);
    }
    .auth-card {
      width: 100%;
      max-width: 400px;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 2.5rem;
    }
    .auth-header {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .auth-header h1 {
      font-size: 1.375rem;
      font-weight: 600;
    }
    .auth-header p {
      font-size: 0.875rem;
      color: var(--color-text-muted);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-gold);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

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
    .icon-error {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-gold);
      color: #0D0D0F;
      padding: 0.7rem 2rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      transition: background 0.2s, box-shadow 0.3s;
      text-decoration: none;
      margin-top: 0.5rem;
    }
    .btn-primary:hover {
      background: var(--color-gold-hover);
      box-shadow: 0 0 20px var(--color-gold-glow);
    }
  `],
})
export class VerifyEmailComponent implements OnInit {
  verifying = signal(true);
  success = signal(false);
  errorMessage = signal('The verification link is invalid or has expired.');

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];

    if (!token) {
      this.verifying.set(false);
      this.errorMessage.set('No verification token provided.');
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.verifying.set(false);
        this.success.set(true);
        this.authService.loadProfile();
      },
      error: (err) => {
        this.verifying.set(false);
        this.errorMessage.set(err.error?.detail || 'The verification link is invalid or has expired.');
      },
    });
  }
}
