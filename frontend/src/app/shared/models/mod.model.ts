export interface ModEntry {
  mod_id?: number;
  nexus_mod_id?: number;
  name: string;
  author?: string;
  summary?: string;
  reason?: string;
  load_order?: number;
  is_patch?: boolean;
  patches_mods?: string[];
  compatibility_notes?: string;
  /** Nexus primary file id — required by the MO2 import plugin. */
  file_id?: number;
  file_size_bytes?: number;
}

export interface UserKnowledgeFlag {
  mod_a: string;
  mod_b: string;
  issue: string;
  severity: string; // "warning" | "critical"
}

export interface Modlist {
  id: string;
  game_id: number;
  game_version?: string;  // "SE" | "AE" | "Standard" | "Next-Gen"
  game_domain?: string;
  playstyle_id?: number;
  entries: ModEntry[];
  llm_provider?: string;
  user_knowledge_flags?: UserKnowledgeFlag[];
  used_fallback?: boolean;
  generation_error?: string;
  has_debug_log?: boolean;
  created_at?: string;
}

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

export interface LlmProvider {
  id: string;
  name: string;
  model: string;
  placeholder: string;
  hint_url: string;
  key_prefixes: string[];
  context_window?: number;
  keyless?: boolean;
}

export interface SizeSummary {
  download_bytes: number;
  installed_estimate_bytes: number;
  sized_count: number;
  unsized_count: number;
  total_count: number;
  largest_drive_free_bytes: number | null;
  fit_status: 'comfortable' | 'tight' | 'insufficient' | 'unknown';
}
