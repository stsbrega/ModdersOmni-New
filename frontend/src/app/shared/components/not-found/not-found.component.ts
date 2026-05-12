import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="not-found">
      <div class="not-found__scanlines" aria-hidden="true"></div>
      <div class="not-found__vignette" aria-hidden="true"></div>

      <div class="not-found__content">
        <div class="not-found__prompt">
          <span class="not-found__prefix">&gt;</span>
          <span class="not-found__heading">ERR 404 / not_found</span>
          <span class="not-found__cursor" aria-hidden="true"></span>
        </div>

        <pre class="not-found__diag">[stack trace]
  at router.match({{ requestedPath }})
  at route_table.lookup()
  at <strong>404</strong></pre>

        <p class="not-found__sub">the page you requested isn't part of this build.</p>

        <div class="not-found__actions">
          <a routerLink="/" class="not-found__link not-found__link--primary">
            <span>&gt; return --to base</span>
          </a>
          <a routerLink="/setup" class="not-found__link">
            <span>&gt; start --new-modlist</span>
          </a>
        </div>
      </div>
    </main>
  `,
  styles: [`
    :host { display: block; }

    .not-found {
      position: relative;
      min-height: calc(100vh - var(--header-height, 64px));
      background: var(--color-bg);
      color: var(--color-text);
      display: grid;
      place-content: center;
      overflow: hidden;
      padding: 4rem 2rem;
      font-family: var(--font-mono);
    }

    .not-found__scanlines {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        transparent 0,
        transparent 2px,
        color-mix(in oklch, var(--color-accent) 4%, transparent) 2px,
        color-mix(in oklch, var(--color-accent) 4%, transparent) 3px
      );
      mix-blend-mode: screen;
      opacity: 0.6;
    }

    .not-found__vignette {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(
        ellipse at center,
        transparent 40%,
        oklch(0 0 0 / 0.55) 100%
      );
    }

    .not-found__content {
      position: relative;
      z-index: 1;
      text-align: left;
      max-width: 640px;
    }

    .not-found__prompt {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      font-size: clamp(1.25rem, 3.5vw, 1.875rem);
      color: var(--color-accent);
      margin-bottom: 1.5rem;
      text-shadow: 0 0 12px color-mix(in oklch, var(--color-accent) 30%, transparent);
    }

    .not-found__prefix { font-weight: 600; }

    .not-found__heading {
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: lowercase;
    }

    .not-found__cursor {
      display: inline-block;
      width: 0.6em;
      height: 1.1em;
      background: var(--color-accent);
      margin-left: 0.25rem;
      animation: not-found-cursor 1s steps(1) infinite;
      align-self: center;
      box-shadow: 0 0 8px color-mix(in oklch, var(--color-accent) 40%, transparent);
    }
    @keyframes not-found-cursor {
      50% { opacity: 0; }
    }

    .not-found__diag {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      line-height: 1.6;
      color: var(--color-text-muted);
      margin: 0 0 2rem;
      padding: 1rem 1.25rem;
      background: color-mix(in oklch, var(--color-accent) 4%, var(--color-surface-1));
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      white-space: pre;
      overflow-x: auto;
    }
    .not-found__diag strong {
      color: var(--color-danger);
      font-weight: 600;
    }

    .not-found__sub {
      font-family: var(--font-sans);
      font-size: 0.9375rem;
      color: var(--color-text-muted);
      margin: 0 0 2rem;
    }

    .not-found__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .not-found__link {
      display: inline-flex;
      align-items: center;
      padding: 0.625rem 1rem;
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      text-decoration: none;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      color: var(--color-text-muted);
      background: var(--color-bg);
      transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    .not-found__link:hover {
      color: var(--color-accent);
      border-color: color-mix(in oklch, var(--color-accent) 35%, var(--color-border));
      background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg));
    }
    .not-found__link--primary {
      color: var(--color-accent);
      border-color: color-mix(in oklch, var(--color-accent) 30%, var(--color-border));
    }
    .not-found__link--primary:hover {
      background: var(--color-accent);
      color: var(--color-bg);
    }

    @media (prefers-reduced-motion: reduce) {
      .not-found__cursor { animation: none; opacity: 1; }
      .not-found__scanlines { display: none; }
    }
  `],
})
export class NotFoundComponent {
  private readonly router = inject(Router);
  protected readonly requestedPath = this.router.url || '/';
}
