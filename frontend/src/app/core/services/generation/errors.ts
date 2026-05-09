/**
 * Custom errors for the generation pipeline.
 *
 * Faithful TS port of `backend/app/services/generation/exceptions.py`. The
 * plan's sketch invented a `GenerationFailed` class; Python has no such
 * thing — the four classes here are exhaustive. Add new ones to Python
 * first, then mirror them here.
 *
 * `PauseGeneration` carries the session snapshot so the API/UI layer can
 * serialize it for resume. Constructor signature matches Python:
 *   `PauseGeneration(reason, phase_number, phase_name, session_snapshot=None)`.
 */

import type { GenerationSessionSnapshot } from './types';

/**
 * Raised when the generation should pause (e.g. all providers failed for a
 * phase). Carries the session snapshot so callers can persist & later resume.
 *
 * Mirrors `PauseGeneration` in exceptions.py — same four-argument signature
 * (reason, phase_number, phase_name, session_snapshot).
 */
export class PauseGeneration extends Error {
  readonly reason: string;
  readonly phaseNumber: number;
  readonly phaseName: string;
  /** Empty object when the caller didn't provide a snapshot. */
  readonly sessionSnapshot: GenerationSessionSnapshot | Record<string, never>;

  constructor(
    reason: string,
    phaseNumber: number,
    phaseName: string,
    sessionSnapshot: GenerationSessionSnapshot | null = null,
  ) {
    super(reason);
    this.name = 'PauseGeneration';
    this.reason = reason;
    this.phaseNumber = phaseNumber;
    this.phaseName = phaseName;
    this.sessionSnapshot = sessionSnapshot ?? {};
    // Restore prototype chain (TS / ES5 target gotcha for built-in subclasses).
    Object.setPrototypeOf(this, PauseGeneration.prototype);
  }
}

/** Mirrors `NexusRateLimitError` in exceptions.py. */
export class NexusRateLimitError extends Error {
  constructor(message = 'Nexus rate limit exceeded') {
    super(message);
    this.name = 'NexusRateLimitError';
    Object.setPrototypeOf(this, NexusRateLimitError.prototype);
  }
}

/** Mirrors `NexusServerError` in exceptions.py. */
export class NexusServerError extends Error {
  constructor(message = 'Nexus server error') {
    super(message);
    this.name = 'NexusServerError';
    Object.setPrototypeOf(this, NexusServerError.prototype);
  }
}

/** Mirrors `NexusExhaustedError` in exceptions.py — all retries failed. */
export class NexusExhaustedError extends Error {
  constructor(message = 'All Nexus retry attempts failed') {
    super(message);
    this.name = 'NexusExhaustedError';
    Object.setPrototypeOf(this, NexusExhaustedError.prototype);
  }
}
