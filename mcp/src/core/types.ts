// Shared types for the ModdersOmni MCP server.

export type GameSlug = 'skyrimse' | 'fallout4';
export type GameVersion = 'SE' | 'AE' | 'Standard' | 'Next-Gen';

export interface HardwareSpecs {
  gpu?: string;
  vram_mb?: number;
  cpu?: string;
  ram_gb?: number;
  cpu_cores?: number;
  cpu_speed_ghz?: number;
  storage_drives?: string;
}

export interface TierScores {
  vram: number;
  cpu: number;
  ram: number;
  gpu_gen: number;
  overall: number;
}

export interface SpecsParseResponse {
  specs: HardwareSpecs;
  raw_text: string;
  parse_method: string;
  tier?: string;
  tier_scores?: TierScores;
}

export interface GameInfo {
  name: string;
  slug: GameSlug;
  nexus_domain: string;
  versions: string[];
}

export interface Playstyle {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}

export interface BuildPhase {
  phase_number: number;
  name: string;
  description: string;
  search_guidance: string;
  rules: string;
  example_mods?: string;
  is_playstyle_driven: boolean;
  max_mods: number;
  scale_weight: number;
}

/** One compatibility rule from compatibility.<game>.json. */
export interface CompatRule {
  mod_a: string;
  mod_b: string;
  kind: 'conflicts' | 'patch_available' | 'load_after' | 'requires' | string;
  note: string;
}

export interface ModEntry {
  nexus_mod_id: number;
  file_id?: number | null;
  file_size_bytes?: number | null;
  name: string;
  author?: string;
  summary?: string;
  reason?: string;
  phase?: number;
  load_order: number;
  is_patch?: boolean;
  patches_mods?: string[];
  compatibility_notes?: string;
  thumbnail_url?: string | null;
  /** Nexus mod ids this mod lists as hard requirements (captured on add). */
  requires?: Array<{ mod_id: number; name: string }>;
}

export interface UserKnowledgeFlag {
  mod_a: string;
  mod_b: string;
  issue: string;
  severity: 'warning' | 'critical';
}

export interface PhasePlan {
  phase_number: number;
  name: string;
  description: string;
  cap: number;
  sub_passes: number;
  status: 'pending' | 'in_progress' | 'awaiting_approval' | 'approved';
}

export interface ModlistState {
  id: string;
  name: string;
  game: GameSlug;
  game_domain: string;
  game_version: GameVersion | null;
  playstyle: string | null;
  vision: string | null;
  requested_mods: string[];
  size_preset: import('./preset.js').SizePreset;
  hardware: {
    specs: HardwareSpecs;
    tier: string;
    vram_budget_mb: number;
    storage_budget_gb: number;
    available_storage_gb: number;
  };
  phases: PhasePlan[];
  entries: ModEntry[];
  flags: UserKnowledgeFlag[];
  created_at: string;
  updated_at: string;
}

// ── Install guide (ported from the web app) ───────────────────────────
export interface GuideStep {
  title: string;
  body: string;
}
export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  steps: GuideStep[];
}
export interface InstallGuide {
  modlist_id: string;
  game_name: string;
  game_slug: string;
  game_version: string | null;
  mod_count: number;
  patch_count: number;
  version_notes: string[];
  mo2_section: GuideSection;
  vortex_section: GuideSection;
  troubleshooting: GuideStep[];
}
/** Minimal modlist shape the install guide reads. */
export interface ModlistLike {
  id: string;
  game_version?: string | null;
  entries: ModEntry[];
}
