// frontend/src/app/shared/components/ui/dialog.component.ts
//
// UiDialogComponent — thin wrapper over CDK's Dialog service.
//
// CDK Dialog handles: modal stacking, focus trap, Esc-to-close, backdrop
// click-to-close, ARIA dialog role/labels, restoration of focus on close.
// We only own the visual styling for the panel + backdrop.
//
// Usage:
//   constructor(private uiDialog: UiDialogComponent) {}
//   open() { this.uiDialog.open(this.myTemplateRef); }
//
// Or — if you don't need a wrapper element — inject the CDK `Dialog` directly
// and pass `panelClass: 'ui-dialog-panel'`. This component exists primarily
// to give consumers a single named import alongside the other primitives.

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  TemplateRef,
} from '@angular/core';
import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';

/** Shared panel classes — kept in sync with the `host.class` on this component. */
const PANEL_CLASSES =
  'block bg-surface-1 border border-border rounded-md shadow-lg p-6 max-w-md text-text';

/** Backdrop class — translucent bg, tied to our token. */
const BACKDROP_CLASSES = 'bg-bg/80';

@Component({
  selector: 'ui-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  host: {
    class: PANEL_CLASSES,
  },
})
export class UiDialogComponent {
  private readonly dialog = inject(Dialog);

  /**
   * Open a templated dialog. Returns the DialogRef so the caller can listen
   * for `closed` (an Observable) or call `close(result?)` programmatically.
   */
  open<R = unknown, D = unknown>(
    template: TemplateRef<unknown>,
    config?: DialogConfig<D>,
  ): DialogRef<R> {
    return this.dialog.open<R, D>(template, {
      hasBackdrop: true,
      backdropClass: BACKDROP_CLASSES,
      panelClass: PANEL_CLASSES,
      ...config,
    });
  }
}
