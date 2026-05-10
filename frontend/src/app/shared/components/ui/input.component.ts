// frontend/src/app/shared/components/ui/input.component.ts
//
// UiInputComponent — attribute-selector wrapper around native <input>.
//
// Same trick as UiButtonComponent: keep the real <input> element so that
// Angular forms (FormControl, ngModel), validation, autofill, and ARIA
// labelling all flow through unchanged. We only own the visual layer.

import { ChangeDetectionStrategy, Component } from '@angular/core';

const INPUT_CLASSES =
  'block w-full bg-surface-1 border border-border rounded-md ' +
  'px-3 py-2 text-base text-text placeholder:text-text-muted ' +
  'transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:border-accent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'h-10';

@Component({
  selector: 'input[ui-input]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    class: INPUT_CLASSES,
  },
})
export class UiInputComponent {}
