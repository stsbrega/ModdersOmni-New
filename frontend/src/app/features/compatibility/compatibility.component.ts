import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-compatibility',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="compatibility-page">
      <div class="page-header">
        <h1>Mod Compatibility Checker</h1>
        <p>Check if two mods are compatible before installing them together</p>
      </div>

      <div class="checker-card">
        <div class="input-group">
          <label for="modA">Mod A</label>
          <input
            id="modA"
            type="text"
            class="mod-input"
            placeholder="Enter first mod name..."
            [ngModel]="modAName()"
            (ngModelChange)="modAName.set($event)"
          />
        </div>

        <div class="versus-divider">
          <span>vs</span>
        </div>

        <div class="input-group">
          <label for="modB">Mod B</label>
          <input
            id="modB"
            type="text"
            class="mod-input"
            placeholder="Enter second mod name..."
            [ngModel]="modBName()"
            (ngModelChange)="modBName.set($event)"
          />
        </div>

        <div class="input-group">
          <label for="game">Game</label>
          <select
            id="game"
            class="mod-input"
            [ngModel]="gameSlug()"
            (ngModelChange)="gameSlug.set($event)"
          >
            <option value="skyrimspecialedition">Skyrim Special Edition</option>
            <option value="fallout4">Fallout 4</option>
          </select>
        </div>

        <button
          class="check-btn bg-accent text-white rounded-lg px-6 py-3"
          [disabled]="loading()"
          (click)="checkCompatibility()"
        >
          @if (loading()) {
            <span class="spinner"></span>
            Checking...
          } @else {
            Check Compatibility
          }
        </button>
      </div>

      @if (error()) {
        <div class="error-card">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <span>{{ error() }}</span>
        </div>
      }

      @if (result()) {
        <div class="results-card">
          <div class="results-header">
            <h2>Results</h2>
            <button class="clear-btn" (click)="clearResults()">Clear</button>
          </div>

          <div class="badges-row">
            <span
              class="badge"
              [class.badge-compatible]="result().compatible"
              [class.badge-incompatible]="!result().compatible"
            >
              {{ result().compatible ? 'Compatible' : 'Incompatible' }}
            </span>

            <span
              class="badge"
              [class.badge-high]="result().confidence === 'high'"
              [class.badge-medium]="result().confidence === 'medium'"
              [class.badge-low]="result().confidence === 'low'"
            >
              {{ result().confidence | titlecase }} Confidence
            </span>
          </div>

          @if (result().issues && result().issues.length > 0) {
            <div class="issues-section">
              <h3>Issues Found</h3>
              <ul class="issues-list">
                @for (issue of result().issues; track issue.description) {
                  <li class="issue-item">
                    <span
                      class="severity-badge"
                      [class.severity-warning]="issue.severity === 'warning'"
                      [class.severity-critical]="issue.severity === 'critical'"
                    >
                      {{ issue.severity | titlecase }}
                    </span>
                    <div class="issue-details">
                      <span class="issue-description">{{ issue.description }}</span>
                      @if (issue.source) {
                        <span class="issue-source">Source: {{ issue.source }}</span>
                      }
                    </div>
                  </li>
                }
              </ul>
            </div>
          }

          @if (result().suggested_patches && result().suggested_patches.length > 0) {
            <div class="patches-section">
              <h3>Suggested Patches</h3>
              <ul class="patches-list">
                @for (patch of result().suggested_patches; track patch) {
                  <li class="patch-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                    <span>{{ patch }}</span>
                  </li>
                }
              </ul>
            </div>
          }

          @if (result().issues?.length === 0 && result().compatible) {
            <div class="all-clear">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>No issues detected. These mods should work well together.</span>
            </div>
          }
        </div>
      }

      @if (!result() && !error() && !loading()) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>Enter two mod names above and click "Check Compatibility" to see if they work together.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .compatibility-page {
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .page-header {
      margin-bottom: 2rem;

      h1 {
        font-family: 'Playfair Display', serif;
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 0.5rem;
      }

      p {
        color: var(--text-secondary);
        font-size: 1rem;
        margin: 0;
      }
    }

    .checker-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      label {
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
      }
    }

    .mod-input {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: var(--text-primary);
      width: 100%;
      font-size: 0.95rem;
      transition: border-color 0.2s ease;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: var(--accent);
      }

      &::placeholder {
        color: var(--text-secondary);
        opacity: 0.6;
      }
    }

    select.mod-input {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 1rem center;

      option {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
    }

    .versus-divider {
      display: flex;
      align-items: center;
      justify-content: center;

      span {
        color: var(--text-secondary);
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        opacity: 0.6;
      }
    }

    .check-btn {
      align-self: flex-start;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: opacity 0.2s ease, transform 0.1s ease;

      &:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-card {
      margin-top: 1.5rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #ef4444;
      font-size: 0.95rem;
    }

    .results-card {
      margin-top: 1.5rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 2rem;
    }

    .results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;

      h2 {
        font-family: 'Playfair Display', serif;
        font-size: 1.35rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
    }

    .clear-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
      color: var(--text-secondary);
      font-size: 0.8rem;
      cursor: pointer;
      transition: border-color 0.2s ease, color 0.2s ease;

      &:hover {
        border-color: var(--text-secondary);
        color: var(--text-primary);
      }
    }

    .badges-row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1.5rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.35rem 0.85rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .badge-compatible {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .badge-incompatible {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .badge-high {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }

    .badge-medium {
      background: rgba(234, 179, 8, 0.1);
      color: #eab308;
      border: 1px solid rgba(234, 179, 8, 0.2);
    }

    .badge-low {
      background: rgba(156, 163, 175, 0.1);
      color: #9ca3af;
      border: 1px solid rgba(156, 163, 175, 0.2);
    }

    .issues-section, .patches-section {
      margin-bottom: 1.5rem;

      h3 {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 0.75rem;
      }
    }

    .issues-list, .patches-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .issue-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .severity-badge {
      flex-shrink: 0;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      margin-top: 0.1rem;
    }

    .severity-warning {
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
    }

    .severity-critical {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .issue-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .issue-description {
      color: var(--text-primary);
      font-size: 0.9rem;
    }

    .issue-source {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    .patch-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.6rem 0.85rem;
      background: rgba(var(--accent-rgb, 99, 102, 241), 0.06);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 0.9rem;

      svg {
        flex-shrink: 0;
        color: var(--accent);
      }
    }

    .all-clear {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.2);
      border-radius: 10px;
      color: #22c55e;
      font-size: 0.95rem;
    }

    .empty-state {
      margin-top: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 3rem 1rem;
      color: var(--text-secondary);
      opacity: 0.5;
      text-align: center;

      p {
        max-width: 400px;
        font-size: 0.95rem;
        line-height: 1.5;
        margin: 0;
      }
    }

    @media (max-width: 640px) {
      .compatibility-page {
        padding: 1.5rem 0.75rem;
      }

      .checker-card, .results-card {
        padding: 1.25rem;
      }

      .page-header h1 {
        font-size: 1.5rem;
      }
    }
  `],
})
export class CompatibilityComponent {
  private api = inject(ApiService);

  modAName = signal('');
  modBName = signal('');
  gameSlug = signal('skyrimspecialedition');
  loading = signal(false);
  result = signal<any>(null);
  error = signal('');

  checkCompatibility(): void {
    const modA = this.modAName().trim();
    const modB = this.modBName().trim();

    if (!modA || !modB) {
      this.error.set('Please enter both mod names.');
      return;
    }

    this.error.set('');
    this.result.set(null);
    this.loading.set(true);

    this.api.checkCompatibility(modA, modB, this.gameSlug()).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        const message =
          err?.error?.detail ||
          err?.error?.message ||
          'Failed to check compatibility. Please try again.';
        this.error.set(message);
        this.loading.set(false);
      },
    });
  }

  clearResults(): void {
    this.result.set(null);
    this.error.set('');
  }
}
