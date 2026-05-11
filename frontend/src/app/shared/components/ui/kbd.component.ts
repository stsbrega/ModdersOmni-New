import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'ui-kbd',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ui-kbd' },
  template: `<kbd><ng-content></ng-content></kbd>`,
  styles: [`
    :host { display: inline-block; }
    kbd {
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--color-text);
      background: var(--color-surface-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.0625rem 0.375rem;
      line-height: 1.4;
      white-space: nowrap;
    }
  `],
})
export class UiKbdComponent {}
