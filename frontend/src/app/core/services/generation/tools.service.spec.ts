/**
 * Tests for tools.service.ts.
 *
 * Source of truth:
 *   `backend/app/services/generation/tools.py`     (190 LOC) — tool schemas
 *   `backend/app/services/generation/handlers.py`  (606 LOC) — tool execution
 *
 * Plan deviations (verified against Python):
 *   - Python exports 10 tools across TWO sets: PHASE1_TOOLS (4) and
 *     PHASE2_TOOLS (6). The plan's "4 tools total" sketch is incomplete.
 *   - Plan said `searchMods(query, gameDomain)`. Real signature is
 *     `searchMods(gameDomain, searchTerm, sortBy?)`.
 *   - Session state already exists as `GenerationSessionSnapshot` —
 *     handlers MUTATE it in place (mirrors Python) instead of inventing
 *     a fresh shape.
 *   - Caches are `Record<string, ...>` in TS (JSON has no int keys), so
 *     reads/writes always go through `String(modId)`.
 */
import { TestBed } from '@angular/core/testing';

import {
  GenerationToolsService,
  PHASE1_TOOL_NAMES,
  PHASE2_TOOL_NAMES,
} from './tools.service';
import { NexusService } from '../nexus.service';
import { createEmptySnapshot } from './session';
import type { GenerationSessionSnapshot } from './types';

describe('GenerationToolsService', () => {
  let svc: GenerationToolsService;
  let nexusSpy: jasmine.SpyObj<NexusService>;
  let snapshot: GenerationSessionSnapshot;
  let events: Array<Record<string, unknown>>;
  const eventCallback = (e: Record<string, unknown>) => {
    events.push(e);
  };

  beforeEach(() => {
    nexusSpy = jasmine.createSpyObj<NexusService>('NexusService', [
      'searchMods',
      'getMod',
      'getModFiles',
    ]);
    TestBed.configureTestingModule({
      providers: [{ provide: NexusService, useValue: nexusSpy }],
    });
    svc = TestBed.inject(GenerationToolsService);
    snapshot = createEmptySnapshot('skyrimspecialedition');
    events = [];
  });

  // ───────────────────────────────────────────────────────────────────
  // Tool definitions
  // ───────────────────────────────────────────────────────────────────

  describe('tool definitions', () => {
    it('exposes the 4 PHASE1 tools (matches PHASE1_TOOLS in tools.py)', () => {
      const defs = svc.getPhase1ToolDefinitions();
      expect(defs.map((d) => d.name).sort()).toEqual([
        'add_to_modlist',
        'finalize',
        'get_mod_details',
        'search_nexus',
      ]);
      expect(PHASE1_TOOL_NAMES.length).toBe(4);
    });

    it('exposes the 6 PHASE2 tools (matches PHASE2_TOOLS in tools.py)', () => {
      const defs = svc.getPhase2ToolDefinitions();
      expect(defs.map((d) => d.name).sort()).toEqual([
        'add_patch',
        'finalize_review',
        'flag_user_knowledge',
        'get_mod_description',
        'get_reverse_deps',
        'search_patches',
      ]);
      expect(PHASE2_TOOL_NAMES.length).toBe(6);
    });

    it('search_nexus schema has query (required) + sort_by enum', () => {
      const def = svc
        .getPhase1ToolDefinitions()
        .find((d) => d.name === 'search_nexus')!;
      const params = def.parameters as {
        properties: { query: unknown; sort_by: { enum: string[] } };
        required: string[];
      };
      expect(params.required).toEqual(['query']);
      expect(params.properties.sort_by.enum).toEqual(['endorsements', 'updated']);
    });

    it('add_to_modlist schema requires mod_id, name, reason (snake_case preserved)', () => {
      const def = svc
        .getPhase1ToolDefinitions()
        .find((d) => d.name === 'add_to_modlist')!;
      const params = def.parameters as { required: string[] };
      expect(params.required).toEqual(['mod_id', 'name', 'reason']);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // search_nexus
  // ───────────────────────────────────────────────────────────────────

  describe('search_nexus', () => {
    it('calls NexusService.searchMods with snapshot.game_domain (NOT a hardcoded map)', async () => {
      nexusSpy.searchMods.and.resolveTo([
        {
          modId: 1,
          name: 'SkyUI',
          author: 'SkyUI Team',
          summary: 'UI overhaul',
          endorsements: 99999,
          modCategory: { name: 'UI' },
          updatedAt: '2024-01-01',
        },
      ]);

      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      const result = JSON.parse(
        await handlers['search_nexus']({ query: 'SkyUI' }),
      );

      // Python signature: search_mods(game_domain, query, sort_by=...)
      expect(nexusSpy.searchMods).toHaveBeenCalledWith(
        'skyrimspecialedition',
        'SkyUI',
        'endorsements',
      );
      expect(result.count).toBe(1);
      expect(result.results[0].name).toBe('SkyUI');
    });

    it('passes sort_by="updated" through to NexusService.searchMods', async () => {
      nexusSpy.searchMods.and.resolveTo([]);
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      await handlers['search_nexus']({ query: 'combat', sort_by: 'updated' });
      expect(nexusSpy.searchMods).toHaveBeenCalledWith(
        'skyrimspecialedition',
        'combat',
        'updated',
      );
    });

    it('dedupes repeat queries within a session (mirrors Python session.searched_queries)', async () => {
      nexusSpy.searchMods.and.resolveTo([
        { modId: 1, name: 'A', author: 'x' },
      ]);
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      await handlers['search_nexus']({ query: 'CoMbAt' });
      const second = JSON.parse(
        await handlers['search_nexus']({ query: 'combat' }),
      );

      // Second call for the same normalized query short-circuits: count=0,
      // 'note' explains it was already searched, NexusService NOT re-called.
      expect(second.count).toBe(0);
      expect(second.note).toContain('already searched');
      expect(nexusSpy.searchMods).toHaveBeenCalledTimes(1);
    });

    it('caps results at 15 and emits search_results event with sample_names[:5]', async () => {
      const fake = Array.from({ length: 25 }, (_, i) => ({
        modId: i + 1,
        name: `Mod${i + 1}`,
        author: 'a',
        summary: 's',
      }));
      nexusSpy.searchMods.and.resolveTo(fake);

      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      const result = JSON.parse(
        await handlers['search_nexus']({ query: 'unique' }),
      );

      expect(result.count).toBe(15); // capped at 15 (mirrors Python `results[:15]`)
      const evt = events.find((e) => e['type'] === 'search_results');
      expect(evt).toBeTruthy();
      expect((evt!['sample_names'] as string[]).length).toBe(5);
    });

    it('caches author + summary in snapshot for later lookups', async () => {
      nexusSpy.searchMods.and.resolveTo([
        { modId: 42, name: 'Foo', author: 'Bob', summary: 'A description' },
      ]);
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      await handlers['search_nexus']({ query: 'foo' });
      expect(snapshot.author_cache['42']).toBe('Bob');
      expect(snapshot.description_cache['42']).toBe('A description');
    });

    it('returns error JSON when NexusService.searchMods rejects', async () => {
      nexusSpy.searchMods.and.rejectWith(new Error('boom'));
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      const result = JSON.parse(
        await handlers['search_nexus']({ query: 'flames' }),
      );
      expect(result.error).toContain('Search temporarily unavailable');
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // get_mod_details
  // ───────────────────────────────────────────────────────────────────

  describe('get_mod_details', () => {
    it('calls NexusService.getMod with snapshot.game_domain + numeric mod_id', async () => {
      nexusSpy.getMod.and.resolveTo({
        modId: 7,
        name: 'Test',
        author: 'Alice',
        description: '<p>Hello</p>',
        summary: 'short',
        endorsements: 1,
      });
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      const result = JSON.parse(
        await handlers['get_mod_details']({ mod_id: 7 }),
      );

      expect(nexusSpy.getMod).toHaveBeenCalledWith('skyrimspecialedition', 7);
      expect(result.mod_id).toBe(7);
      // strip_html — <p> tags removed.
      expect(result.description).toBe('Hello');
    });

    it('returns cached description on a re-fetch (mirrors Python soft-cache)', async () => {
      // Pre-populate the cache as if a prior get_mod_details ran.
      snapshot.description_cache['7'] = 'X'.repeat(500);
      snapshot.author_cache['7'] = 'PriorAuthor';

      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      const result = JSON.parse(
        await handlers['get_mod_details']({ mod_id: 7 }),
      );

      expect(nexusSpy.getMod).not.toHaveBeenCalled();
      expect(result.note).toContain('cache');
      expect(result.author).toBe('PriorAuthor');
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // add_to_modlist
  // ───────────────────────────────────────────────────────────────────

  describe('add_to_modlist', () => {
    beforeEach(() => {
      // _resolve_primary_file calls getModFiles — give it a primary.
      nexusSpy.getModFiles.and.resolveTo([
        { fileId: 999, name: 'main.7z', sizeInBytes: 100, primary: true },
      ]);
    });

    it('appends to snapshot.modlist with monotonically increasing load_order', async () => {
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);

      await handlers['add_to_modlist']({
        mod_id: 1,
        name: 'A',
        reason: 'core',
      });
      await handlers['add_to_modlist']({
        mod_id: 2,
        name: 'B',
        reason: 'extra',
      });

      expect(snapshot.modlist.length).toBe(2);
      expect(snapshot.modlist[0]['load_order']).toBe(1);
      expect(snapshot.modlist[1]['load_order']).toBe(2);
      expect(snapshot.next_load_order).toBe(3);
    });

    it('rejects duplicate mod_id within a phase (returns status=duplicate)', async () => {
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      await handlers['add_to_modlist']({
        mod_id: 1,
        name: 'A',
        reason: 'core',
      });
      const second = JSON.parse(
        await handlers['add_to_modlist']({
          mod_id: 1,
          name: 'A',
          reason: 'duplicate try',
        }),
      );

      expect(second.status).toBe('duplicate');
      expect(snapshot.modlist.length).toBe(1);
    });

    it('coerces stringified mod_id to int (LLMs sometimes serialize ints as strings)', async () => {
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      const result = JSON.parse(
        await handlers['add_to_modlist']({
          // LLM passed "42" instead of 42.
          mod_id: '42' as unknown as number,
          name: 'Forty-Two',
          reason: 'r',
        }),
      );
      expect(result.status).toBe('added');
      expect(snapshot.modlist[0]['nexus_mod_id']).toBe(42);
    });

    it('resolves primary file via NexusService.getModFiles and stamps file_size_bytes', async () => {
      nexusSpy.getModFiles.and.resolveTo([
        { fileId: 11, name: 'old.7z', sizeInBytes: 50, primary: false },
        { fileId: 22, name: 'new.7z', sizeInBytes: 200, primary: true },
      ]);
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      await handlers['add_to_modlist']({
        mod_id: 5,
        name: 'M',
        reason: 'r',
      });
      const entry = snapshot.modlist[0];
      expect(entry['file_id']).toBe(22);
      expect(entry['file_size_bytes']).toBe(200);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // finalize
  // ───────────────────────────────────────────────────────────────────

  describe('finalize', () => {
    it('returns the terminal status the pipeline checks for', async () => {
      const handlers = svc.buildPhase1Handlers(snapshot, eventCallback);
      const result = JSON.parse(await handlers['finalize']({}));
      expect(result.status).toBe('finalized');
      expect(result.total_mods).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // PHASE2 handlers — quick smoke tests for the second tool surface
  // ───────────────────────────────────────────────────────────────────

  describe('phase2 handlers', () => {
    it('flag_user_knowledge appends to snapshot.knowledge_flags', async () => {
      const handlers = svc.buildPhase2Handlers(snapshot, eventCallback);
      const result = JSON.parse(
        await handlers['flag_user_knowledge']({
          mod_a: 'X',
          mod_b: 'Y',
          issue: 'overlap',
          severity: 'warning',
        }),
      );
      expect(result.status).toBe('flagged');
      expect(snapshot.knowledge_flags.length).toBe(1);
      const flag = snapshot.knowledge_flags[0] as Record<string, string>;
      expect(flag['mod_a']).toBe('X');
      expect(flag['severity']).toBe('warning');
    });

    it('add_patch appends to snapshot.patches with load_order from session counter', async () => {
      nexusSpy.getModFiles.and.resolveTo([
        { fileId: 1, name: 'p.7z', sizeInBytes: 10, primary: true },
      ]);
      const handlers = svc.buildPhase2Handlers(snapshot, eventCallback);
      await handlers['add_patch']({
        mod_id: 100,
        name: 'Patch',
        patches_mods: ['A', 'B'],
        reason: 'compat',
      });
      expect(snapshot.patches.length).toBe(1);
      expect(snapshot.patches[0]['nexus_mod_id']).toBe(100);
      expect(snapshot.patches[0]['load_order']).toBe(1);
      expect(snapshot.next_load_order).toBe(2);
    });

    it('finalize_review returns review-complete signal', async () => {
      const handlers = svc.buildPhase2Handlers(snapshot, eventCallback);
      const result = JSON.parse(await handlers['finalize_review']({}));
      expect(result.status).toBe('review_complete');
    });
  });
});
