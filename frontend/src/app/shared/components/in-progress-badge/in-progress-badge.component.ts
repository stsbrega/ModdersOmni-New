import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-in-progress-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="badge"
      [class.running]="status === 'running'"
      [class.paused]="status === 'paused'"
      [class.failed]="status === 'failed'"
    >
      <span class="dot"></span>
      @switch (status) {
        @case ('running') { In progress — phase {{ phaseIndex }} of {{ totalPhases }} ({{ elapsed }}) }
        @case ('paused')  { Paused }
        @case ('failed')  { Failed }
        @default { Complete }
      }
    </span>
  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      padding: 0.15rem 0.6rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.04);
    }
    .dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: currentColor;
    }
    .badge.running { color: #4c9aff; }
    .badge.running .dot { animation: pulse 1.2s ease-in-out infinite; }
    .badge.paused  { color: #c80; }
    .badge.failed  { color: #e55; }
    @keyframes pulse {
      0%, 100% { opacity: 1 }
      50% { opacity: 0.3 }
    }
  `],
})
export class InProgressBadgeComponent {
  @Input() status: 'running' | 'paused' | 'failed' | 'complete' = 'complete';
  @Input() phaseIndex = 0;
  @Input() totalPhases = 0;
  @Input() elapsed = '';  // e.g. "3m 12s"
}
