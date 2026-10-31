import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let svc: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(NotificationService);
  });

  it('starts empty', () => {
    expect(svc.notifications()).toEqual([]);
  });

  it('show() appends notifications with unique ids', () => {
    svc.show('info', 'a', 0);
    svc.show('info', 'b', 0);
    const [a, b] = svc.notifications();
    expect(a.message).toBe('a');
    expect(b.message).toBe('b');
    expect(a.id).not.toBe(b.id);
  });

  it('dismiss() removes only the matching notification', () => {
    svc.show('info', 'a', 0);
    svc.show('info', 'b', 0);
    svc.dismiss(svc.notifications()[0].id);
    expect(svc.notifications().map((n) => n.message)).toEqual(['b']);
  });

  it('auto-dismisses after the duration', fakeAsync(() => {
    svc.show('info', 'a', 1000);
    tick(999);
    expect(svc.notifications().length).toBe(1);
    tick(1);
    expect(svc.notifications().length).toBe(0);
  }));

  it('duration 0 is sticky', fakeAsync(() => {
    svc.show('info', 'a', 0);
    tick(60000);
    expect(svc.notifications().length).toBe(1);
  }));

  it('error() lives longer (8s) than success() (5s)', fakeAsync(() => {
    svc.error('e');
    svc.success('s');
    tick(5000);
    expect(svc.notifications().map((n) => n.type)).toEqual(['error']);
    tick(3000);
    expect(svc.notifications().length).toBe(0);
  }));
});
