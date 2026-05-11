// frontend/src/app/shared/components/ui/card.component.ts
//
// UiCardComponent — generic surface container with content projection.
//
// Styling is applied directly via a :host rule using CSS custom properties
// (var(--color-*)) so it works without Tailwind's preprocessor. The build
// pipeline does not run Tailwind, so utility-class strings in host.class
// produce no styles — this approach avoids that silent failure.

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
