/**
 * Tests for sub-pass.ts.
 *
 * Source of truth: `backend/app/services/generation/sub_pass.py`
 *
 * The plan's sketch returned a `SubPassPlan[]` and described per-pass caps
 * draining sequentially (25, 25, 10). Python returns a SINGLE `SubPassPlan`
 * dataclass with `effective_cap`, `sub_pass_count`, and `per_sub_pass_cap`,
 * where `per_sub_pass_cap = ceil(effective_cap / sub_pass_count)` — uniform
 * (rounded up), not draining. Tests below mirror Python's actual behavior.
 */

import { planSubPasses, PER_SUB_PASS_MAX } from './sub-pass';

describe('sub-pass', () => {
  it('PER_SUB_PASS_MAX is 25 (matches sub_pass.py)', () => {
    expect(PER_SUB_PASS_MAX).toBe(25);
  });

  it('returns zeroed plan when effective cap rounds to 0', () => {
    const plan = planSubPasses({
      phaseMaxMods: 0,
      phaseScaleWeight: 1.0,
      presetMultiplier: 1.0,
    });
    expect(plan).toEqual({
      effective_cap: 0,
      sub_pass_count: 0,
      per_sub_pass_cap: 0,
    });
  });

  it('cap of 20 returns single pass (cap <= PER_SUB_PASS_MAX)', () => {
    // 10 * 2.0 * 1.0 = 20
    const plan = planSubPasses({
      phaseMaxMods: 10,
      phaseScaleWeight: 2.0,
      presetMultiplier: 1.0,
    });
    expect(plan).toEqual({
      effective_cap: 20,
      sub_pass_count: 1,
      per_sub_pass_cap: 20,
    });
  });

  it('cap of 25 still returns single pass (boundary)', () => {
    const plan = planSubPasses({
      phaseMaxMods: 25,
      phaseScaleWeight: 1.0,
      presetMultiplier: 1.0,
    });
    expect(plan).toEqual({
      effective_cap: 25,
      sub_pass_count: 1,
      per_sub_pass_cap: 25,
    });
  });

  it('cap of 50 returns 2 passes of 25 each', () => {
    // 50 / 25 = 2 passes; ceil(50 / 2) = 25 per pass.
    const plan = planSubPasses({
      phaseMaxMods: 25,
      phaseScaleWeight: 2.0,
      presetMultiplier: 1.0,
    });
    expect(plan).toEqual({
      effective_cap: 50,
      sub_pass_count: 2,
      per_sub_pass_cap: 25,
    });
  });

  it('cap of 60 returns 3 passes of 20 each (ceil(60/3) = 20, uniform)', () => {
    // 60 / 25 = 2.4 → ceil = 3 passes; ceil(60 / 3) = 20 per pass.
    // (NOT 25, 25, 10 — Python's per-pass cap is uniform across all passes.)
    const plan = planSubPasses({
      phaseMaxMods: 30,
      phaseScaleWeight: 2.0,
      presetMultiplier: 1.0,
    });
    expect(plan).toEqual({
      effective_cap: 60,
      sub_pass_count: 3,
      per_sub_pass_cap: 20,
    });
  });

  it('rounds effective_cap (not floor): 8 * 0.5 * 1.0 = 4', () => {
    const plan = planSubPasses({
      phaseMaxMods: 8,
      phaseScaleWeight: 0.5,
      presetMultiplier: 1.0,
    });
    expect(plan.effective_cap).toBe(4);
    expect(plan.sub_pass_count).toBe(1);
    expect(plan.per_sub_pass_cap).toBe(4);
  });

  it('typical Skyrim Phase 4 textures @ MASSIVE: 40 * 3 * 6.7 ≈ 804', () => {
    const plan = planSubPasses({
      phaseMaxMods: 40,
      phaseScaleWeight: 3,
      presetMultiplier: 6.7,
    });
    // round(40 * 3 * 6.7) = round(804.0) = 804
    expect(plan.effective_cap).toBe(804);
    // ceil(804 / 25) = 33 sub-passes
    expect(plan.sub_pass_count).toBe(33);
    // ceil(804 / 33) = 25 per sub-pass
    expect(plan.per_sub_pass_cap).toBe(25);
  });
});
