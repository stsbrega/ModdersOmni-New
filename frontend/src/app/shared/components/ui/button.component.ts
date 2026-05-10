// frontend/src/app/shared/components/ui/button.component.ts
//
// UiButtonComponent — attribute-selector wrapper around the native <button>.
//
// Why an attribute selector? So consumers write `<button ui-button>` instead
// of `<ui-button>`. That keeps the real <button> element in the DOM, which
// means form submission, keyboard activation, focus management, and screen-
// reader semantics all "just work" without us having to re-implement them.
//
// Visual layer: pure Tailwind utility classes that resolve to our OKLCH
// design tokens (bg-accent, text-bg, border-border, etc.) declared in
// styles/tokens.scss via Tailwind 4's @theme block.

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

/** Per-variant Tailwind class strings. Resolves to OKLCH tokens at build time. */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-accent text-bg hover:bg-accent/90 focus-visible:ring-accent',
  secondary:
    'bg-surface-2 text-text border border-border hover:bg-surface-1 focus-visible:ring-secondary',
  ghost:
    'bg-transparent text-text hover:bg-surface-2 focus-visible:ring-secondary',
  destructive:
    'bg-danger text-text hover:bg-danger/90 focus-visible:ring-danger',
};

/** Per-size class strings. Heights kept on the standard 4px grid. */
const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-sm',
  md: 'h-10 px-4 text-base rounded-md',
  lg: 'h-12 px-6 text-lg rounded-md',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50';

@Component({
  selector: 'button[ui-button]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  host: {
    '[class]':
      'baseClasses + " " + variantClasses() + " " + sizeClasses()',
    '[attr.type]': 'type',
    '[attr.disabled]': 'disabled || null',
  },
})
export class UiButtonComponent {
  @Input() variant: Variant = 'primary';
  @Input() size: Size = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;

  /** Exposed to the host binding so we don't re-concat strings on every CD pass. */
  readonly baseClasses = BASE_CLASSES;

  variantClasses(): string {
    return VARIANT_CLASSES[this.variant];
  }

  sizeClasses(): string {
    return SIZE_CLASSES[this.size];
  }
}
