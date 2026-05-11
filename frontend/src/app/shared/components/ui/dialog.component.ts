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
// and pass `panelClass: 'ui-dialog__panel'`. This component exists primarily
// to give consumers a single named import alongside the other primitives.

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  TemplateRef,
  ViewEncapsulation,
} from '@angular/core';
import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';

@Component({
  selector: 'ui-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ViewEncapsulation.None is required because the panel and backdrop are
  // rendered by CDK into a .cdk-overlay-container element that lives outside
  // this component's host. Emulated encapsulation would scope the _ngcontent
  // attribute only to the host's descendants, leaving the overlay unstyled.
  // All class names are namespaced with `ui-dialog__` to avoid collisions.
  encapsulation: ViewEncapsulation.None,
  template: '<ng-content/>',
  styles: [`
    /* ── Overlay backdrop ── */
    .ui-dialog__backdrop {
      position: fixed;
      inset: 0;
      background: oklch(0 0 0 / 0.6);
      backdrop-filter: blur(2px);
    }

    /* ── Dialog panel ── */
    .ui-dialog__panel {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      padding: 1.5rem;
      max-width: 28rem;
      width: 100%;
      color: var(--color-text);
    }
  `],
})
export class UiDialogComponent {
  private readonly dialog = inject(Dialog);

  /**
   * Open a templated (or component) dialog. Returns the DialogRef so callers
   * can listen for `closed` (an Observable) or call `close(result?)`.
   *
   * Generics are matched to CDK's actual signature: <R, D, C> where R is the
   * close-result type, D is the data payload, and C is the template/component
   * context. We let TS infer C from the `template` argument.
   */
  open<R = unknown, D = unknown, C = unknown>(
    template: TemplateRef<C> | ComponentType<C>,
    config?: DialogConfig<D, DialogRef<R, C>>,
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(template, {
      hasBackdrop: true,
      backdropClass: 'ui-dialog__backdrop',
      panelClass: 'ui-dialog__panel',
      ...config,
    });
  }
}
