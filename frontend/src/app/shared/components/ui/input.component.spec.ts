import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiInputComponent } from './input.component';

@Component({
  standalone: true,
  imports: [UiInputComponent],
  template: `<input ui-input [mono]="mono" />`,
})
class HostComponent {
  mono = false;
}

describe('UiInputComponent', () => {
  it('omits the mono class by default', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('input').classList).not.toContain('ui-input--mono');
  });

  it('adds the mono class when mono is true', () => {
    const f = TestBed.createComponent(HostComponent);
    f.componentInstance.mono = true;
    f.detectChanges();
    expect(f.nativeElement.querySelector('input').classList).toContain('ui-input--mono');
  });
});
