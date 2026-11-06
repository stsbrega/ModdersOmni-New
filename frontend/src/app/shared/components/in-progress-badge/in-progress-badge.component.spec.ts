import { TestBed } from '@angular/core/testing';
import { InProgressBadgeComponent } from './in-progress-badge.component';

function render(inputs: Record<string, unknown>): HTMLElement {
  const fixture = TestBed.createComponent(InProgressBadgeComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('InProgressBadgeComponent', () => {
  it('defaults to Complete', () => {
    expect(render({}).textContent).toContain('Complete');
  });

  it('shows phase progress and elapsed time while running', () => {
    const el = render({ status: 'running', phaseIndex: 3, totalPhases: 10, elapsed: '3m 12s' });
    expect(el.textContent).toContain('In progress — phase 3 of 10 (3m 12s)');
    expect(el.querySelector('.badge')!.classList).toContain('running');
  });

  it('shows Paused with the paused class', () => {
    const el = render({ status: 'paused' });
    expect(el.textContent).toContain('Paused');
    expect(el.querySelector('.badge')!.classList).toContain('paused');
  });

  it('shows Failed with the failed class', () => {
    const el = render({ status: 'failed' });
    expect(el.textContent).toContain('Failed');
    expect(el.querySelector('.badge')!.classList).toContain('failed');
  });
});
