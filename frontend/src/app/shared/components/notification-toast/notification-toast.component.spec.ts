import { TestBed } from '@angular/core/testing';
import { NotificationToastComponent } from './notification-toast.component';
import { NotificationService } from '../../../core/services/notification.service';

describe('NotificationToastComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [NotificationToastComponent] });
    const fixture = TestBed.createComponent(NotificationToastComponent);
    const svc = TestBed.inject(NotificationService);
    return { fixture, svc, el: fixture.nativeElement as HTMLElement };
  }

  it('renders nothing when there are no notifications', () => {
    const { fixture, el } = setup();
    fixture.detectChanges();
    expect(el.querySelectorAll('.toast').length).toBe(0);
  });

  it('renders a toast per notification with its message', () => {
    const { fixture, svc, el } = setup();
    svc.show('info', 'hello', 0);
    svc.show('success', 'saved', 0);
    fixture.detectChanges();
    const toasts = el.querySelectorAll('.toast');
    expect(toasts.length).toBe(2);
    expect(toasts[0].textContent).toContain('hello');
    expect(toasts[1].classList).toContain('toast-success');
  });

  it('dismisses a toast on click', () => {
    const { fixture, svc, el } = setup();
    svc.show('warning', 'careful', 0);
    fixture.detectChanges();
    (el.querySelector('.toast') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.toast').length).toBe(0);
  });

  it('exposes a polite live region and uses role=alert only for errors', () => {
    const { fixture, svc, el } = setup();
    svc.show('error', 'boom', 0);
    svc.show('info', 'fyi', 0);
    fixture.detectChanges();
    expect(el.querySelector('.toast-container')?.getAttribute('aria-live')).toBe('polite');
    const toasts = el.querySelectorAll('.toast');
    expect(toasts[0].getAttribute('role')).toBe('alert');
    expect(toasts[1].getAttribute('role')).toBe('status');
  });
});
