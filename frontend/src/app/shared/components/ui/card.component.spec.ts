import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiCardComponent } from './card.component';

@Component({
  standalone: true,
  imports: [UiCardComponent],
  template: `<ui-card><p class="inner">hello</p></ui-card>`,
})
class HostComponent {}

describe('UiCardComponent', () => {
  it('projects its content', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const inner = f.nativeElement.querySelector('ui-card .inner');
    expect(inner?.textContent).toBe('hello');
  });
});
