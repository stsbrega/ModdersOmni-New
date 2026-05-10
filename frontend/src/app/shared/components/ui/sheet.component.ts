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
} from '@angular/core';
import {
  Overlay,
  OverlayConfig,
  OverlayRef,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

export type SheetSide = 'right' | 'left' | 'bottom';

/** Panel classes for each side. Width/height pinned to the anchored edge. */
const SIDE_CLASSES: Record<SheetSide, string[]> = {
  right: [
    'fixed',
    'top-0',
    'right-0',
    'h-screen',
    'w-96',
    'max-w-full',
    'bg-surface-1',
    'border-l',
    'border-border',
    'shadow-lg',
    'p-6',
    'text-text',
    'overflow-y-auto',
  ],
  left: [
    'fixed',
    'top-0',
    'left-0',
    'h-screen',
    'w-96',
    'max-w-full',
    'bg-surface-1',
    'border-r',
    'border-border',
    'shadow-lg',
    'p-6',
    'text-text',
    'overflow-y-auto',
  ],
  bottom: [
    'fixed',
    'bottom-0',
    'left-0',
    'right-0',
    'max-h-[80vh]',
    'bg-surface-1',
    'border-t',
    'border-border',
    'shadow-lg',
    'p-6',
    'text-text',
    'overflow-y-auto',
  ],
};

@Component({
  selector: 'ui-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // No template — this component is invoked imperatively via open().
  template: '',
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
      backdropClass: 'bg-bg/80',
      panelClass: SIDE_CLASSES[side],
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
