import { eventToLogEntry } from './event-to-log-entry';
import type { GenerationEvent } from '../../../shared/models/generation.model';
import type { TerminalLogEntry } from '../../../shared/components/ui';

describe('eventToLogEntry', () => {
  it('maps phase_start to an info entry with the phase name and number', () => {
    const event = {
      type: 'phase_start',
      phase: 'Essentials',
      number: 1,
      total_phases: 13,
    } as unknown as GenerationEvent;
    const entry = eventToLogEntry(event);
    expect(entry.level).toBe('info');
    expect(entry.text).toContain('Essentials');
    expect(entry.text).toContain('1/13');
  });

  it('maps mod_added to an ok entry containing the mod name', () => {
    const event = {
      type: 'mod_added',
      mod: { name: 'Skyrim Unbound', mod_id: 27744 },
    } as unknown as GenerationEvent;
    const entry = eventToLogEntry(event);
    expect(entry.level).toBe('ok');
    expect(entry.text).toContain('Skyrim Unbound');
  });

  it('maps patch_added to an ok entry', () => {
    const event = { type: 'patch_added', patch: { name: 'USSEP Patch' } } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('ok');
  });

  it('maps knowledge_flag to a warn entry', () => {
    const event = { type: 'knowledge_flag', message: 'deprecated mod' } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('warn');
  });

  it('maps provider_error to an err entry', () => {
    const event = { type: 'provider_error', provider: 'anthropic', message: '429 rate limit' } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('err');
  });

  it('maps error (top-level) to an err entry', () => {
    const event = { type: 'error', message: 'pipeline aborted' } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('err');
  });

  it('maps complete to an ok entry', () => {
    const event = { type: 'complete' } as unknown as GenerationEvent;
    expect(eventToLogEntry(event).level).toBe('ok');
  });

  it('maps paused/resumed to warn/info entries respectively', () => {
    expect(eventToLogEntry({ type: 'paused' } as any).level).toBe('warn');
    expect(eventToLogEntry({ type: 'resumed' } as any).level).toBe('info');
  });

  it('falls back to info with the event type as text for unknown events', () => {
    const event = { type: 'unrecognized_event_type_for_test' } as unknown as GenerationEvent;
    const entry = eventToLogEntry(event);
    expect(entry.level).toBe('info');
    expect(entry.text.toLowerCase()).toContain('unrecognized_event_type_for_test');
  });
});
