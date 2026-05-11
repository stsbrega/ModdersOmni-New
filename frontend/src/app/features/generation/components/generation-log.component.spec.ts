import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GenerationLogComponent } from './generation-log.component';
import type { GenerationEvent } from '../../../shared/models/generation.model';

describe('GenerationLogComponent', () => {
  let fixture: ComponentFixture<GenerationLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GenerationLogComponent] }).compileComponents();
    fixture = TestBed.createComponent(GenerationLogComponent);
  });

  it('renders one terminal-log line per event', () => {
    const events: GenerationEvent[] = [
      { type: 'phase_start', phase: 'Essentials', number: 1, total_phases: 13 } as any,
      { type: 'searching', query: 'unofficial patch' } as any,
      { type: 'mod_added', mod: { name: 'USSEP' } } as any,
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('.terminal-log__line');
    expect(lines.length).toBe(3);
  });

  it('renders the latest event at the bottom', () => {
    const events: GenerationEvent[] = [
      { type: 'phase_start', phase: 'Essentials', number: 1, total_phases: 13 } as any,
      { type: 'mod_added', mod: { name: 'USSEP' } } as any,
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('.terminal-log__line');
    expect(lines[lines.length - 1].textContent).toContain('USSEP');
  });

  it('renders the empty state when events is empty', () => {
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('.terminal-log__line');
    expect(lines.length).toBe(0);
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('waiting');
  });
});
