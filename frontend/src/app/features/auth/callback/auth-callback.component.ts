import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="callback-page">
      <div class="callback-card">
        <div class="spinner"></div>
        <p>{{ message }}</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .callback-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-dark);
    }
    .callback-card {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
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
    p {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
  `],
})
export class AuthCallbackComponent implements OnInit {
  message = 'Signing you in...';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  private static readonly ERROR_MESSAGES: Record<string, string> = {
    access_denied: 'You declined the sign-in request.',
    invalid_state: 'Session expired. Please try again.',
    exchange_failed: 'Authentication failed. Please try again.',
    provider_unavailable: 'This sign-in method is not available.',
    missing_code: 'Invalid callback from provider.',
  };

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const error = params['error'];
    const token = params['token'];

    if (error) {
      this.message =
        AuthCallbackComponent.ERROR_MESSAGES[error] ??
        'Sign-in failed. Redirecting...';
      setTimeout(() => this.router.navigateByUrl('/auth/login'), 3000);
      return;
    }

    if (!token) {
      this.message = 'Invalid callback. Redirecting...';
      setTimeout(() => this.router.navigateByUrl('/auth/login'), 2000);
      return;
    }

    this.authService.setAccessToken(token);
    this.authService.loadProfileAsync().subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: () => {
        this.message = 'Sign-in failed. Redirecting...';
        setTimeout(() => this.router.navigateByUrl('/auth/login'), 2000);
      },
    });
  }
}
