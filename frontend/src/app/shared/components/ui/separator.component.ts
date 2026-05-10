// frontend/src/app/shared/components/ui/separator.component.ts
//
// UiSeparatorComponent — semantic divider. role=separator + aria-orientation
// for screen readers. Hairline on the border token; no padding/margin so the
// caller controls spacing.

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type Orientation = 'horizontal' | 'vertical';

const ORIENTATION_CLASSES: Record<Orientation, string> = {
  horizontal: 'block w-full h-px bg-border',
  vertical: 'inline-block h-full w-px bg-border',
};

@Component({
  selector: 'ui-separator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'orientation',
    '[class]': 'orientationClasses()',
  },
})
export class UiSeparatorComponent {
  @Input() orientation: Orientation = 'horizontal';

  orientationClasses(): string {
    return ORIENTATION_CLASSES[this.orientation];
  }
}
