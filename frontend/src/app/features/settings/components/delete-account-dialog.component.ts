import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-delete-account-dialog',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="!working() && cancel.emit()"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
      <h2 id="delete-dialog-title">Delete your account?</h2>
      <p class="warn">
        This permanently deletes your account, all modlists, and all settings. This cannot be undone.
      </p>
      <label>
        Type <strong>DELETE</strong> to confirm:
        <input
          type="text"
          [(ngModel)]="confirmText"
          autocomplete="off"
          spellcheck="false"
          [disabled]="working()"
        />
      </label>
      <div class="actions">
        <button type="button" class="cancel" (click)="cancel.emit()" [disabled]="working()">
          Cancel
        </button>
        <button
          type="button"
          class="danger"
          [disabled]="confirmText !== 'DELETE' || working()"
          (click)="confirm()"
        >
          {{ working() ? 'Deleting…' : 'Delete account' }}
        </button>
      </div>
      @if (error()) { <p class="err">{{ error() }}</p> }
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 190;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--color-bg-card);
      color: var(--color-text);
      padding: 1.75rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-elevated);
      z-index: 200;
      width: min(480px, 92vw);
      animation: dialog-enter 0.18s ease-out;
    }
    @keyframes dialog-enter {
      from { opacity: 0; transform: translate(-50%, -46%) scale(0.97); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      color: #ef4444;
    }
    .warn {
      color: var(--color-text-muted);
      font-size: 0.875rem;
      line-height: 1.5;
      margin: 0 0 1rem;
    }
    label {
      display: block;
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      margin: 0.75rem 0 1rem;
    }
    strong {
      color: var(--color-text);
    }
    input {
      display: block;
      width: 100%;
      margin-top: 0.4rem;
      padding: 0.55rem 0.75rem;
      font-size: 0.875rem;
      background: var(--color-bg-elevated);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      font-family: inherit;
    }
    input:focus {
      outline: none;
      border-color: rgba(239, 68, 68, 0.5);
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
    }
    input:disabled {
      opacity: 0.6;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 1rem;
    }
    button {
      padding: 0.5rem 1rem;
      font-size: 0.8125rem;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s, border-color 0.15s, opacity 0.15s;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .cancel {
      background: transparent;
      color: var(--color-text);
      border-color: var(--color-border);
    }
    .cancel:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.04);
    }
    .danger {
      background: #ef4444;
      color: #fff;
    }
    .danger:hover:not(:disabled) {
      background: #dc2626;
    }
    .err {
      color: #ef4444;
      font-size: 0.8125rem;
      margin: 0.75rem 0 0;
    }
  `],
})
export class DeleteAccountDialogComponent {
  @Output() readonly cancel = new EventEmitter<void>();

  protected confirmText = '';
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly auth = inject(AuthService);

  confirm(): void {
    if (this.confirmText !== 'DELETE' || this.working()) return;
    this.working.set(true);
    this.error.set(null);
    this.auth.deleteAccount().subscribe({
      next: () => {
        this.auth.logout();
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'Failed to delete account. Try again.');
        this.working.set(false);
      },
    });
  }
}
