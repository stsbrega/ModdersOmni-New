import {
  PauseGeneration,
  NexusRateLimitError,
  NexusServerError,
  NexusExhaustedError,
} from './errors';
import { createEmptySnapshot } from './session';

describe('generation errors', () => {
  it('PauseGeneration carries reason, phase info and snapshot', () => {
    const snap = createEmptySnapshot('skyrimspecialedition');
    const err = new PauseGeneration('providers failed', 3, 'Visuals', snap);
    expect(err).toBeInstanceOf(PauseGeneration);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PauseGeneration');
    expect(err.message).toBe('providers failed');
    expect(err.reason).toBe('providers failed');
    expect(err.phaseNumber).toBe(3);
    expect(err.phaseName).toBe('Visuals');
    expect(err.sessionSnapshot).toBe(snap);
  });

  it('PauseGeneration defaults to an empty snapshot', () => {
    const err = new PauseGeneration('x', 1, 'Essentials');
    expect(err.sessionSnapshot).toEqual({});
  });

  it('Nexus errors keep identity, name and default messages', () => {
    const cases: [Error, string, string][] = [
      [new NexusRateLimitError(), 'NexusRateLimitError', 'Nexus rate limit exceeded'],
      [new NexusServerError(), 'NexusServerError', 'Nexus server error'],
      [new NexusExhaustedError(), 'NexusExhaustedError', 'All Nexus retry attempts failed'],
    ];
    for (const [err, name, msg] of cases) {
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(name);
      expect(err.message).toBe(msg);
    }
    expect(new NexusServerError('boom').message).toBe('boom');
    expect(new NexusRateLimitError()).toBeInstanceOf(NexusRateLimitError);
  });
});
