import { TestBed } from '@angular/core/testing';
import { ModlistStore } from './modlist-store.service';
import { Modlist } from '../../shared/models/mod.model';

const SAMPLE = (id: string, label: string): Modlist => ({
  id,
  game_id: 1,
  game_version: 'AE',
  entries: [{ name: label, load_order: 1, is_patch: false }],
});

describe('ModlistStore', () => {
  let svc: ModlistStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    svc = TestBed.inject(ModlistStore);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('list() returns empty array when none saved', () => {
    expect(svc.list()).toEqual([]);
  });

  it('save() then list() returns the saved modlist', () => {
    svc.save(SAMPLE('a', 'first'));
    const list = svc.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('a');
    expect(list[0].entries[0].name).toBe('first');
  });

  it('get(id) returns the matching modlist or null when absent', () => {
    svc.save(SAMPLE('a', 'hello'));
    expect(svc.get('a')?.entries[0].name).toBe('hello');
    expect(svc.get('does-not-exist')).toBeNull();
  });

  it('delete(id) removes the modlist and its index entry', () => {
    svc.save(SAMPLE('a', 'first'));
    svc.delete('a');
    expect(svc.list()).toEqual([]);
    // Direct localStorage check — the per-id key is gone too, not just the index.
    expect(localStorage.getItem('modlist.a')).toBeNull();
  });

  it('save() with the same id overwrites without duplicating the index entry', () => {
    svc.save(SAMPLE('a', 'V1'));
    svc.save(SAMPLE('a', 'V2'));
    expect(svc.list().length).toBe(1);
    expect(svc.get('a')?.entries[0].name).toBe('V2');
    // Index should contain exactly one occurrence of 'a'.
    const idx = JSON.parse(localStorage.getItem('modlist.index') ?? '[]') as string[];
    expect(idx).toEqual(['a']);
  });
});
