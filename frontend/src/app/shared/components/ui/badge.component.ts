// frontend/src/app/shared/components/ui/badge.component.ts
//
// UiBadgeComponent — small inline status pill. Element selector since there
// is no native semantic equivalent. Variant maps to a single token color.

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'ui-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      border-radius: var(--radius-sm);
      padding: 0.125rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 600;
      font-family: var(--font-mono);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1;
    }

    :host(.badge-default) {
      background: var(--color-surface-2);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }

    :host(.badge-info) {
      background: color-mix(in oklch, var(--color-secondary) 10%, transparent);
      color: var(--color-secondary);
      border: 1px solid color-mix(in oklch, var(--color-secondary) 25%, transparent);
    }

    :host(.badge-success) {
      background: color-mix(in oklch, var(--color-success) 10%, transparent);
      color: var(--color-success);
      border: 1px solid color-mix(in oklch, var(--color-success) 25%, transparent);
    }

    :host(.badge-warning) {
      background: color-mix(in oklch, var(--color-warning) 10%, transparent);
      color: var(--color-warning);
      border: 1px solid color-mix(in oklch, var(--color-warning) 25%, transparent);
    }

    :host(.badge-danger) {
      background: color-mix(in oklch, var(--color-danger) 10%, transparent);
      color: var(--color-danger);
      border: 1px solid color-mix(in oklch, var(--color-danger) 25%, transparent);
    }
  `],
  host: {
    '[class]': '"badge-" + variant',
  },
})
export class UiBadgeComponent {
  @Input() variant: BadgeVariant = 'default';
}
