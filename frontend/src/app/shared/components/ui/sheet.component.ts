// frontend/src/app/shared/components/ui/sheet.component.ts
//
// UiSheetComponent — slide-over panel anchored to an edge of the viewport.
//
// Built on the lower-level CDK Overlay (vs the higher-level Dialog) because
// we need an edge-anchored position strategy. CDK Overlay gives us:
//   - portal-rendered DOM (escapes ancestor stacking contexts)
//   - global position strategy (top/right/bottom/left anchored)
//   - backdrop with click-to-close
//   - scroll lock
//
// Usage:
//   constructor(private sheet: UiSheetComponent) {}
//   open(tpl: TemplateRef<unknown>) { this.sheet.open(tpl, 'right'); }

import {
  ChangeDetectionStrategy,
  Component,
  inject,
  TemplateRef,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {
  Overlay,
  OverlayConfig,
  OverlayRef,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

export type SheetSide = 'right' | 'left' | 'bottom';

@Component({
  selector: 'ui-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ViewEncapsulation.None is required because the panel and backdrop are
  // rendered by CDK into a .cdk-overlay-container element that lives outside
  // this component's host. All class names are namespaced with `ui-sheet__`
  // to avoid collisions.
  encapsulation: ViewEncapsulation.None,
  // No template — this component is invoked imperatively via open().
  template: '',
  styles: [`
    /* ── Shared panel base ── */
    .ui-sheet__panel {
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      overflow-y: auto;
      color: var(--color-text);
    }

    /* ── Right side anchor ── */
    .ui-sheet__panel--right {
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: 24rem;
      max-width: 100%;
      border-left: 1px solid var(--color-border);
      border-right: none;
      border-top: none;
      border-bottom: none;
      padding: 1.5rem;
      box-shadow: var(--shadow-md);
    }

    /* ── Left side anchor ── */
    .ui-sheet__panel--left {
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      width: 24rem;
      max-width: 100%;
      border-right: 1px solid var(--color-border);
      border-left: none;
      border-top: none;
      border-bottom: none;
      padding: 1.5rem;
      box-shadow: var(--shadow-md);
    }

    /* ── Bottom anchor ── */
    .ui-sheet__panel--bottom {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 80vh;
      border-top: 1px solid var(--color-border);
      border-left: none;
      border-right: none;
      border-bottom: none;
      padding: 1.5rem;
      box-shadow: var(--shadow-md);
    }

    /* ── Backdrop ── */
    .ui-sheet__backdrop {
      position: fixed;
      inset: 0;
      background: oklch(0 0 0 / 0.4);
    }
  `],
})
export class UiSheetComponent {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);

  /**
   * Open the sheet with the given template anchored to `side`. Returns the
   * OverlayRef; call `.dispose()` to close, or subscribe to `.backdropClick()`
   * to close on outside click.
   */
  open(template: TemplateRef<unknown>, side: SheetSide = 'right'): OverlayRef {
    const positionStrategy = this.buildPositionStrategy(side);

    const config = new OverlayConfig({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'ui-sheet__backdrop',
      // Base class + side modifier: CDK accepts a string array and applies each
      // as a separate class on the overlay pane element.
      panelClass: ['ui-sheet__panel', `ui-sheet__panel--${side}`],
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });

    const overlayRef = this.overlay.create(config);
    const portal = new TemplatePortal(template, this.viewContainerRef);
    overlayRef.attach(portal);

    // Close on backdrop click — matches dialog behavior consumers expect.
    overlayRef.backdropClick().subscribe(() => overlayRef.dispose());

    return overlayRef;
  }

  /** Position strategy uses CDK's GlobalPositionStrategy under the hood. */
  private buildPositionStrategy(side: SheetSide) {
    const builder = this.overlay.position().global();
    switch (side) {
      case 'right':
        return builder.right('0').top('0');
      case 'left':
        return builder.left('0').top('0');
      case 'bottom':
        return builder.bottom('0').left('0').right('0');
    }
  }
}
