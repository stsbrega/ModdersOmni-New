/**
 * Modlist size preset — controls per-phase effective cap via multiplier.
 *
 * Faithful TS port of `backend/app/services/generation/preset.py`.
 *
 * The generation pipeline multiplies each phase's `max_mods * scale_weight`
 * by the preset's multiplier to produce the phase's *effective cap*. Once
 * that cap exceeds `PER_SUB_PASS_MAX` (see `sub-pass.ts`), the phase splits
 * into N sub-passes so each LLM turn starts with fresh context.
 *
 * Free-tier users are restricted to `small` and `medium`. `large`,
 * `massive`, and `ultimate` require a user-supplied API key (BYOK) because
 * throughput and token spend scale with effective cap.
 *
 * Python uses an `Enum` with a `requires_byok` property. TS doesn't have
 * enum properties, so we expose `presetRequiresByok()` instead. The string
 * values match Python's `SizePreset(str, Enum)` lowercase values, and align
 * with the `SizePreset` type already defined in
 * `frontend/src/app/shared/models/generation.model.ts`.
 */

import type { SizePreset } from '../../../shared/models/generation.model';

/**
 * Preset → multiplier. Verbatim from `_MULTIPLIERS` in preset.py.
 *
 * Note: these values were calibrated empirically; do NOT round them.
 * The plan's sketch (2.0/4.0/8.0) is wrong — Python is the source of truth.
 */
export const PRESET_MULTIPLIERS: Record<SizePreset, number> = {
  small: 0.5,
  medium: 1.0,
  large: 3.3,
  massive: 6.7,
  ultimate: 13.3,
};

/**
 * Approximate total mod count target per preset (empirical calibration).
 * Verbatim from `_TARGETS` in preset.py.
 */
export const PRESET_TARGETS: Record<SizePreset, number> = {
  small: 75,
  medium: 150,
  large: 500,
  massive: 1000,
  ultimate: 2000,
};

const _BYOK_PRESETS: ReadonlySet<SizePreset> = new Set<SizePreset>([
  'large',
  'massive',
  'ultimate',
]);

/** Mirrors `preset_multiplier(preset)` in preset.py. */
export function presetMultiplier(preset: SizePreset): number {
  return PRESET_MULTIPLIERS[preset];
}

/** Mirrors `preset_target(preset)` in preset.py. */
export function presetTarget(preset: SizePreset): number {
  return PRESET_TARGETS[preset];
}

/** Mirrors the `SizePreset.requires_byok` enum property in preset.py. */
export function presetRequiresByok(preset: SizePreset): boolean {
  return _BYOK_PRESETS.has(preset);
}
