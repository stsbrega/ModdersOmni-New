// frontend/src/app/shared/components/ui/separator.component.ts
//
// UiSeparatorComponent — semantic divider. role=separator + aria-orientation
// for screen readers. Hairline on the border token; no padding/margin so the
// caller controls spacing.

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type Orientation = 'horizontal' | 'vertical';

@Component({
  selector: 'ui-separator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: [`
    :host {
      display: block;
      background: var(--color-border);
      height: 1px;
      width: 100%;
    }

    :host([orientation="vertical"]) {
      width: 1px;
      height: 100%;
    }
  `],
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'orientation',
    '[attr.orientation]': 'orientation',
  },
})
export class UiSeparatorComponent {
  @Input() orientation: Orientation = 'horizontal';
}
