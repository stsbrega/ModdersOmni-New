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
    svc.info('a');
    svc.warning('b');
    const list = svc.notifications();
    expect(list.map((n) => n.message)).toEqual(['a', 'b']);
    expect(list[0].id).not.toBe(list[1].id);
    expect(list.map((n) => n.type)).toEqual(['info', 'warning']);
  });

  it('dismiss() removes only the matching notification', () => {
    svc.success('a');
    svc.success('b');
    svc.dismiss(svc.notifications()[0].id);
    expect(svc.notifications().map((n) => n.message)).toEqual(['b']);
  });

  it('auto-dismisses after the default duration', fakeAsync(() => {
    svc.info('temp');
    tick(4999);
    expect(svc.notifications().length).toBe(1);
    tick(1);
    expect(svc.notifications().length).toBe(0);
  }));

  it('error() lingers longer (8s) than other types', fakeAsync(() => {
    svc.error('bad');
    tick(5000);
    expect(svc.notifications().length).toBe(1);
    tick(3000);
    expect(svc.notifications().length).toBe(0);
  }));

  it('duration 0 keeps the notification until dismissed', fakeAsync(() => {
    svc.show('info', 'sticky', 0);
    tick(60_000);
    expect(svc.notifications().length).toBe(1);
  }));
});
