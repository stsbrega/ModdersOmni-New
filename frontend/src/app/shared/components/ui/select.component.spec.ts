import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiSelectComponent, UiSelectOption } from './select.component';

@Component({
  standalone: true,
  imports: [UiSelectComponent],
  template: `<ui-select [options]="options" [value]="value" [disabled]="disabled"
    placeholder="Pick one" (selectionChange)="picked = $event" />`,
})
class HostComponent {
  options: UiSelectOption[] = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta', disabled: true },
    { value: 'c', label: 'Gamma' },
  ];
  value: unknown = null;
  disabled = false;
  picked: unknown;
}

describe('UiSelectComponent', () => {
  function setup() {
    const f = TestBed.createComponent(HostComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const trigger = () => el.querySelector('button') as HTMLButtonElement;
    return { f, el, trigger };
  }

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  it('shows the placeholder when nothing is selected', () => {
    const { trigger } = setup();
    expect(trigger().textContent).toContain('Pick one');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the selected option label', () => {
    const { f, trigger } = setup();
    f.componentInstance.value = 'c';
    f.detectChanges();
    expect(trigger().textContent).toContain('Gamma');
  });

  it('opens the listbox on click and renders all options', () => {
    const { f, trigger } = setup();
    trigger().click();
    f.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const opts = document.querySelectorAll('[role="option"]');
    expect(opts.length).toBe(3);
  });

  it('emits selectionChange and closes when an option is clicked', () => {
    const { f, trigger } = setup();
    trigger().click();
    f.detectChanges();
    (document.querySelectorAll('[role="option"]')[2] as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.picked).toBe('c');
    expect(document.querySelectorAll('[role="option"]').length).toBe(0);
  });

  it('ignores clicks on disabled options', () => {
    const { f, trigger } = setup();
    trigger().click();
    f.detectChanges();
    (document.querySelectorAll('[role="option"]')[1] as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.picked).toBeUndefined();
  });

  it('does not open when disabled', () => {
    const { f, trigger } = setup();
    f.componentInstance.disabled = true;
    f.detectChanges();
    const sel = f.debugElement.children[0].componentInstance as UiSelectComponent;
    sel.open();
    expect(sel.isOpen).toBeFalse();
    expect(document.querySelectorAll('[role="option"]').length).toBe(0);
  });
});
