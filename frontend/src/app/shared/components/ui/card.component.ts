// frontend/src/app/shared/components/ui/card.component.ts
//
// UiCardComponent — generic surface container with content projection.
//
// Styling is applied directly via a :host rule using CSS custom properties
// (var(--color-*)). Tailwind now runs in the build (see frontend/.postcssrc.json), but primitives
// keep their visual layer in their own styles array: it keeps them
// self-contained, and Tailwind utilities sit in a CSS @layer that unlayered
// component styles override anyway.

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  styles: [
    `
      :host {
        display: block;
        background: var(--color-surface-1);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        transition: border-color 0.2s var(--ease-out);
      }
      :host(:hover) {
        border-color: color-mix(
          in oklch,
          var(--color-accent-soft) 60%,
          var(--color-border)
        );
      }
    `,
  ],
})
export class UiCardComponent {}
