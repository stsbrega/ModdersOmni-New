import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiLabelComponent } from './label.component';

@Component({
  standalone: true,
  imports: [UiLabelComponent],
  template: `<label ui-label for="x">Name</label><input id="x" />`,
})
class HostComponent {}

describe('UiLabelComponent', () => {
  it('projects text and preserves the native for association', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const label: HTMLLabelElement = f.nativeElement.querySelector('label');
    expect(label.textContent).toBe('Name');
    expect(label.htmlFor).toBe('x');
    expect(label.control?.id).toBe('x');
  });
});
