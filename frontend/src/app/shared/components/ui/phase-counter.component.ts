import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'ui-phase-counter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="phase-counter">
      <span class="phase-counter__label">PHASE {{ pad(current()) }}/{{ pad(total()) }}</span>
      <div class="phase-counter__track">
        <div class="phase-counter__fill" [style.width]="fillWidth()"></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .phase-counter__label {
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: var(--color-accent);
    }
    .phase-counter__track {
      height: 4px;
      background: var(--color-surface-2);
      border-radius: 2px;
      margin-top: 0.5rem;
      overflow: hidden;
    }
    .phase-counter__fill {
      height: 100%;
      background: var(--color-accent);
      border-radius: 2px;
      transition: width 0.3s var(--ease-out);
    }
  `],
})
export class UiPhaseCounterComponent {
  current = input.required<number>();
  total   = input.required<number>();

  fillWidth = computed(() => {
    const t = this.total();
    if (t <= 0) return '0%';
    return `${Math.min(100, Math.max(0, (this.current() / t) * 100))}%`;
  });

  pad(n: number): string {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
  }
}
