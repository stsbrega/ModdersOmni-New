import { Component, TemplateRef, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiSheetComponent } from './sheet.component';

@Component({
  standalone: true,
  imports: [UiSheetComponent],
  template: `<ui-sheet /><ng-template #tpl><p class="sheet-body">hi</p></ng-template>`,
})
class HostComponent {
  @ViewChild(UiSheetComponent, { static: true }) sheet!: UiSheetComponent;
  @ViewChild('tpl', { static: true }) tpl!: TemplateRef<unknown>;
}

describe('UiSheetComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  const body = () => document.querySelector('.sheet-body');
  const press = (init: KeyboardEventInit) =>
    document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));

  it('renders the template with side modifier class', () => {
    host.sheet.open(host.tpl, 'left');
    fixture.detectChanges();
    expect(body()).not.toBeNull();
    expect(document.querySelector('.ui-sheet__panel--left')).not.toBeNull();
  });

  it('closes on backdrop click', () => {
    host.sheet.open(host.tpl);
    fixture.detectChanges();
    (document.querySelector('.ui-sheet__backdrop') as HTMLElement).click();
    expect(body()).toBeNull();
  });

  it('closes on Escape', () => {
    host.sheet.open(host.tpl);
    fixture.detectChanges();
    press({ key: 'Escape' });
    expect(body()).toBeNull();
  });

  it('ignores Escape with a modifier key and other keys', () => {
    host.sheet.open(host.tpl);
    fixture.detectChanges();
    press({ key: 'Escape', shiftKey: true });
    press({ key: 'a' });
    expect(body()).not.toBeNull();
  });
});
