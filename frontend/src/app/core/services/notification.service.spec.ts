import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('adds notifications with incrementing ids', () => {
    service.info('a');
    service.info('b');
    const ids = service.notifications().map((n) => n.id);
    expect(ids.length).toBe(2);
    expect(ids[1]).toBeGreaterThan(ids[0]);
  });

  it('dismiss removes only the matching notification', () => {
    service.show('info', 'a', 0);
    service.show('info', 'b', 0);
    const [first] = service.notifications();
    service.dismiss(first.id);
    expect(service.notifications().map((n) => n.message)).toEqual(['b']);
  });

  it('auto-dismisses after the duration', fakeAsync(() => {
    service.show('success', 'bye', 1000);
    expect(service.notifications().length).toBe(1);
    tick(1000);
    expect(service.notifications().length).toBe(0);
  }));

  it('does not auto-dismiss when duration is 0', fakeAsync(() => {
    service.show('warning', 'sticky', 0);
    tick(60000);
    expect(service.notifications().length).toBe(1);
  }));

  it('error uses a longer duration than the other helpers', () => {
    service.error('e');
    service.success('s');
    const [e, s] = service.notifications();
    expect(e.type).toBe('error');
    expect(e.duration).toBe(8000);
    expect(s.duration).toBe(5000);
  });
});
