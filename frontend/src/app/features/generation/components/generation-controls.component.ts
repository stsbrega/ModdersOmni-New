import { ChangeDetectionStrategy, Component, EventEmitter, Output, input } from '@angular/core';
import { UiButtonComponent } from '../../../shared/components/ui';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider, Pause, Play, X, Download } from 'lucide-angular';

export type GenerationStatus = 'running' | 'paused' | 'complete' | 'error' | 'idle';

@Component({
  selector: 'app-generation-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({ Pause, Play, X, Download }),
    },
  ],
  template: `
    <div class="gen-controls">
      @if (status() === 'running') {
        <button ui-button variant="secondary" size="sm" data-action="pause" (click)="paused.emit()">
          <lucide-icon name="pause" [size]="14" [strokeWidth]="2"></lucide-icon>
          Pause
        </button>
      } @else if (status() === 'paused') {
        <button ui-button variant="primary" size="sm" data-action="resume" (click)="resumed.emit()">
          <lucide-icon name="play" [size]="14" [strokeWidth]="2"></lucide-icon>
          Resume
        </button>
      }
      <button ui-button variant="ghost" size="sm" data-action="cancel" (click)="cancelled.emit()">
        <lucide-icon name="x" [size]="14" [strokeWidth]="2"></lucide-icon>
        Cancel
      </button>
      <button ui-button variant="ghost" size="sm" data-action="download-log" (click)="downloadLog.emit()">
        <lucide-icon name="download" [size]="14" [strokeWidth]="2"></lucide-icon>
        Log
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .gen-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `],
})
export class GenerationControlsComponent {
  status = input.required<GenerationStatus>();

  @Output() paused = new EventEmitter<void>();
  @Output() resumed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() downloadLog = new EventEmitter<void>();
}
