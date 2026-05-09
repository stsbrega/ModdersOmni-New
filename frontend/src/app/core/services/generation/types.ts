/**
 * Generation pipeline types.
 *
 * Re-exports shared types (`SizePreset`, `GenerationEvent`, `Game`, `Playstyle`,
 * `ModEntry`, `Modlist`, `UserKnowledgeFlag`, `HardwareSpecs`) from
 * `shared/models/`, and adds the generation-specific shapes that don't already
 * exist there:
 *
 *   - `BuildPhase` — matches `frontend/public/data/build-phases.{game}.json`
 *     (snake_case fields, mirrors `backend/app/models/mod_build_phase.py`).
 *   - `KnowledgeFlag` / `ReviewFlag` — flag dicts the Python session carries
 *     verbatim; left as `Record<string, unknown>` since shape varies per source.
 *   - `SessionModEntry` — a session-local mod entry that EXTENDS `ModEntry`
 *     with the runtime-only fields the backend's session.modlist dicts carry
 *     (`phase_id`, `author`, `nexus_mod_id` (required, not optional here)).
 *   - `SessionPatchEntry` — same, for compatibility patches.
 *   - `GenerationSessionSnapshot` — the SERIALIZABLE shape produced by
 *     Python's `GenerationSession.to_snapshot()`. The TS port stores this
 *     directly in localStorage (no live `NexusModsClient` reference).
 *   - `GenerationStatus` — pipeline run lifecycle for the localStorage helpers.
 *   - `StoredSession` — what we actually persist: the snapshot plus run
 *     metadata (id, status, timestamps, game slug, llm config).
 *
 * Plan 1 Task 10. Python source of truth:
 *   `backend/app/services/generation/session.py` (snapshot keys),
 *   `backend/app/services/generation/preset.py` (SizePreset values).
 */

import type { LLMConfig } from '../llm/types';
import type { GameSlug, GameVersion } from '../knowledge.service';

// ── Re-exports from shared/models — single source of truth ─────────────
export type {
  Game,
  Playstyle,
} from '../../../shared/models/game.model';

export type {
  ModEntry,
  Modlist,
  UserKnowledgeFlag,
} from '../../../shared/models/mod.model';

export type { HardwareSpecs } from '../../../shared/models/specs.model';

export type {
  SizePreset,
  GenerationEvent,
  GenerationEventType,
  PresetDescriptor,
} from '../../../shared/models/generation.model';
export { PRESETS } from '../../../shared/models/generation.model';

// ── Generation-specific types ──────────────────────────────────────────

/**
 * Build phase definition. Mirrors the JSON in
 * `frontend/public/data/build-phases.{skyrim,fallout4}.json`, which itself
 * mirrors `backend/app/models/mod_build_phase.py`. Snake_case is preserved
 * because the JSON files are loaded as-is and threaded through prompts that
 * use these exact field names.
 */
export interface BuildPhase {
  phase_number: number;
  name: string;
  description: string;
  search_guidance: string;
  rules: string;
  example_mods: string;
  is_playstyle_driven: boolean;
  max_mods: number;
  scale_weight: number;
  /** Optional per-sub-pass guidance hints (one entry per sub-pass). */
  sub_pass_guidance?: string[];
}

/**
 * Compact dict shape used inside `GenerationSession.modlist`. Each tool-call
 * `add_to_modlist` push produces one of these. Mirrors the Python session
 * dicts, which Python types only loosely as `list[dict]`. Required keys
 * here are the ones every code path reads.
 */
export interface SessionModEntry {
  nexus_mod_id: number;
  name: string;
  reason?: string;
  load_order?: number;
  author?: string;
  /** Phase number that added this mod — used by `entries_for_phase()`. */
  phase_id?: number;
  /** Optional file size for the size summary. */
  file_size_bytes?: number;
  /** Allow extra fields the LLM passes through (notes, urls, etc.). */
  [key: string]: unknown;
}

/** Compatibility patch entry; same shape contract as `SessionModEntry`. */
export interface SessionPatchEntry extends SessionModEntry {
  patches_mods?: string[];
}

/** Knowledge / review flag dicts — shape varies by source. */
export type KnowledgeFlag = Record<string, unknown>;
export type ReviewFlag = Record<string, unknown>;

/**
 * Serializable snapshot of a `GenerationSession`. Direct TS analog of
 * `GenerationSession.to_snapshot()` in `backend/app/services/generation/session.py`.
 *
 * Sets become arrays. Numeric-keyed dicts become `Record<string, ...>` because
 * Python's snapshot stringifies the keys (and JSON has no integer keys).
 */
export interface GenerationSessionSnapshot {
  game_domain: string;
  modlist: SessionModEntry[];
  patches: SessionPatchEntry[];
  knowledge_flags: KnowledgeFlag[];
  review_flags: ReviewFlag[];
  description_cache: Record<string, string>;
  author_cache: Record<string, string>;
  reverse_deps_cache: Record<string, unknown[]>;
  searched_queries: string[];
  fetched_mod_ids: number[];
  completed_phases: number[];
  /** Lowercase preset value: 'small' | 'medium' | 'large' | 'massive' | 'ultimate'. */
  preset: string;
  next_load_order: number;
  requested_mods: string[];
}

/** Pipeline lifecycle status used by the localStorage session store. */
export type GenerationStatus = 'running' | 'paused' | 'completed' | 'failed';

/**
 * Persisted session record. The frontend has no DB, so the snapshot lives in
 * localStorage alongside enough metadata for the dashboard to list and resume
 * paused runs.
 */
export interface StoredSession {
  id: string;
  status: GenerationStatus;
  created_at: string;
  updated_at: string;
  game_slug: GameSlug;
  game_version?: GameVersion | null;
  preset: string;
  /** Index of the next phase to run; resume picks up here. */
  current_phase_index: number;
  /** Human-readable last pause / failure reason, if any. */
  last_message?: string;
  /** Snapshot of the live `GenerationSession` mutable state. */
  snapshot: GenerationSessionSnapshot;
  /** LLM dispatch config — same one used to launch the run. */
  llm_config?: LLMConfig;
  /** Optional second model used by the per-phase reviewer/overseer. */
  overseer_config?: LLMConfig;
}
