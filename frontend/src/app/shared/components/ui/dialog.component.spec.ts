import { Component, TemplateRef, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { UiDialogComponent } from './dialog.component';

@Component({
  standalone: true,
  imports: [UiDialogComponent],
  template: `<ui-dialog /><ng-template #tpl><p class="dialog-body">hi</p></ng-template>`,
})
class HostComponent {
  @ViewChild(UiDialogComponent, { static: true }) dialog!: UiDialogComponent;
  @ViewChild('tpl', { static: true }) tpl!: TemplateRef<unknown>;
}

describe('UiDialogComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
  });

  // Close through the CDK service rather than wiping the overlay DOM: clearing
  // innerHTML leaves the Dialog's openDialogs list, focus traps and keydown
  // listeners alive, so a failure in one spec could leak into the next.
  afterEach(() => {
    TestBed.inject(Dialog).closeAll();
  });

  const body = () => document.querySelector('.dialog-body');

  it('renders the template inside the styled panel with a backdrop', () => {
    host.dialog.open(host.tpl);
    fixture.detectChanges();
    expect(body()).not.toBeNull();
    expect(document.querySelector('.ui-dialog__panel')).not.toBeNull();
    expect(document.querySelector('.ui-dialog__backdrop')).not.toBeNull();
  });

  it('closes on backdrop click', () => {
    host.dialog.open(host.tpl);
    fixture.detectChanges();
    (document.querySelector('.ui-dialog__backdrop') as HTMLElement).click();
    expect(body()).toBeNull();
  });

  it('emits the close result via the DialogRef', () => {
    const ref = host.dialog.open<string>(host.tpl);
    fixture.detectChanges();
    let result: string | undefined;
    ref.closed.subscribe((r) => (result = r));
    ref.close('done');
    expect(result).toBe('done');
    expect(body()).toBeNull();
  });

  it('closes on Escape', () => {
    host.dialog.open(host.tpl);
    fixture.detectChanges();
    const panel = document.querySelector('.ui-dialog__panel') as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    expect(body()).toBeNull();
  });

  it('lets callers override defaults via config', () => {
    host.dialog.open(host.tpl, { panelClass: 'custom-panel' });
    fixture.detectChanges();
    expect(document.querySelector('.custom-panel')).not.toBeNull();
    expect(document.querySelector('.ui-dialog__panel')).toBeNull();
  });
});
