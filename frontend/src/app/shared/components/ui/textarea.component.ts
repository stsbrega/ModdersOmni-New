// frontend/src/app/shared/components/ui/textarea.component.ts
//
// UiTextareaComponent — attribute selector on native <textarea>.
// Visual layer only; native semantics (resize handle, multi-line entry,
// form binding via ngModel/FormControl) all preserved.
//
// Styling uses raw CSS custom properties (var(--color-*)) instead of Tailwind
// utility classes. The Angular 19 esbuild pipeline does NOT run Tailwind's
// PostCSS plugin, so utility classes that depend on @theme tokens do not
// resolve in the browser.
//
// Because this component uses an attribute selector on the native <textarea>,
// :host IS the textarea element — there is no inner element to style.

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'textarea[ui-textarea]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    '[class.ui-textarea--mono]': 'mono()',
  },
  styles: [`
    /* ── Base layout & surface ── */
    :host {
      display: block;
      width: 100%;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.5rem 0.75rem;
      font-size: 0.9375rem;
      font-family: inherit;
      color: var(--color-text);
      outline: none;
      resize: vertical;
      min-height: 6rem;
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
    :host(.ui-textarea--mono) {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      letter-spacing: 0;
    }
  `],
})
export class UiTextareaComponent {
  /** When true, switches the field to the mono font (JetBrains Mono). */
  mono = input<boolean>(false);
}
