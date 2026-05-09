/**
 * Real-time generation streaming models.
 *
 * These types map to the SSE events emitted by the backend
 * GenerationManager and consumed by the GenerationComponent.
 */

// ── Event type union ──

export type GenerationEventType =
  | 'providers_ready'
  | 'phase_start'
  | 'searching'
  | 'search_results'
  | 'reading_mod'
  | 'mod_added'
  | 'patch_added'
  | 'knowledge_flag'
  | 'phase_complete'
  | 'thinking'
  | 'complete'
  | 'error'
  | 'retrying'
  | 'provider_error'
  | 'provider_switch'
  | 'paused'
  | 'resumed'
  | 'size_update'
  | 'sweep_start'
  | 'sweep_complete'
  | 'missing_requested_mod';

// ── Event payloads ──

export interface ProviderInfo {
  provider_id: string;
  name: string;
  model: string;
}

export interface ProvidersReadyEvent {
  type: 'providers_ready';
  providers: ProviderInfo[];
  count: number;
  timestamp?: number;
}

export interface PhaseStartEvent {
  type: 'phase_start';
  phase: string;
  number: number;
  total_phases: number;
  is_patch_phase?: boolean;
  provider?: string;
  timestamp?: number;
}

export interface SearchingEvent {
  type: 'searching';
  query: string;
  timestamp?: number;
}

export interface SearchResultsEvent {
  type: 'search_results';
  count: number;
  sample_names: string[];
  timestamp?: number;
}

export interface ReadingModEvent {
  type: 'reading_mod';
  mod_id: number;
  name?: string;
  timestamp?: number;
}

export interface ModAddedEvent {
  type: 'mod_added';
  mod_id: number;
  name: string;
  reason: string;
  load_order: number;
  timestamp?: number;
}

export interface PatchAddedEvent {
  type: 'patch_added';
  mod_id: number;
  name: string;
  patches_mods: string[];
  timestamp?: number;
}

export interface KnowledgeFlagEvent {
  type: 'knowledge_flag';
  mod_a: string;
  mod_b: string;
  issue: string;
  severity: 'warning' | 'critical';
  timestamp?: number;
}

export interface PhaseCompleteEvent {
  type: 'phase_complete';
  phase: string;
  number: number;
  mod_count: number;
  patch_count?: number;
  provider?: string;
  timestamp?: number;
}

export interface ThinkingEvent {
  type: 'thinking';
  text: string;
  timestamp?: number;
}

export interface CompleteEvent {
  type: 'complete';
  modlist_id: string;
  timestamp?: number;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  timestamp?: number;
}

export interface RetryingEvent {
  type: 'retrying';
  reason: string;
  wait_seconds: number;
  attempt: number;
  max_attempts: number;
  timestamp?: number;
}

export interface ProviderErrorEvent {
  type: 'provider_error';
  provider: string;
  error_type: string;
  message: string;
  timestamp?: number;
}

export interface ProviderSwitchEvent {
  type: 'provider_switch';
  from_provider: string;
  to_provider: string;
  timestamp?: number;
}

export interface ProviderError {
  provider: string;
  type: string;
  message?: string;
}

export interface PausedEvent {
  type: 'paused';
  reason: string;
  phase_name: string;
  phase_number: number;
  mods_so_far: number;
  can_resume: boolean;
  provider_errors?: ProviderError[];
  timestamp?: number;
}

export interface ResumedEvent {
  type: 'resumed';
  phase_name: string;
  phase_number: number;
  timestamp?: number;
}

export interface SizeUpdateEvent {
  type: 'size_update';
  total_bytes: number;
  mod_count: number;
  timestamp?: number;
}

// Post-phase sweep that re-queries any requested_mods the main loop missed.
export interface SweepStartEvent {
  type: 'sweep_start';
  missing_count: number;
  missing_mods: string[];
  timestamp?: number;
}

export interface SweepCompleteEvent {
  type: 'sweep_complete';
  still_missing_count: number;
  still_missing: string[];
  added_by_sweep: string[];
  timestamp?: number;
}

// Emitted per name for any requested mod the sweep also couldn't find.
// The mod literally couldn't be located on Nexus under the user's wording.
export interface MissingRequestedModEvent {
  type: 'missing_requested_mod';
  name: string;
  timestamp?: number;
}

// ── Union type for all events ──

export type GenerationEvent =
  | ProvidersReadyEvent
  | PhaseStartEvent
  | SearchingEvent
  | SearchResultsEvent
  | ReadingModEvent
  | ModAddedEvent
  | PatchAddedEvent
  | KnowledgeFlagEvent
  | PhaseCompleteEvent
  | ThinkingEvent
  | CompleteEvent
  | ErrorEvent
  | RetryingEvent
  | ProviderErrorEvent
  | ProviderSwitchEvent
  | PausedEvent
  | ResumedEvent
  | SizeUpdateEvent
  | SweepStartEvent
  | SweepCompleteEvent
  | MissingRequestedModEvent;

// ── Size presets (modlist size picker) ──

export type SizePreset = 'small' | 'medium' | 'large' | 'massive' | 'ultimate';

export interface PresetDescriptor {
  id: SizePreset;
  label: string;
  targetMods: number;
  requiresByok: boolean;
  blurb: string;
}

export const PRESETS: PresetDescriptor[] = [
  { id: 'small',    label: 'Small',    targetMods: 75,   requiresByok: false, blurb: 'Quick and lean — around 75 mods.' },
  { id: 'medium',   label: 'Medium',   targetMods: 150,  requiresByok: false, blurb: 'Balanced — around 150 mods.' },
  { id: 'large',    label: 'Large',    targetMods: 500,  requiresByok: true,  blurb: 'Ambitious — ~500 mods. Requires your own LLM API key.' },
  { id: 'massive',  label: 'Massive',  targetMods: 1000, requiresByok: true,  blurb: 'Heavyweight — ~1000 mods. Requires BYOK.' },
  { id: 'ultimate', label: 'Ultimate', targetMods: 2000, requiresByok: true,  blurb: 'Wabbajack-scale — ~2000 mods. Requires BYOK.' },
];

// ── API response types ──

export interface GenerationStartResponse {
  generation_id: string;
}

export interface GenerationStatusResponse {
  status: 'running' | 'complete' | 'error' | 'paused';
  generation_id: string;
  modlist_id?: string;
  event_count: number;
  paused_at_phase?: number;
  pause_reason?: string;
  phase_index?: number;
  total_phases?: number;
  elapsed_seconds?: number;
}
