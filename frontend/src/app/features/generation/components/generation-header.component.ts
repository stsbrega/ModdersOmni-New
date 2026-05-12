import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiPhaseCounterComponent, UiBadgeComponent } from '../../../shared/components/ui';
import { BrandMarkComponent } from '../../../shared/components/brand-mark/brand-mark.component';

const GAME_LABELS: Record<string, string> = {
  skyrim: 'Skyrim Special Edition',
  fallout4: 'Fallout 4',
};

@Component({
  selector: 'app-generation-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiPhaseCounterComponent, UiBadgeComponent, BrandMarkComponent],
  template: `
    <header class="generation-header">
      <div class="generation-header__brand">
        <app-brand-mark size="sm" [showText]="true"></app-brand-mark>
      </div>
      <div class="generation-header__middle">
        <span class="generation-header__game">{{ gameLabel() }}</span>
        <ui-badge variant="default">{{ provider() }}</ui-badge>
      </div>
      <div class="generation-header__counter">
        <ui-phase-counter [current]="currentPhase()" [total]="totalPhases()"></ui-phase-counter>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .generation-header {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 1.5rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-bg);
    }
    .generation-header__middle {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .generation-header__game {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--color-text);
    }
    .generation-header__counter {
      min-width: 220px;
    }
    @media (max-width: 768px) {
      .generation-header {
        grid-template-columns: 1fr;
        gap: 0.75rem;
      }
      .generation-header__counter { min-width: 0; }
    }
  `],
})
export class GenerationHeaderComponent {
  game = input.required<string>();
  provider = input.required<string>();
  currentPhase = input.required<number>();
  totalPhases = input.required<number>();

  gameLabel = () => GAME_LABELS[this.game()] ?? this.game();
}
