// frontend/src/app/shared/components/ui/input.component.ts
//
// UiInputComponent — attribute-selector wrapper around native <input>.
//
// Same trick as UiButtonComponent: keep the real <input> element so that
// Angular forms (FormControl, ngModel), validation, autofill, and ARIA
// labelling all flow through unchanged. We only own the visual layer.
//
// Styling uses raw CSS custom properties (var(--color-*)) instead of Tailwind
// utility classes. Tailwind now runs in the build (see frontend/.postcssrc.json), but primitives
// keep their visual layer in their own styles array: it keeps them
// self-contained, and Tailwind utilities sit in a CSS @layer that unlayered
// component styles override anyway.
//
// Because this component uses an attribute selector on the native <input>,
// :host IS the input element — there is no inner element to style.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'input[ui-input]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    '[class.ui-input--mono]': 'mono()',
  },
  styles: [`
    /* ── Base layout & surface ── */
    :host {
      display: inline-flex;
      align-items: center;
      width: 100%;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.5rem 0.75rem;
      font-size: 0.9375rem;
      font-family: inherit;
      color: var(--color-text);
      outline: none;
      transition: border-color 0.15s;
    }

    /* ── Focus state ── */
    :host(:focus) {
      border-color: var(--color-accent);
    }

    /* ── Placeholder ── */
    :host::placeholder {
      color: var(--color-text-dim);
    }

    /* ── Disabled state ── */
    :host(:disabled) {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ── Mono variant: API keys, file paths, technical strings ── */
    :host(.ui-input--mono) {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      letter-spacing: 0;
    }
  `],
})
export class UiInputComponent {
  /** When true, switches the field to the mono font (JetBrains Mono). */
  mono = input<boolean>(false);
}
