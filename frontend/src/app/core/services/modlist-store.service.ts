import { Injectable, signal } from '@angular/core';
import { Modlist } from '../../shared/models/mod.model';

/**
 * ModlistStore — localStorage-backed CRUD for generated modlists.
 *
 * Replaces the backend's `Modlist` SQLAlchemy CRUD now that the
 * generation pipeline runs entirely in the browser. Multi-modlist storage
 * uses one key per modlist (`modlist.<id>`) plus an index list at
 * `modlist.index` so we can enumerate without scanning all of localStorage.
 *
 * The `version` signal bumps on every mutation; UI components that want to
 * react to changes (e.g. a "saved modlists" page) can effect-subscribe to it.
 */

const KEY_PREFIX = 'modlist.';
const INDEX_KEY = 'modlist.index';

@Injectable({ providedIn: 'root' })
export class ModlistStore {
  /** Bumps on every mutation; UI subscribes for reactive updates. */
  readonly version = signal(0);

  /** Return all saved modlists in index order. */
  list(): Modlist[] {
    const ids = this.readIndex();
    return ids
      .map((id) => this.get(id))
      .filter((m): m is Modlist => m !== null);
  }

  /** Look up a single modlist by id. Returns `null` if not found. */
  get(id: string): Modlist | null {
    const raw = localStorage.getItem(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as Modlist) : null;
  }

  /** Save (or overwrite) a modlist. Idempotent on the index. */
  save(ml: Modlist): void {
    localStorage.setItem(KEY_PREFIX + ml.id, JSON.stringify(ml));
    const ids = new Set(this.readIndex());
    ids.add(ml.id);
    localStorage.setItem(INDEX_KEY, JSON.stringify([...ids]));
    this.version.update((v) => v + 1);
  }

  /** Remove a modlist (no-op if missing). */
  delete(id: string): void {
    localStorage.removeItem(KEY_PREFIX + id);
    const ids = this.readIndex().filter((x) => x !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
    this.version.update((v) => v + 1);
  }

  private readIndex(): string[] {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  }
}
