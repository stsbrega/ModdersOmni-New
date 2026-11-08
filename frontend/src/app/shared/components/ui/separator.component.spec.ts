import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiSeparatorComponent } from './separator.component';

@Component({
  standalone: true,
  imports: [UiSeparatorComponent],
  template: `<ui-separator [orientation]="o"></ui-separator>`,
})
class HostComponent {
  o: 'horizontal' | 'vertical' = 'horizontal';
}

describe('UiSeparatorComponent', () => {
  it('has separator role and defaults to horizontal', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const el = f.nativeElement.querySelector('ui-separator') as HTMLElement;
    expect(el.getAttribute('role')).toBe('separator');
    expect(el.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('reflects vertical orientation', () => {
    const f = TestBed.createComponent(HostComponent);
    f.componentInstance.o = 'vertical';
    f.detectChanges();
    const el = f.nativeElement.querySelector('ui-separator') as HTMLElement;
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.getAttribute('orientation')).toBe('vertical');
  });
});
