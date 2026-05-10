// frontend/src/app/shared/components/ui/textarea.component.ts
//
// UiTextareaComponent — attribute selector on native <textarea>.
// Visual layer only; native semantics (resize handle, multi-line entry,
// form binding via ngModel/FormControl) all preserved.

import { ChangeDetectionStrategy, Component } from '@angular/core';

const TEXTAREA_CLASSES =
  'block w-full bg-surface-1 border border-border rounded-md ' +
  'px-3 py-2 text-base text-text placeholder:text-text-muted ' +
  'transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'focus-visible:border-accent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'min-h-[6rem] resize-y';

@Component({
  selector: 'textarea[ui-textarea]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    class: TEXTAREA_CLASSES,
  },
})
export class UiTextareaComponent {}
