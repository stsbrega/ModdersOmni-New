import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiTerminalLogComponent, type TerminalLogEntry } from './terminal-log.component';

describe('UiTerminalLogComponent', () => {
  let fixture: ComponentFixture<UiTerminalLogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiTerminalLogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UiTerminalLogComponent);
  });

  it('renders one .terminal-log__line per entry', () => {
    const entries: TerminalLogEntry[] = [
      { level: 'info', text: 'started' },
      { level: 'ok',   text: 'resolved 47 mods' },
      { level: 'warn', text: 'one conflict deferred' },
    ];
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();

    const lines = fixture.nativeElement.querySelectorAll('.terminal-log__line');
    expect(lines.length).toBe(3);
  });

  it('uses the level as the prefix and applies a level class', () => {
    fixture.componentRef.setInput('entries', [{ level: 'err', text: 'pipeline aborted' }] satisfies TerminalLogEntry[]);
    fixture.detectChanges();
    const line = fixture.nativeElement.querySelector('.terminal-log__line');
    expect(line.classList.contains('terminal-log__line--err')).toBe(true);
    const prefix = line.querySelector('.terminal-log__prefix');
    expect(prefix.textContent.trim()).toBe('[err]');
  });

  it('renders the > prefix for level=info', () => {
    fixture.componentRef.setInput('entries', [{ level: 'info', text: 'starting' }] satisfies TerminalLogEntry[]);
    fixture.detectChanges();
    const prefix = fixture.nativeElement.querySelector('.terminal-log__prefix');
    expect(prefix.textContent.trim()).toBe('>');
  });
});
