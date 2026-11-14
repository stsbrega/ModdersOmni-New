import { Component, TemplateRef, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
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

  it('lets callers override defaults via config', () => {
    host.dialog.open(host.tpl, { panelClass: 'custom-panel' });
    fixture.detectChanges();
    expect(document.querySelector('.custom-panel')).not.toBeNull();
    expect(document.querySelector('.ui-dialog__panel')).toBeNull();
  });
});
