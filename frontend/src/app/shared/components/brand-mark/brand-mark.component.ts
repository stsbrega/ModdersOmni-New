import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type BrandMarkSize = 'sm' | 'md' | 'lg' | 'xl';

const BRAND_MARK_SIZES: Record<BrandMarkSize, { icon: string; gap: string; text: string }> = {
  sm: { icon: '32px', gap: '0.625rem', text: '1.125rem' },
  md: { icon: '40px', gap: '0.75rem',  text: '1.25rem'  },
  lg: { icon: '48px', gap: '0.875rem', text: '1.5rem'   },
  xl: { icon: '56px', gap: '1rem',     text: '1.75rem'  },
};

@Component({
  selector: 'app-brand-mark',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--brand-mark-icon-size]': 'iconSize()',
    '[style.--brand-mark-gap]':       'gapSize()',
    '[style.--brand-mark-text-size]': 'textSize()',
  },
  template: `
    <span class="brand-mark" [class.brand-mark--icon-only]="!showText()">
      <span class="brand-mark__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5 20 L9 20 L9 16 C6 14 5 11 5 9 C5 5 8 3 12 3 C16 3 19 5 19 9 C19 11 18 14 15 16 L15 20 L19 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="square"
            stroke-linejoin="miter"
          />
        </svg>
      </span>
      @if (showText()) {
        <span class="brand-mark__text">Modders<span class="brand-mark__text-accent">Omni</span></span>
      }
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      color: var(--color-accent);
      line-height: 1;
    }
    .brand-mark {
      display: inline-flex;
      align-items: center;
      gap: var(--brand-mark-gap);
      min-width: 0;
    }
    .brand-mark--icon-only { gap: 0; }
    .brand-mark__glyph {
      width: var(--brand-mark-icon-size);
      height: var(--brand-mark-icon-size);
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .brand-mark__glyph svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .brand-mark__text {
      white-space: nowrap;
      font-size: var(--brand-mark-text-size);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1;
      color: var(--color-text);
    }
    .brand-mark__text-accent { color: var(--color-accent); }
  `],
})
export class BrandMarkComponent {
  size = input<BrandMarkSize>('sm');
  showText = input<boolean>(true);

  iconSize = computed(() => BRAND_MARK_SIZES[this.size()].icon);
  gapSize  = computed(() => BRAND_MARK_SIZES[this.size()].gap);
  textSize = computed(() => BRAND_MARK_SIZES[this.size()].text);
}
