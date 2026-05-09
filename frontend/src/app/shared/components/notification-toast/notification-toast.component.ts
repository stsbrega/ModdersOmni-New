import { Component } from '@angular/core';
import { NotificationService, Notification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  template: `
    <div class="toast-container">
      @for (n of notifications.notifications(); track n.id) {
        <div class="toast" [class]="'toast-' + n.type" (click)="notifications.dismiss(n.id)">
          <span class="toast-icon">
            @switch (n.type) {
              @case ('success') { &#10003; }
              @case ('error') { &#10007; }
              @case ('warning') { &#9888; }
              @case ('info') { &#8505; }
            }
          </span>
          <span class="toast-message">{{ n.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 80px;
      right: 1.5rem;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 380px;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      cursor: pointer;
      animation: slideIn 0.25s ease-out;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .toast-icon { font-size: 1rem; flex-shrink: 0; }
    .toast-message { flex: 1; }

    .toast-success { background: #14532d; color: #86efac; border: 1px solid #166534; }
    .toast-error { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; }
    .toast-warning { background: #78350f; color: #fcd34d; border: 1px solid #92400e; }
    .toast-info { background: #1e3a5f; color: #93c5fd; border: 1px solid #1e40af; }
  `],
})
export class NotificationToastComponent {
  constructor(public notifications: NotificationService) {}
}
