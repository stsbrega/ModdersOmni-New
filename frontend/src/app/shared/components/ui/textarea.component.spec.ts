import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiTextareaComponent } from './textarea.component';

@Component({
  standalone: true,
  imports: [UiTextareaComponent],
  template: `<textarea ui-textarea [mono]="mono"></textarea>`,
})
class HostComponent {
  mono = false;
}

describe('UiTextareaComponent', () => {
  it('omits the mono class by default', () => {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('textarea').classList).not.toContain('ui-textarea--mono');
  });

  it('adds the mono class when mono is true', () => {
    const f = TestBed.createComponent(HostComponent);
    f.componentInstance.mono = true;
    f.detectChanges();
    expect(f.nativeElement.querySelector('textarea').classList).toContain('ui-textarea--mono');
  });
});
