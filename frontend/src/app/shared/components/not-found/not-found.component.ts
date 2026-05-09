import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="not-found">
      <h1>404</h1>
      <p class="lead">This page doesn't exist.</p>
      <p class="sub">Maybe you were looking for your Dashboard or starting a new build?</p>
      <div class="actions">
        <a routerLink="/dashboard" class="btn btn-primary">Go to Dashboard</a>
        <a routerLink="/setup" class="btn btn-secondary">Start a New Build</a>
      </div>
    </main>
  `,
  styles: [`
    .not-found {
      min-height: calc(100vh - var(--header-height, 60px));
      display: grid;
      place-content: center;
      text-align: center;
      gap: 0.75rem;
      padding: 4rem 1.5rem;
      max-width: 560px;
      margin: 0 auto;
    }
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: clamp(4rem, 12vw, 6.5rem);
      font-weight: 700;
      margin: 0;
      color: var(--color-gold);
      line-height: 1;
      letter-spacing: -0.02em;
    }
    .lead {
      font-size: 1.125rem;
      font-weight: 500;
      color: var(--color-text);
      margin: 0.5rem 0 0;
    }
    .sub {
      color: var(--color-text-muted);
      font-size: 0.9375rem;
      margin: 0 0 1.25rem;
      line-height: 1.5;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 0.5rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.625rem 1.25rem;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    }
    .btn:hover {
      transform: translateY(-1px);
    }
    .btn-primary {
      background: var(--color-gold);
      color: #0D0D0F;
    }
    .btn-primary:hover {
      background: var(--color-gold-hover);
      box-shadow: 0 4px 20px rgba(196, 165, 90, 0.25);
    }
    .btn-secondary {
      background: transparent;
      color: var(--color-text);
      border: 1px solid var(--color-border);
    }
    .btn-secondary:hover {
      border-color: rgba(196, 165, 90, 0.3);
      color: var(--color-gold);
    }
  `],
})
export class NotFoundComponent {}
