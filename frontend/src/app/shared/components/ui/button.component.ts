// frontend/src/app/shared/components/ui/button.component.ts
//
// UiButtonComponent — attribute-selector wrapper around the native <button>.
//
// Why an attribute selector? So consumers write `<button ui-button>` instead
// of `<ui-button>`. That keeps the real <button> element in the DOM, which
// means form submission, keyboard activation, focus management, and screen-
// reader semantics all "just work" without us having to re-implement them.
//
// Visual layer: raw CSS custom properties from styles/theme.css (:root block).
// The Angular 19 esbuild pipeline does NOT run Tailwind's PostCSS plugin, so
// Tailwind utility classes that depend on @theme tokens (bg-accent, etc.) do
// not resolve in the browser. Variant/size styles are declared in the styles
// array and targeted via marker classes applied through the host [class] binding.

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

/**
 * Per-variant marker classes. These are targeted by the component's styles
 * array below — they are not Tailwind utilities.
 */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:     'btn-primary',
  secondary:   'btn-secondary',
  ghost:       'btn-ghost',
  destructive: 'btn-destructive',
};

/** Per-size marker classes targeted by the styles array. */
const SIZE_CLASSES: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

/**
 * Base classes: layout, focus ring, and disabled state.
 * Tailwind layout utilities (inline-flex, items-center, etc.) do not require
 * @theme resolution — they are static and always generated.
 */
const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 font-medium ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50';

@Component({
  // Attribute selector covers both <button ui-button> and <a ui-button>.
  // For anchors, [attr.type] is inert (it's a MIME hint on <a>, harmless),
  // and [attr.disabled] is non-standard on <a> but coexists with routerLink
  // without breaking nav. This lets us style routerLink CTAs with the same
  // primitive without losing anchor semantics (right-click-new-tab, etc).
  selector: 'button[ui-button], a[ui-button]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content/>',
  host: {
    '[class]':
      'baseClasses + " " + variantClasses() + " " + sizeClasses()',
    '[attr.type]': 'type',
    '[attr.disabled]': 'disabled || null',
  },
  styles: [`
    /* ── Shared transition ── */
    :host {
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    /* ── Variant: primary ── */
    :host(.btn-primary) {
      background: var(--color-accent);
      color: var(--color-bg);
      border: 1px solid var(--color-accent);
      border-radius: var(--radius-md);
    }
    :host(.btn-primary:hover) {
      background: color-mix(in oklch, var(--color-accent) 92%, white);
    }

    /* ── Variant: secondary ── */
    :host(.btn-secondary) {
      background: transparent;
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    :host(.btn-secondary:hover) {
      border-color: var(--color-accent-soft);
    }

    /* ── Variant: ghost ── */
    :host(.btn-ghost) {
      background: transparent;
      color: var(--color-text-muted);
      border: 1px solid transparent;
      border-radius: var(--radius-md);
    }
    :host(.btn-ghost:hover) {
      color: var(--color-text);
      background: var(--color-surface-1);
    }

    /* ── Variant: destructive ── */
    :host(.btn-destructive) {
      background: var(--color-danger);
      color: var(--color-bg);
      border: 1px solid var(--color-danger);
      border-radius: var(--radius-md);
    }
    :host(.btn-destructive:hover) {
      background: color-mix(in oklch, var(--color-danger) 92%, white);
    }

    /* ── Size: sm  (h-8 / 2rem, px-3 / 0.75rem, 11px) ── */
    :host(.btn-sm) {
      height: 2rem;
      padding-inline: 0.75rem;
      font-size: 0.6875rem;
    }

    /* ── Size: md  (h-10 / 2.5rem, px-4 / 1rem, 13px) ── */
    :host(.btn-md) {
      height: 2.5rem;
      padding-inline: 1rem;
      font-size: 0.8125rem;
    }

    /* ── Size: lg  (h-12 / 3rem, px-6 / 1.5rem, 15px) ── */
    :host(.btn-lg) {
      height: 3rem;
      padding-inline: 1.5rem;
      font-size: 0.9375rem;
    }
  `],
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
