import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let svc: NotificationService;

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(NotificationService);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('starts empty', () => {
    expect(svc.notifications()).toEqual([]);
  });

  it('show appends a notification with a unique id', () => {
    svc.info('a');
    svc.info('b');
    const [a, b] = svc.notifications();
    expect(a.message).toBe('a');
    expect(b.message).toBe('b');
    expect(a.id).not.toBe(b.id);
  });

  it('auto-dismisses after the default 5s duration', () => {
    svc.success('done');
    jasmine.clock().tick(4999);
    expect(svc.notifications().length).toBe(1);
    jasmine.clock().tick(1);
    expect(svc.notifications().length).toBe(0);
  });

  it('error notifications last 8s', () => {
    svc.error('boom');
    jasmine.clock().tick(7999);
    expect(svc.notifications().length).toBe(1);
    jasmine.clock().tick(1);
    expect(svc.notifications().length).toBe(0);
  });

  it('duration 0 keeps the notification until dismissed', () => {
    svc.show('warning', 'sticky', 0);
    jasmine.clock().tick(60_000);
    const [n] = svc.notifications();
    expect(n.message).toBe('sticky');
    svc.dismiss(n.id);
    expect(svc.notifications()).toEqual([]);
  });
});
