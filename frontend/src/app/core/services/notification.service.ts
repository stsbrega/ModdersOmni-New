import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private _notifications = signal<Notification[]>([]);
  private nextId = 0;

  readonly notifications = this._notifications.asReadonly();

  show(type: Notification['type'], message: string, duration = 5000): void {
    const id = this.nextId++;
    const notification: Notification = { id, type, message, duration };

    this._notifications.update((current) => [...current, notification]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  dismiss(id: number): void {
    this._notifications.update((current) =>
      current.filter((n) => n.id !== id)
    );
  }

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message, 8000);
  }

  warning(message: string): void {
    this.show('warning', message);
  }

  info(message: string): void {
    this.show('info', message);
  }
}
