import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SizeSummary } from '../../shared/models/mod.model';

@Component({
  selector: 'app-size-summary-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="size-card" [attr.data-fit]="summary.fit_status">
      <header>Disk space</header>
      <div class="totals">
        <div>
          <span class="label">Download</span>
          <span class="val font-mono">{{ formatBytes(summary.download_bytes) }}</span>
        </div>
        <div>
          <span class="label">Installed (est.)</span>
          <span class="val font-mono">~{{ formatBytes(summary.installed_estimate_bytes) }}</span>
        </div>
      </div>
      @if (summary.fit_status === 'comfortable') {
        <p class="ok">
          Largest free drive: <strong class="font-mono">{{ formatBytes(summary.largest_drive_free_bytes!) }}</strong> ✓ Comfortable fit.
        </p>
      } @else if (summary.fit_status === 'tight') {
        <p class="warn">
          Largest free drive: <strong class="font-mono">{{ formatBytes(summary.largest_drive_free_bytes!) }}</strong> ⚠ Tight fit — install carefully.
        </p>
      } @else if (summary.fit_status === 'insufficient') {
        <p class="err">
          Largest free drive: <strong class="font-mono">{{ formatBytes(summary.largest_drive_free_bytes!) }}</strong> ⚠ Insufficient.
          You'll need to free <span class="font-mono">~{{ formatBytes(summary.installed_estimate_bytes - summary.largest_drive_free_bytes!) }}</span> (or install to a different drive) before the modlist will fit.
        </p>
      } @else {
        <p class="unknown">
          Add drive info in Settings to see if this fits.
        </p>
      }
      @if (summary.unsized_count > 0) {
        <p class="note">
          {{ summary.sized_count }} sized · {{ summary.unsized_count }} unsized — estimate may be conservative.
        </p>
      }
    </section>
  `,
  styles: [`
    .size-card { border: 1px solid var(--border, #2a2c33); border-radius: 0.6rem; padding: 1.25rem; }
    .size-card[data-fit="insufficient"] { border-color: #b33; }
    .size-card[data-fit="tight"] { border-color: #c80; }
    .totals { display: flex; gap: 2rem; margin: 0.5rem 0 1rem; }
    .label { display: block; font-size: 0.85rem; color: var(--text-muted); }
    .val { font-size: 1.4rem; font-weight: 600; }
    .ok { color: #7c9; }
    .warn { color: #c80; }
    .err { color: #e55; }
    .note { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem; }
  `],
})
export class SizeSummaryCardComponent {
  @Input({ required: true }) summary!: SizeSummary;

  formatBytes(bytes: number): string {
    const gb = bytes / 1024 ** 3;
    return `${gb.toFixed(1)} GB`;
  }
}
