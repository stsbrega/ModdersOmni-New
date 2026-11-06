import { TestBed } from '@angular/core/testing';
import { UiBadgeComponent } from './badge.component';

describe('UiBadgeComponent', () => {
  it('defaults to the default variant class', () => {
    const fixture = TestBed.createComponent(UiBadgeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.className).toContain('badge-default');
  });

  it('reflects the variant input as a host class', () => {
    const fixture = TestBed.createComponent(UiBadgeComponent);
    fixture.componentRef.setInput('variant', 'danger');
    fixture.detectChanges();
    expect(fixture.nativeElement.className).toContain('badge-danger');
  });
});
