import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiTerminalLogComponent, type TerminalLogEntry } from '../../../shared/components/ui';
import type { GenerationEvent } from '../../../shared/models/generation.model';
import { eventToLogEntry } from '../util/event-to-log-entry';

@Component({
  selector: 'app-generation-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiTerminalLogComponent],
  template: `
    @if (entries().length === 0) {
      <div class="generation-log__empty">
        <span class="generation-log__empty-text">waiting for pipeline...</span>
      </div>
    } @else {
      <ui-terminal-log [entries]="entries()"></ui-terminal-log>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    :host ui-terminal-log {
      display: block;
      height: 100%;
      max-height: 100%;
      overflow-y: auto;
    }
    .generation-log__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 200px;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
    }
    .generation-log__empty-text {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      color: var(--color-text-dim);
    }
  `],
})
export class GenerationLogComponent {
  events = input.required<GenerationEvent[]>();

  entries = computed<TerminalLogEntry[]>(() =>
    this.events().map((e) => eventToLogEntry(e)),
  );
}
