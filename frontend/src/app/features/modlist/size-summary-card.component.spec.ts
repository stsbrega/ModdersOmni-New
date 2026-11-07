import { TestBed } from '@angular/core/testing';
import { SizeSummaryCardComponent } from './size-summary-card.component';
import { SizeSummary } from '../../shared/models/mod.model';

const GB = 1024 ** 3;

function make(overrides: Partial<SizeSummary> = {}): SizeSummary {
  return {
    download_bytes: 2 * GB,
    installed_estimate_bytes: 5 * GB,
    largest_drive_free_bytes: 50 * GB,
    fit_status: 'comfortable',
    sized_count: 10,
    total_count: 10,
    unsized_count: 0,
    ...overrides,
  };
}

function render(summary: SizeSummary): HTMLElement {
  const fixture = TestBed.createComponent(SizeSummaryCardComponent);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SizeSummaryCardComponent', () => {
  it('formats bytes as GB with one decimal', () => {
    const fixture = TestBed.createComponent(SizeSummaryCardComponent);
    expect(fixture.componentInstance.formatBytes(1.5 * GB)).toBe('1.5 GB');
    expect(fixture.componentInstance.formatBytes(0)).toBe('0.0 GB');
  });

  it('shows download and installed totals', () => {
    const text = render(make()).textContent!;
    expect(text).toContain('2.0 GB');
    expect(text).toContain('~5.0 GB');
  });

  it('shows the comfortable message', () => {
    const el = render(make());
    expect(el.querySelector('.ok')?.textContent).toContain('Comfortable fit');
  });

  it('shows the tight warning', () => {
    const el = render(make({ fit_status: 'tight' }));
    expect(el.querySelector('.warn')?.textContent).toContain('Tight fit');
  });

  it('reports the shortfall when insufficient', () => {
    const el = render(
      make({ fit_status: 'insufficient', installed_estimate_bytes: 30 * GB, largest_drive_free_bytes: 10 * GB }),
    );
    const err = el.querySelector('.err')!.textContent!;
    expect(err).toContain('Insufficient');
    expect(err).toContain('~20.0 GB');
  });

  it('prompts for drive info when fit is unknown', () => {
    const el = render(make({ fit_status: 'unknown', largest_drive_free_bytes: null }));
    expect(el.querySelector('.unknown')?.textContent).toContain('Add drive info');
  });

  it('only shows the unsized note when some mods are unsized', () => {
    expect(render(make()).querySelector('.note')).toBeNull();
    const el = render(make({ sized_count: 8, unsized_count: 2 }));
    expect(el.querySelector('.note')?.textContent).toContain('8 sized · 2 unsized');
  });
});
