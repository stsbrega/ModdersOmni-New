// frontend/src/app/shared/components/ui/label.component.ts
//
// UiLabelComponent — attribute selector on native <label>.
// Native `for` attribute associates with the input via id; we don't intercept
// that — consumers write `<label ui-label for="myInput">` and the browser
// handles click-to-focus + screen-reader association.

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'label[ui-label]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  styles: [`
    :host {
      display: inline-block;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--color-text-muted);
      letter-spacing: -0.005em;
    }
  `],
})
export class UiLabelComponent {}
