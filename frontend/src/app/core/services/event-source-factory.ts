/**
 * Tiny indirection so tests can stub the native EventSource constructor.
 *
 * The browser's `EventSource` is not easily spy-able when constructed inline
 * with `new EventSource(url)` — the test would have to monkey-patch the
 * global. By going through this factory, tests just inject a stub provider
 * and assert calls against `factory.create`.
 *
 * Plan 1 Task 14.
 */
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EventSourceFactory {
  /** Build a native EventSource. Stub this in tests. */
  create(url: string): EventSource {
    return new EventSource(url);
  }
}
