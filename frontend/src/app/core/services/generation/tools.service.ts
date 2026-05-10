/**
 * Generation tool definitions + handler builders.
 *
 * Faithful TS port of:
 *   `backend/app/services/generation/tools.py`     — tool JSON Schemas
 *   `backend/app/services/generation/handlers.py`  — closures invoked when
 *                                                    the LLM calls a tool
 *
 * Plan deviations (verified against Python ground truth):
 *   - Python exports TWO tool sets, not one. The plan said "4 tools"; Python
 *     has 4 PHASE1 tools (`search_nexus`, `get_mod_details`, `add_to_modlist`,
 *     `finalize`) plus 6 PHASE2 tools (`get_mod_description`, `get_reverse_deps`,
 *     `search_patches`, `add_patch`, `flag_user_knowledge`, `finalize_review`).
 *     The pipeline (Task 13) picks which set to expose for each phase.
 *   - The plan's `getToolDefinitions()` / `handle()` API is replaced by
 *     `getPhase1ToolDefinitions()` / `getPhase2ToolDefinitions()` and
 *     `buildPhase1Handlers(snapshot, eventCallback)` /
 *     `buildPhase2Handlers(snapshot, eventCallback)` to mirror Python.
 *   - NexusService methods are `searchMods(domain, term, sortBy?)` and
 *     `getMod(domain, modId)` and `getModFiles(domain, modId)` —
 *     the plan listed the wrong arg order for `searchMods`.
 *   - JSON Schemas are copied VERBATIM from Python (snake_case keys, exact
 *     wording, exact enum values). Wire format must match because the LLM
 *     was prompted on Python's exact tool descriptions.
 *
 * The handlers MUTATE the snapshot in place — same contract as Python's
 * `GenerationSession`. `searched_queries` is a `string[]` here (instead of
 * Python's `set[str]`) because JSON has no Set primitive; we use `.includes`
 * for membership. Caches keyed by `mod_id` use `String(mod_id)` because
 * JSON object keys are always strings.
 *
 * Plan 1 Task 11.
 */
import { Injectable, inject } from '@angular/core';

import { NexusService, type NexusModSummary } from '../nexus.service';
import type { ToolDefinition } from '../llm/types';
import type {
  GenerationSessionSnapshot,
  SessionModEntry,
  SessionPatchEntry,
} from './types';

/** Lightweight event emitter contract — same shape Python uses. */
export type ToolEventCallback = (event: Record<string, unknown>) => void;

/** Map of tool name → async handler (returns a JSON string the LLM consumes). */
export type ToolHandlerMap = Record<
  string,
  (args: Record<string, unknown>) => Promise<string>
>;

// ─────────────────────────────────────────────────────────────────────
// PHASE 1 tools — schemas copied VERBATIM from `tools.py:PHASE1_TOOLS`
// ─────────────────────────────────────────────────────────────────────

const PHASE1_TOOL_DEFS: ToolDefinition[] = [
  {
    name: 'search_nexus',
    description:
      'Search Nexus Mods for mods matching a query. ' +
      'Use varied, specific search terms for different mod categories. ' +
      'Try different sort orders to discover hidden gems beyond the most popular.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            "Search term (e.g. 'texture overhaul', 'combat', 'UI')",
        },
        sort_by: {
          type: 'string',
          enum: ['endorsements', 'updated'],
          description: "Sort order. Use 'updated' to find newer mods.",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_mod_details',
    description:
      'Get full details and description for a specific mod. ' +
      'Use this to read about a mod before deciding to include it.',
    parameters: {
      type: 'object',
      properties: {
        mod_id: { type: 'integer', description: 'Nexus mod ID' },
      },
      required: ['mod_id'],
    },
  },
  {
    name: 'add_to_modlist',
    description:
      "Add a mod to the modlist. Only add mods you've reviewed and believe fit " +
      "the user's playstyle and hardware. " +
      'Each mod may be added at most once — duplicate calls for the same mod_id ' +
      "are rejected. If you get a 'duplicate' response, move on to a different mod. " +
      'The system assigns load order automatically based on add order — do not ' +
      'pass load_order; focus on selection quality.',
    parameters: {
      type: 'object',
      properties: {
        mod_id: { type: 'integer', description: 'Nexus mod ID' },
        name: { type: 'string' },
        author: { type: 'string' },
        summary: { type: 'string', description: 'Short summary of the mod' },
        reason: {
          type: 'string',
          description: "Why this mod fits the user's playstyle",
        },
        estimated_size_mb: {
          type: 'integer',
          description: 'Estimated download size in MB',
        },
      },
      required: ['mod_id', 'name', 'reason'],
    },
  },
  {
    name: 'finalize',
    description:
      'Call when you are done with this phase. ' +
      'Do not call this until you have added all desired mods for this phase.',
    parameters: { type: 'object', properties: {} },
  },
];

// ─────────────────────────────────────────────────────────────────────
// PHASE 2 tools — schemas copied VERBATIM from `tools.py:PHASE2_TOOLS`
// ─────────────────────────────────────────────────────────────────────

const PHASE2_TOOL_DEFS: ToolDefinition[] = [
  {
    name: 'get_mod_description',
    description:
      'Get the full description of a mod page. ' +
      'Check this FIRST for patch links and compatibility notes before searching.',
    parameters: {
      type: 'object',
      properties: {
        mod_id: { type: 'integer', description: 'Nexus mod ID' },
      },
      required: ['mod_id'],
    },
  },
  {
    name: 'get_reverse_deps',
    description:
      'Get mods that list this mod as a requirement on Nexus. ' +
      'Compatibility patches are commonly found here — look for entries ' +
      "whose names contain 'patch', 'compatibility', or reference another mod in the list.",
    parameters: {
      type: 'object',
      properties: {
        mod_id: { type: 'integer', description: 'Nexus mod ID to check' },
      },
      required: ['mod_id'],
    },
  },
  {
    name: 'search_patches',
    description:
      'Search Nexus by mod name for compatibility patches. ' +
      'Use ONLY as a last resort — prefer get_reverse_deps and get_mod_description first.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: "Search term (e.g. 'SkyUI USSEP patch')",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_patch',
    description:
      'Add a compatibility patch mod to the modlist. ' +
      'Each mod_id may be added at most once — duplicates are rejected.',
    parameters: {
      type: 'object',
      properties: {
        mod_id: { type: 'integer', description: 'Nexus mod ID of the patch' },
        name: { type: 'string' },
        author: { type: 'string' },
        patches_mods: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of the mods this patches',
        },
        reason: { type: 'string' },
      },
      required: ['mod_id', 'name', 'patches_mods', 'reason'],
    },
  },
  {
    name: 'flag_user_knowledge',
    description:
      'Flag a compatibility issue where no patch exists yet. ' +
      'This helps the user know where future AI-generated patches may be needed.',
    parameters: {
      type: 'object',
      properties: {
        mod_a: { type: 'string', description: 'First mod name' },
        mod_b: { type: 'string', description: 'Second mod name' },
        issue: {
          type: 'string',
          description: 'Description of the compatibility issue',
        },
        severity: {
          type: 'string',
          enum: ['warning', 'critical'],
        },
      },
      required: ['mod_a', 'mod_b', 'issue', 'severity'],
    },
  },
  {
    name: 'finalize_review',
    description: 'Call when you are done reviewing all mods for patches.',
    parameters: { type: 'object', properties: {} },
  },
];

/** Tool names exposed to PHASE 1 — handy for tests + pipeline assertions. */
export const PHASE1_TOOL_NAMES: readonly string[] = PHASE1_TOOL_DEFS.map(
  (d) => d.name,
);
/** Tool names exposed to PHASE 2 — handy for tests + pipeline assertions. */
export const PHASE2_TOOL_NAMES: readonly string[] = PHASE2_TOOL_DEFS.map(
  (d) => d.name,
);

// ─────────────────────────────────────────────────────────────────────
// Helpers (mirror handlers.py underscore-prefixed helpers)
// ─────────────────────────────────────────────────────────────────────

/**
 * Mirror of `_coerce_int` in handlers.py. The LLM occasionally serializes
 * numeric mod_ids as strings; coerce them to int at the boundary so
 * downstream lookups stay consistent.
 */
function coerceInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Naive HTML → text converter — mirrors `session.py:strip_html` fallback.
 * Python uses an html-to-markdown library when available; we fall back to the
 * same regex pipeline for the browser. Good enough for description previews
 * the LLM consumes (no need for full markdown semantics in the TS port).
 */
function stripHtml(html: string, maxLength = 5000): string {
  if (!html || !html.trim()) return '';
  // <br> → newline, then strip remaining tags into a space.
  let text = html.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');
  // Collapse 3+ newlines to 2 (preserves paragraph breaks).
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  // Collapse runs of whitespace inside a line.
  text = text.replace(/[ \t]{2,}/g, ' ').trim();
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '\n\n... [truncated]';
  }
  return text;
}

/** Mirror of handlers.py:emit — fan out a structured event if a callback is set. */
function emit(
  callback: ToolEventCallback | undefined,
  type: string,
  data: Record<string, unknown>,
  debug?: Record<string, unknown>,
): void {
  if (!callback) return;
  const event: Record<string, unknown> = { type, ...data };
  if (debug) event['_debug'] = debug;
  callback(event);
}

@Injectable({ providedIn: 'root' })
export class GenerationToolsService {
  private readonly nexus = inject(NexusService);

  /** PHASE 1 tool definitions (verbatim from `tools.py:PHASE1_TOOLS`). */
  getPhase1ToolDefinitions(): ToolDefinition[] {
    return PHASE1_TOOL_DEFS;
  }

  /** PHASE 2 tool definitions (verbatim from `tools.py:PHASE2_TOOLS`). */
  getPhase2ToolDefinitions(): ToolDefinition[] {
    return PHASE2_TOOL_DEFS;
  }

  /**
   * Build the PHASE 1 tool handler map. Mirrors `handlers.build_phase1_handlers`.
   * Closures capture the snapshot + callback so the orchestrator can hand the
   * resulting map straight to the tool-calling loop.
   */
  buildPhase1Handlers(
    snapshot: GenerationSessionSnapshot,
    eventCallback?: ToolEventCallback,
  ): ToolHandlerMap {
    return {
      search_nexus: (args) =>
        this.handleSearchNexus(snapshot, eventCallback, args),
      get_mod_details: (args) =>
        this.handleGetModDetails(snapshot, eventCallback, args),
      add_to_modlist: (args) =>
        this.handleAddToModlist(snapshot, eventCallback, args),
      finalize: () => this.handleFinalize(snapshot),
    };
  }

  /**
   * Build the PHASE 2 tool handler map. Mirrors `handlers.build_phase2_handlers`.
   * The Python factory captures two extra closures (`checked_descriptions` and
   * `checked_reverse_deps`) — we mirror them as scoped Sets here.
   */
  buildPhase2Handlers(
    snapshot: GenerationSessionSnapshot,
    eventCallback?: ToolEventCallback,
  ): ToolHandlerMap {
    const checkedDescriptions = new Set<number>();
    const checkedReverseDeps = new Set<number>();

    return {
      get_mod_description: (args) =>
        this.handleGetModDescription(
          snapshot,
          eventCallback,
          checkedDescriptions,
          args,
        ),
      get_reverse_deps: (args) =>
        this.handleGetReverseDeps(
          snapshot,
          eventCallback,
          checkedReverseDeps,
          args,
        ),
      search_patches: (args) =>
        this.handleSearchPatches(snapshot, eventCallback, args),
      add_patch: (args) => this.handleAddPatch(snapshot, eventCallback, args),
      flag_user_knowledge: (args) =>
        this.handleFlagUserKnowledge(snapshot, eventCallback, args),
      finalize_review: () => this.handleFinalizeReview(snapshot),
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // PHASE 1 handler bodies — 1:1 with handlers.py
  // ───────────────────────────────────────────────────────────────────

  private async handleSearchNexus(
    snapshot: GenerationSessionSnapshot,
    eventCallback: ToolEventCallback | undefined,
    args: Record<string, unknown>,
  ): Promise<string> {
    const query = String(args['query'] ?? '');
    const sortBy = (args['sort_by'] as 'endorsements' | 'updated') ??
      'endorsements';
    const normalized = query.trim().toLowerCase();

    if (snapshot.searched_queries.includes(normalized)) {
      emit(eventCallback, 'searching', { query });
      emit(
        eventCallback,
        'search_results',
        { count: 0, sample_names: [] },
        { all_names: [], skipped: 'duplicate_query' },
      );
      return JSON.stringify({
        results: [],
        count: 0,
        note: `You already searched for '${query}' — try different keywords.`,
      });
    }
    snapshot.searched_queries.push(normalized);

    emit(eventCallback, 'searching', { query });

    let results;
    try {
      results = await this.nexus.searchMods(
        snapshot.game_domain,
        query,
        sortBy,
      );
    } catch {
      return JSON.stringify({
        error: 'Search temporarily unavailable. Try a different query.',
      });
    }

    // `results[:15]` in Python.
    const mods: Array<Record<string, unknown>> = [];
    for (const m of results.slice(0, 15)) {
      const author = m.author ?? 'Unknown';
      const modId = m.modId;
      snapshot.author_cache[String(modId)] = String(author);
      const summary = (m.summary ?? '').slice(0, 200);
      // Soft-cache summary on FIRST sighting only — don't clobber a fuller
      // description that get_mod_details may have already populated.
      if (!(String(modId) in snapshot.description_cache)) {
        snapshot.description_cache[String(modId)] = summary;
      }
      mods.push({
        mod_id: modId,
        name: m.name,
        author,
        summary,
        endorsements: m.endorsements ?? 0,
        category: m.modCategory?.name ?? '',
        updated: m.updatedAt ?? '',
      });
    }
    const allNames = mods.map((m) => m['name']);
    emit(
      eventCallback,
      'search_results',
      { count: mods.length, sample_names: allNames.slice(0, 5) },
      { all_names: allNames },
    );
    return JSON.stringify({ results: mods, count: mods.length });
  }

  private async handleGetModDetails(
    snapshot: GenerationSessionSnapshot,
    eventCallback: ToolEventCallback | undefined,
    args: Record<string, unknown>,
  ): Promise<string> {
    const modId = coerceInt(args['mod_id']);
    if (modId === null) {
      return JSON.stringify({ error: 'mod_id must be an integer' });
    }
    emit(eventCallback, 'reading_mod', { mod_id: modId });

    // Cache hit short-circuit (mirrors Python `if cached_desc and len > 200`).
    const cachedDesc = snapshot.description_cache[String(modId)];
    if (cachedDesc && cachedDesc.length > 200) {
      const author = snapshot.author_cache[String(modId)] ?? 'Unknown';
      const result: Record<string, unknown> = {
        mod_id: modId,
        description: cachedDesc.slice(0, 3000),
        author,
        note: 'Retrieved from cache (previously fetched this session)',
      };
      const reverse = snapshot.reverse_deps_cache[String(modId)];
      if (reverse) result['mods_requiring_this'] = reverse;
      return JSON.stringify(result);
    }

    let details;
    try {
      details = await this.nexus.getMod(snapshot.game_domain, modId);
    } catch {
      return JSON.stringify({
        error: `Could not fetch mod ${modId}. Try another mod.`,
      });
    }
    if (!details) {
      return JSON.stringify({ error: `Mod ${modId} not found` });
    }

    const descText = stripHtml(details.description ?? '');
    snapshot.description_cache[String(modId)] = descText;
    const author = details.author ?? 'Unknown';
    snapshot.author_cache[String(modId)] = String(author);

    const requirements: Array<Record<string, unknown>> = [];
    const reverseDeps: Array<Record<string, unknown>> = [];
    let reverseDepsCount = 0;
    const modReqs = details.modRequirements;
    if (modReqs) {
      const nexusReqs = modReqs.nexusRequirements?.nodes ?? [];
      for (const req of nexusReqs) {
        requirements.push({
          mod_id: req.modId,
          name: req.modName ?? '',
          notes: req.notes ?? '',
        });
      }
      const reverseData = modReqs.modsRequiringThisMod;
      reverseDepsCount = reverseData?.totalCount ?? 0;
      for (const rd of (reverseData?.nodes ?? []).slice(0, 20)) {
        reverseDeps.push({
          mod_id: rd.modId,
          name: rd.modName ?? '',
          notes: rd.notes ?? '',
        });
      }
      snapshot.reverse_deps_cache[String(modId)] = reverseDeps;
    }

    const result: Record<string, unknown> = {
      mod_id: details.modId,
      name: details.name,
      author,
      summary: details.summary ?? '',
      description: descText,
      endorsements: details.endorsements ?? 0,
      category: details.modCategory?.name ?? '',
    };
    if (requirements.length) result['requirements'] = requirements;
    if (reverseDeps.length) {
      result['mods_requiring_this'] = reverseDeps;
      result['mods_requiring_this_total'] = reverseDepsCount;
    }
    return JSON.stringify(result);
  }

  private async handleAddToModlist(
    snapshot: GenerationSessionSnapshot,
    eventCallback: ToolEventCallback | undefined,
    args: Record<string, unknown>,
  ): Promise<string> {
    const coercedId = coerceInt(args['mod_id']);
    if (coercedId === null) {
      return JSON.stringify({
        status: 'error',
        message: `mod_id must be an integer (got ${JSON.stringify(args['mod_id'])}).`,
      });
    }
    const modId = coercedId;
    const name = String(args['name'] ?? '');
    const reason = String(args['reason'] ?? '');
    const author = String(args['author'] ?? '');
    const summary = String(args['summary'] ?? '');
    const estimatedSizeMb = (coerceInt(args['estimated_size_mb']) ?? 0);

    // Dedupe: by nexus_mod_id for real Nexus mods (>0), by name for manual
    // download placeholders (e.g. SKSE, F4SE — handled with mod_id = 0).
    const already =
      modId > 0
        ? snapshot.modlist.some((e) => e['nexus_mod_id'] === modId)
        : snapshot.modlist.some(
            (e) => e['nexus_mod_id'] === 0 && e['name'] === name,
          );
    if (already) {
      emit(eventCallback, 'duplicate_rejected', { mod_id: modId, name });
      return JSON.stringify({
        status: 'duplicate',
        message: `'${name}' (id=${modId}) is already in the modlist. ` +
          'Do not add it again — move on to the next mod.',
        current_count: snapshot.modlist.length,
      });
    }

    const resolvedAuthor =
      author || snapshot.author_cache[String(modId)] || '';
    const { fileId, fileSizeBytes } = await this.resolvePrimaryFile(
      snapshot,
      modId,
    );
    const assignedLoadOrder = snapshot.next_load_order;
    snapshot.next_load_order += 1;
    const entry: SessionModEntry = {
      nexus_mod_id: modId,
      file_id: fileId ?? undefined,
      file_size_bytes: fileSizeBytes ?? undefined,
      name,
      author: resolvedAuthor,
      summary,
      reason,
      load_order: assignedLoadOrder,
      estimated_size_mb: estimatedSizeMb,
      is_patch: false,
    };
    snapshot.modlist.push(entry);

    emit(eventCallback, 'mod_added', {
      mod_id: modId,
      name,
      reason,
      load_order: assignedLoadOrder,
    });
    const totalBytes = snapshot.modlist.reduce(
      (sum, e) => sum + ((e['file_size_bytes'] as number | undefined) ?? 0),
      0,
    );
    emit(eventCallback, 'size_update', {
      total_bytes: totalBytes,
      mod_count: snapshot.modlist.length,
    });
    return JSON.stringify({
      status: 'added',
      name,
      current_count: snapshot.modlist.length,
    });
  }

  private async handleFinalize(
    snapshot: GenerationSessionSnapshot,
  ): Promise<string> {
    return JSON.stringify({
      status: 'finalized',
      total_mods: snapshot.modlist.length,
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // PHASE 2 handler bodies — 1:1 with handlers.py
  // ───────────────────────────────────────────────────────────────────

  private async handleGetModDescription(
    snapshot: GenerationSessionSnapshot,
    eventCallback: ToolEventCallback | undefined,
    checked: Set<number>,
    args: Record<string, unknown>,
  ): Promise<string> {
    const modId = coerceInt(args['mod_id']);
    if (modId === null) {
      return JSON.stringify({ error: 'mod_id must be an integer' });
    }
    if (checked.has(modId)) {
      const desc = snapshot.description_cache[String(modId)] ?? '';
      return JSON.stringify({
        mod_id: modId,
        note:
          "You already reviewed this mod's description earlier. " +
          'Move on to other mods.',
        description_preview: desc ? desc.slice(0, 200) : '(no description)',
      });
    }
    checked.add(modId);
    emit(eventCallback, 'reading_mod', { mod_id: modId });

    if (String(modId) in snapshot.description_cache) {
      return JSON.stringify({
        mod_id: modId,
        description: snapshot.description_cache[String(modId)],
      });
    }
    let details;
    try {
      details = await this.nexus.getMod(snapshot.game_domain, modId);
    } catch {
      return JSON.stringify({ error: `Could not fetch mod ${modId}` });
    }
    if (!details) {
      return JSON.stringify({ error: `Mod ${modId} not found` });
    }
    const descText = stripHtml(details.description ?? '');
    snapshot.description_cache[String(modId)] = descText;
    return JSON.stringify({ mod_id: modId, description: descText });
  }

  private async handleGetReverseDeps(
    snapshot: GenerationSessionSnapshot,
    eventCallback: ToolEventCallback | undefined,
    checked: Set<number>,
    args: Record<string, unknown>,
  ): Promise<string> {
    const modId = coerceInt(args['mod_id']);
    if (modId === null) {
      return JSON.stringify({ error: 'mod_id must be an integer' });
    }
    if (checked.has(modId)) {
      const cached = snapshot.reverse_deps_cache[String(modId)] ?? [];
      return JSON.stringify({
        mod_id: modId,
        note: "You already checked this mod's reverse deps. Move on.",
        count: cached.length,
      });
    }
    checked.add(modId);

    if (String(modId) in snapshot.reverse_deps_cache) {
      return JSON.stringify({
        mod_id: modId,
        mods_requiring_this: snapshot.reverse_deps_cache[String(modId)],
        source: 'cached_from_earlier_phase',
      });
    }

    emit(eventCallback, 'reading_mod', { mod_id: modId });
    let details;
    try {
      details = await this.nexus.getMod(snapshot.game_domain, modId);
    } catch {
      return JSON.stringify({ error: `Could not fetch mod ${modId}` });
    }
    if (!details) {
      return JSON.stringify({ error: `Mod ${modId} not found` });
    }
    const modReqs = details.modRequirements ?? {};
    const reverseData = modReqs.modsRequiringThisMod ?? {
      nodes: [],
      totalCount: 0,
    };
    const nodes: Array<Record<string, unknown>> = [];
    for (const rd of reverseData.nodes ?? []) {
      nodes.push({
        mod_id: rd.modId,
        name: rd.modName ?? '',
        notes: rd.notes ?? '',
      });
    }
    snapshot.reverse_deps_cache[String(modId)] = nodes;
    return JSON.stringify({
      mod_id: modId,
      mods_requiring_this: nodes,
      total_count: reverseData.totalCount ?? 0,
    });
  }

  private async handleSearchPatches(
    snapshot: GenerationSessionSnapshot,
    eventCallback: ToolEventCallback | undefined,
    args: Record<string, unknown>,
  ): Promise<string> {
    const query = String(args['query'] ?? '');
    const normalized = query.trim().toLowerCase();
    if (snapshot.searched_queries.includes(normalized)) {
      emit(eventCallback, 'searching', { query });
      emit(
        eventCallback,
        'search_results',
        { count: 0, sample_names: [] },
        { all_names: [], skipped: 'duplicate_query' },
      );
      return JSON.stringify({
        results: [],
        count: 0,
        note: `You already searched for '${query}' — try different keywords.`,
      });
    }
    snapshot.searched_queries.push(normalized);
    emit(eventCallback, 'searching', { query });

    const allResults = new Map<number, NexusModSummary>();

    // Strategy 1: original query.
    try {
      const r = await this.nexus.searchMods(
        snapshot.game_domain,
        query,
        'endorsements',
      );
      for (const m of r.slice(0, 10)) allResults.set(m.modId, m);
    } catch {
      // mirrors Python: log + continue, fall through to strategies 2/3
    }

    // Strategy 2: drop apostrophes if we have <3 hits.
    if (allResults.size < 3 && query.includes("'")) {
      const altQuery = query.replace(/'/g, '');
      try {
        const r = await this.nexus.searchMods(
          snapshot.game_domain,
          altQuery,
          'endorsements',
        );
        for (const m of r.slice(0, 10)) {
          if (!allResults.has(m.modId)) allResults.set(m.modId, m);
        }
      } catch {
        /* ignore */
      }
    }

    // Strategy 3: "<first mod name> Patch Hub".
    if (allResults.size < 3) {
      const firstMod = query
        .split(' patch')[0]
        .split(' compatibility')[0]
        .trim();
      if (firstMod && firstMod.toLowerCase() !== query.toLowerCase()) {
        const hubQuery = `${firstMod} Patch Hub`;
        try {
          const r = await this.nexus.searchMods(
            snapshot.game_domain,
            hubQuery,
            'endorsements',
          );
          for (const m of r.slice(0, 10)) {
            if (!allResults.has(m.modId)) allResults.set(m.modId, m);
          }
        } catch {
          /* ignore */
        }
      }
    }

    const patches: Array<Record<string, unknown>> = [];
    for (const m of Array.from(allResults.values()).slice(0, 10)) {
      const author = m.author ?? 'Unknown';
      const modId = m.modId;
      snapshot.author_cache[String(modId)] = String(author);
      patches.push({
        mod_id: modId,
        name: m.name,
        author,
        summary: (m.summary ?? '').slice(0, 200),
        endorsements: m.endorsements ?? 0,
      });
    }
    const allPatchNames = patches.map((p) => p['name']);
    emit(
      eventCallback,
      'search_results',
      { count: patches.length, sample_names: allPatchNames.slice(0, 5) },
      { all_names: allPatchNames },
    );
    return JSON.stringify({ results: patches, count: patches.length });
  }

  private async handleAddPatch(
    snapshot: GenerationSessionSnapshot,
    eventCallback: ToolEventCallback | undefined,
    args: Record<string, unknown>,
  ): Promise<string> {
    const coercedId = coerceInt(args['mod_id']);
    if (coercedId === null) {
      return JSON.stringify({
        status: 'error',
        message: `mod_id must be an integer (got ${JSON.stringify(args['mod_id'])}).`,
      });
    }
    const modId = coercedId;
    const name = String(args['name'] ?? '');
    const reason = String(args['reason'] ?? '');
    const author = String(args['author'] ?? '');
    const patchesMods = (args['patches_mods'] as string[] | undefined) ?? [];

    const combined = [...snapshot.modlist, ...snapshot.patches];
    if (
      modId > 0 &&
      combined.some((e) => e['nexus_mod_id'] === modId)
    ) {
      emit(eventCallback, 'duplicate_rejected', { mod_id: modId, name });
      return JSON.stringify({
        status: 'duplicate',
        message: `Patch '${name}' (id=${modId}) is already in the list.`,
      });
    }

    const resolvedAuthor =
      author || snapshot.author_cache[String(modId)] || '';
    const { fileId, fileSizeBytes } = await this.resolvePrimaryFile(
      snapshot,
      modId,
    );
    const assignedLoadOrder = snapshot.next_load_order;
    snapshot.next_load_order += 1;
    const entry: SessionPatchEntry = {
      nexus_mod_id: modId,
      file_id: fileId ?? undefined,
      file_size_bytes: fileSizeBytes ?? undefined,
      name,
      author: resolvedAuthor,
      reason,
      load_order: assignedLoadOrder,
      is_patch: true,
      patches_mods: patchesMods,
    };
    snapshot.patches.push(entry);
    emit(eventCallback, 'patch_added', {
      mod_id: modId,
      name,
      patches_mods: patchesMods,
    });
    return JSON.stringify({ status: 'patch_added', name });
  }

  private async handleFlagUserKnowledge(
    snapshot: GenerationSessionSnapshot,
    eventCallback: ToolEventCallback | undefined,
    args: Record<string, unknown>,
  ): Promise<string> {
    const modA = String(args['mod_a'] ?? '');
    const modB = String(args['mod_b'] ?? '');
    const issue = String(args['issue'] ?? '');
    const severity = String(args['severity'] ?? 'warning');
    const flag: Record<string, string> = {
      mod_a: modA,
      mod_b: modB,
      issue,
      severity,
    };
    snapshot.knowledge_flags.push(flag);
    emit(eventCallback, 'knowledge_flag', flag);
    return JSON.stringify({ status: 'flagged', mod_a: modA, mod_b: modB });
  }

  private async handleFinalizeReview(
    snapshot: GenerationSessionSnapshot,
  ): Promise<string> {
    return JSON.stringify({
      status: 'review_complete',
      patches_added: snapshot.patches.length,
      flags_raised: snapshot.knowledge_flags.length,
    });
  }

  // ───────────────────────────────────────────────────────────────────
  // Shared helper — mirrors `_resolve_primary_file` in handlers.py
  // ───────────────────────────────────────────────────────────────────

  /**
   * Fetch a mod's primary file_id + size in bytes.
   * Mirrors `handlers._resolve_primary_file`. Either field may be `null` —
   * absence is fine downstream (the modlist tolerates missing file metadata).
   */
  private async resolvePrimaryFile(
    snapshot: GenerationSessionSnapshot,
    modId: number,
  ): Promise<{ fileId: number | null; fileSizeBytes: number | null }> {
    try {
      const files = await this.nexus.getModFiles(snapshot.game_domain, modId);
      if (!files || files.length === 0) {
        return { fileId: null, fileSizeBytes: null };
      }
      const primary = files.find((f) => f.primary) ?? files[0];
      return {
        fileId: coerceInt(primary.fileId),
        fileSizeBytes: coerceInt(primary.sizeInBytes),
      };
    } catch {
      return { fileId: null, fileSizeBytes: null };
    }
  }
}
