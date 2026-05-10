// frontend/src/app/shared/components/ui/card.component.ts
//
// UiCardComponent — generic surface container with content projection.
//
// Element selector (<ui-card>) because there's no native equivalent that
// gives us "elevated surface with border + radius + shadow." Sharp tactile
// edges per spec Decision 9.e — radius-md, hairline border, low-blur shadow.

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  host: {
    class:
      'block bg-surface-1 border border-border rounded-md shadow-sm p-6 text-text',
  },
})
export class UiCardComponent {}
