/**
 * localStorage-backed session store.
 *
 * Replaces Python's in-memory `GenerationSession` dataclass + DB persistence
 * (Python session.py). The frontend has no DB, so we persist the snapshot
 * shape (`GenerationSessionSnapshot`) along with run metadata (`StoredSession`)
 * directly in `localStorage` under the `moddersomni.session.<id>` key.
 *
 * `createEmptySnapshot()` mirrors the default-factory state that Python's
 * `GenerationSession.__init__` produces on a fresh session — same field set
 * as `to_snapshot()` so the two halves stay in sync.
 *
 * Plan 1 Task 10. Source of truth:
 *   `backend/app/services/generation/session.py`.
 */

import type { GenerationSessionSnapshot, StoredSession } from './types';

const SESSION_KEY_PREFIX = 'moddersomni.session.';

/**
 * Default snapshot for a brand-new session. Mirrors Python's defaults from
 * `GenerationSession`'s dataclass `field(default_factory=...)` declarations.
 *
 * @param gameDomain Nexus domain slug (e.g. `'skyrimspecialedition'`,
 *   `'fallout4'`) — same value Python writes into `session.game_domain`.
 */
export function createEmptySnapshot(gameDomain: string): GenerationSessionSnapshot {
  return {
    game_domain: gameDomain,
    modlist: [],
    patches: [],
    knowledge_flags: [],
    review_flags: [],
    description_cache: {},
    author_cache: {},
    reverse_deps_cache: {},
    searched_queries: [],
    fetched_mod_ids: [],
    completed_phases: [],
    preset: 'medium',
    next_load_order: 1,
    requested_mods: [],
  };
}

/** Persist a session record under its id. */
export function saveSession(session: StoredSession): void {
  const key = SESSION_KEY_PREFIX + session.id;
  localStorage.setItem(key, JSON.stringify(session));
}

/**
 * Load a session by id, or `null` if no such key. Returns `null` (rather than
 * throwing) when the stored payload fails to parse, since a corrupted entry
 * shouldn't take down the dashboard.
 */
export function loadSession(id: string): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** Return every stored session. Skips entries that fail to parse. */
export function listSessions(): StoredSession[] {
  const out: StoredSession[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(SESSION_KEY_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as StoredSession);
    } catch {
      // Skip corrupted entries silently.
    }
  }
  return out;
}

/** Remove a session by id. No-op if it doesn't exist. */
export function deleteSession(id: string): void {
  localStorage.removeItem(SESSION_KEY_PREFIX + id);
}

/**
 * Sessions the user can pick up where they left off — runs that are paused
 * (waiting on an API key swap, etc.) or running (e.g. browser tab closed
 * mid-run). `completed` and `failed` are excluded.
 */
export function findResumableSessions(): StoredSession[] {
  return listSessions().filter(
    (s) => s.status === 'paused' || s.status === 'running',
  );
}
