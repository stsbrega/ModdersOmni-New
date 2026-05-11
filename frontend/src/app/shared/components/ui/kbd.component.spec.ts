import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiKbdComponent } from './kbd.component';

// Test host so we can project text into <ui-kbd> via Angular's standard
// template path — no innerHTML, no manual DOM mutation.
@Component({
  standalone: true,
  imports: [UiKbdComponent],
  template: `<ui-kbd>Ctrl</ui-kbd>`,
})
class HostComponent {}

describe('UiKbdComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('wraps projected content in a <kbd> element', () => {
    const tag = fixture.nativeElement.querySelector('kbd');
    expect(tag).toBeTruthy();
    expect(tag.textContent.trim()).toBe('Ctrl');
  });

  it('host element has the ui-kbd class', () => {
    const host = fixture.nativeElement.querySelector('ui-kbd');
    expect(host.classList.contains('ui-kbd')).toBe(true);
  });
});
