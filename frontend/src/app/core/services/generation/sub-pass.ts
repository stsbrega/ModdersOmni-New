/**
 * Sub-pass planning for large phases.
 *
 * Faithful TS port of `backend/app/services/generation/sub_pass.py`.
 *
 * When a phase's effective cap exceeds `PER_SUB_PASS_MAX`, the pipeline
 * splits the phase into N sub-passes so each LLM turn starts with fresh
 * context (plus a compact "already added in this phase" summary). Keeping
 * context tight per turn is important for quality: once the in-context mod
 * list grows past ~25 items the model starts repeating selections and
 * losing focus on the sub-theme.
 *
 * The plan's sketch returned a `SubPassPlan[]` and described draining caps
 * (e.g. 25, 25, 10). Python returns a SINGLE `SubPassPlan` with a UNIFORM
 * per-sub-pass cap (`ceil(effective_cap / sub_pass_count)`). The pipeline
 * iterates `sub_pass_count` times itself, applying the same per-pass cap.
 */

export const PER_SUB_PASS_MAX = 25;

/**
 * Output of `planSubPasses` — mirrors Python's frozen dataclass.
 *
 *   effective_cap     — round(phaseMaxMods * phaseScaleWeight * presetMultiplier)
 *   sub_pass_count    — ceil(effective_cap / PER_SUB_PASS_MAX) (min 1 when cap > 0)
 *   per_sub_pass_cap  — ceil(effective_cap / sub_pass_count)
 */
export interface SubPassPlan {
  readonly effective_cap: number;
  readonly sub_pass_count: number;
  readonly per_sub_pass_cap: number;
}

interface PlanSubPassesArgs {
  phaseMaxMods: number;
  phaseScaleWeight: number;
  presetMultiplier: number;
}

/**
 * Compute how many sub-passes a phase needs and the per-pass cap.
 *
 * Mirrors Python's `plan_sub_passes()` keyword-only signature. Use the same
 * formula:
 *
 *   effective_cap   = round(phase_max_mods * phase_scale_weight * preset_multiplier)
 *   sub_pass_count  = max(1, ceil(effective_cap / PER_SUB_PASS_MAX))
 *   per_sub_pass_cap = ceil(effective_cap / sub_pass_count)
 *
 * When `effective_cap <= 0` returns a zeroed plan (no work to do).
 */
export function planSubPasses(args: PlanSubPassesArgs): SubPassPlan {
  const { phaseMaxMods, phaseScaleWeight, presetMultiplier } = args;
  const effectiveCap = Math.round(
    phaseMaxMods * phaseScaleWeight * presetMultiplier,
  );
  if (effectiveCap <= 0) {
    return { effective_cap: 0, sub_pass_count: 0, per_sub_pass_cap: 0 };
  }
  const subPassCount = Math.max(1, Math.ceil(effectiveCap / PER_SUB_PASS_MAX));
  const perSubPassCap = Math.ceil(effectiveCap / subPassCount);
  return {
    effective_cap: effectiveCap,
    sub_pass_count: subPassCount,
    per_sub_pass_cap: perSubPassCap,
  };
}
