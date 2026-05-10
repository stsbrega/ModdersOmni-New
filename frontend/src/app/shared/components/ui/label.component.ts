// frontend/src/app/shared/components/ui/label.component.ts
//
// UiLabelComponent — attribute selector on native <label>.
// Native `for` attribute associates with the input via id; we don't intercept
// that — consumers write `<label ui-label for="myInput">` and the browser
// handles click-to-focus + screen-reader association.

import { ChangeDetectionStrategy, Component } from '@angular/core';

const LABEL_CLASSES =
  'inline-block text-sm font-medium text-text mb-1 ' +
  'select-none cursor-pointer';

@Component({
  selector: 'label[ui-label]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  host: {
    class: LABEL_CLASSES,
  },
})
export class UiLabelComponent {}
