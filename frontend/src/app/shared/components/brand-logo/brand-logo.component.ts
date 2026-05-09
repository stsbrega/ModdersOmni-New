import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl';

const BRAND_LOGO_SIZES: Record<BrandLogoSize, { icon: number; gap: string; text: string }> = {
  sm: { icon: 32, gap: '0.625rem', text: '1.125rem' },
  md: { icon: 40, gap: '0.75rem', text: '1.25rem' },
  lg: { icon: 48, gap: '0.875rem', text: '1.5rem' },
  xl: { icon: 56, gap: '1rem', text: '1.75rem' },
};

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--brand-logo-icon-size]': 'iconSize()',
    '[style.--brand-logo-gap]': 'gapSize()',
    '[style.--brand-logo-text-size]': 'textSize()',
  },
  template: `
    <span class="brand-logo" [class.brand-logo--icon-only]="!showText()">
      <span class="brand-logo__mark" aria-hidden="true">
        <img
          src="/logo-mark.png"
          alt=""
          [attr.width]="iconPixels()"
          [attr.height]="iconPixels()"
        >
      </span>
      @if (showText()) {
        <span class="brand-logo__text">ModdersOmni</span>
      }
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      color: inherit;
      line-height: 1;
    }

    .brand-logo {
      display: inline-flex;
      align-items: center;
      gap: var(--brand-logo-gap);
      min-width: 0;
    }

    .brand-logo--icon-only {
      gap: 0;
    }

    .brand-logo__mark {
      width: var(--brand-logo-icon-size);
      height: var(--brand-logo-icon-size);
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 10px 24px rgba(196, 165, 90, 0.12));
    }

    .brand-logo__mark img {
      display: block;
      width: 100%;
      height: 100%;
    }

    .brand-logo__text {
      white-space: nowrap;
      font-size: var(--brand-logo-text-size);
      font-weight: 600;
      letter-spacing: -0.04em;
      line-height: 1;
    }
  `],
})
export class BrandLogoComponent {
  readonly showText = input(true);
  readonly size = input<BrandLogoSize>('sm');

  protected readonly iconPixels = computed(() => BRAND_LOGO_SIZES[this.size()].icon);
  protected readonly iconSize = computed(() => `${this.iconPixels()}px`);
  protected readonly gapSize = computed(() => BRAND_LOGO_SIZES[this.size()].gap);
  protected readonly textSize = computed(() => BRAND_LOGO_SIZES[this.size()].text);
}
