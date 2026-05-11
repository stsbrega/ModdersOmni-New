import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiCardComponent } from '../../../shared/components/ui';

// Loose mod shape — accepts whatever GenerationService.modsAdded() emits.
// Matches the public fields used by the v2 timeline so the parent doesn't
// need to map. Tight typing is owned by mod.model.ts.
export interface ModlistItem {
  mod_id: number;
  name: string;
  file_size?: number;
  patches?: number;
}

@Component({
  selector: 'app-generation-modlist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiCardComponent],
  template: `
    @if (mods().length === 0) {
      <div class="gen-modlist__empty">
        <span class="gen-modlist__empty-text">no mods added yet</span>
      </div>
    } @else {
      <ul class="gen-modlist__list">
        @for (mod of mods(); track mod.mod_id) {
          <li class="gen-modlist__card">
            <span class="gen-modlist__name">{{ mod.name }}</span>
            <span class="gen-modlist__meta">
              {{ formatSize(mod.file_size) }}
              @if (mod.patches) {
                <span class="gen-modlist__patches">+ {{ mod.patches }} patches</span>
              }
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .gen-modlist__empty {
      display: flex; align-items: center; justify-content: center;
      height: 100%; min-height: 200px;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-1);
    }
    .gen-modlist__empty-text {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      color: var(--color-text-dim);
    }
    .gen-modlist__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .gen-modlist__card {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.625rem 0.875rem;
      background: var(--color-surface-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    .gen-modlist__name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text);
    }
    .gen-modlist__meta {
      display: inline-flex;
      gap: 0.5rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }
    .gen-modlist__patches {
      color: var(--color-accent);
    }
  `],
})
export class GenerationModlistComponent {
  mods = input.required<ModlistItem[]>();

  formatSize(bytes: number | undefined): string {
    if (!bytes || bytes <= 0) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
    if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  }
}
