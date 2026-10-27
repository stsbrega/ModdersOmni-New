import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jasmine.clock().install();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('adds notifications with unique ids', () => {
    service.info('a');
    service.info('b');
    const [a, b] = service.notifications();
    expect(a.id).not.toBe(b.id);
    expect(service.notifications().map((n) => n.message)).toEqual(['a', 'b']);
  });

  it('auto-dismisses after the default duration', () => {
    service.success('done');
    jasmine.clock().tick(4999);
    expect(service.notifications().length).toBe(1);
    jasmine.clock().tick(1);
    expect(service.notifications().length).toBe(0);
  });

  it('keeps errors visible longer (8s)', () => {
    service.error('boom');
    jasmine.clock().tick(5000);
    expect(service.notifications().length).toBe(1);
    jasmine.clock().tick(3000);
    expect(service.notifications().length).toBe(0);
  });

  it('does not auto-dismiss when duration is 0', () => {
    service.show('warning', 'sticky', 0);
    jasmine.clock().tick(60000);
    expect(service.notifications().length).toBe(1);
  });

  it('dismiss removes only the matching notification', () => {
    service.show('info', 'a', 0);
    service.show('info', 'b', 0);
    service.dismiss(service.notifications()[0].id);
    expect(service.notifications().map((n) => n.message)).toEqual(['b']);
  });
});
