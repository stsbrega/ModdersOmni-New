import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TerminalLogLevel = 'info' | 'ok' | 'warn' | 'err';

export interface TerminalLogEntry {
  level: TerminalLogLevel;
  text: string;
}

const PREFIX_FOR: Record<TerminalLogLevel, string> = {
  info: '>',
  ok:   '[ok]',
  warn: '[warn]',
  err:  '[err]',
};

@Component({
  selector: 'ui-terminal-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terminal-log">
      @for (entry of entries(); track $index) {
        <div class="terminal-log__line" [class]="'terminal-log__line--' + entry.level">
          <span class="terminal-log__prefix">{{ prefixFor(entry.level) }}</span>
          <span class="terminal-log__text">{{ entry.text }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .terminal-log {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      line-height: 1.6;
      color: var(--color-text-muted);
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.875rem 1rem;
      overflow-y: auto;
    }
    .terminal-log__line {
      display: flex;
      gap: 0.625rem;
      align-items: baseline;
    }
    .terminal-log__prefix {
      flex: 0 0 auto;
      font-weight: 500;
      color: var(--color-text-dim);
      user-select: none;
    }
    .terminal-log__line--ok   .terminal-log__prefix { color: var(--color-success); }
    .terminal-log__line--warn .terminal-log__prefix { color: var(--color-warning); }
    .terminal-log__line--err  .terminal-log__prefix { color: var(--color-danger); }
    .terminal-log__line--info .terminal-log__prefix { color: var(--color-accent); }

    .terminal-log__line--ok   .terminal-log__text { color: var(--color-text); }
    .terminal-log__line--warn .terminal-log__text { color: var(--color-warning); }
    .terminal-log__line--err  .terminal-log__text { color: var(--color-danger); }
  `],
})
export class UiTerminalLogComponent {
  entries = input.required<TerminalLogEntry[]>();
  prefixFor(level: TerminalLogLevel): string { return PREFIX_FOR[level]; }
}
