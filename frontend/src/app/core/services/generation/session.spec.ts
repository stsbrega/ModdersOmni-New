/**
 * Tests for session.ts. localStorage-backed snapshot helpers.
 *
 * Python's `GenerationSession` is a runtime dataclass holding a
 * `NexusModsClient` plus mutable state. The TS port stores only the
 * SERIALIZABLE shape (`StoredSession.snapshot`), since the frontend's
 * "session store" is just a dashboard for resumable runs.
 */

import {
  createEmptySnapshot,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  findResumableSessions,
} from './session';
import type { StoredSession } from './types';

describe('session', () => {
  beforeEach(() => localStorage.clear());

  function makeStored(
    id: string,
    status: StoredSession['status'],
  ): StoredSession {
    return {
      id,
      status,
      created_at: '2026-05-09T00:00:00.000Z',
      updated_at: '2026-05-09T00:00:00.000Z',
      game_slug: 'skyrimse',
      game_version: 'SE',
      preset: 'medium',
      current_phase_index: 0,
      snapshot: createEmptySnapshot('skyrimspecialedition'),
    };
  }

  it('createEmptySnapshot returns the same dict shape Python to_snapshot produces', () => {
    const snap = createEmptySnapshot('skyrimspecialedition');
    expect(snap.game_domain).toBe('skyrimspecialedition');
    expect(snap.modlist).toEqual([]);
    expect(snap.patches).toEqual([]);
    expect(snap.knowledge_flags).toEqual([]);
    expect(snap.review_flags).toEqual([]);
    expect(snap.description_cache).toEqual({});
    expect(snap.author_cache).toEqual({});
    expect(snap.reverse_deps_cache).toEqual({});
    expect(snap.searched_queries).toEqual([]);
    expect(snap.fetched_mod_ids).toEqual([]);
    expect(snap.completed_phases).toEqual([]);
    expect(snap.preset).toBe('medium');
    expect(snap.next_load_order).toBe(1);
    expect(snap.requested_mods).toEqual([]);
  });

  it('saveSession + loadSession roundtrips through localStorage', () => {
    const s = makeStored('a', 'running');
    saveSession(s);
    const loaded = loadSession('a');
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe('a');
    expect(loaded?.status).toBe('running');
    expect(loaded?.game_slug).toBe('skyrimse');
  });

  it('loadSession returns null for missing id', () => {
    expect(loadSession('does-not-exist')).toBeNull();
  });

  it('listSessions returns every snapshotted session', () => {
    saveSession(makeStored('a', 'running'));
    saveSession(makeStored('b', 'completed'));
    saveSession(makeStored('c', 'paused'));
    expect(listSessions().map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('listSessions ignores unrelated localStorage keys', () => {
    localStorage.setItem('unrelated', 'value');
    saveSession(makeStored('a', 'running'));
    expect(listSessions().length).toBe(1);
  });

  it('listSessions silently skips entries that fail to JSON.parse', () => {
    // Direct write of a malformed snapshot at the right key prefix.
    localStorage.setItem('moddersomni.session.bad', '{not json');
    saveSession(makeStored('a', 'running'));
    const ids = listSessions().map((s) => s.id);
    expect(ids).toEqual(['a']);
  });

  it('findResumableSessions filters to running + paused', () => {
    saveSession(makeStored('a', 'running'));
    saveSession(makeStored('b', 'completed'));
    saveSession(makeStored('c', 'paused'));
    saveSession(makeStored('d', 'failed'));
    expect(findResumableSessions().map((s) => s.id).sort()).toEqual(['a', 'c']);
  });

  it('deleteSession removes the entry', () => {
    saveSession(makeStored('a', 'running'));
    deleteSession('a');
    expect(loadSession('a')).toBeNull();
  });
});
