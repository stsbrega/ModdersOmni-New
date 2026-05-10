// frontend/src/app/shared/components/ui/badge.component.ts
//
// UiBadgeComponent — small inline status pill. Element selector since there
// is no native semantic equivalent. Variant maps to a single token color.

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger';

const BASE_CLASSES =
  'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 ' +
  'text-xs font-medium leading-none border';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-text border-border',
  info: 'bg-secondary/15 text-secondary border-secondary/30',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
};

@Component({
  selector: 'ui-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  host: {
    '[class]': 'baseClasses + " " + variantClasses()',
  },
})
export class UiBadgeComponent {
  @Input() variant: BadgeVariant = 'default';

  readonly baseClasses = BASE_CLASSES;

  variantClasses(): string {
    return VARIANT_CLASSES[this.variant];
  }
}
