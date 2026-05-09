"""Sub-pass planning for large phases.

When a phase's effective cap exceeds PER_SUB_PASS_MAX, split the phase into
N sub-passes so each LLM turn starts with fresh context (plus a compact
"already added in this phase" summary). Keeping context tight per turn is
important for quality: once the in-context mod list grows past ~25 items,
the model starts repeating selections and losing focus on the sub-theme.
"""

import math
from dataclasses import dataclass


PER_SUB_PASS_MAX = 25


@dataclass(frozen=True)
class SubPassPlan:
    effective_cap: int
    sub_pass_count: int
    per_sub_pass_cap: int


def plan_sub_passes(
    *,
    phase_max_mods: int,
    phase_scale_weight: float,
    preset_multiplier: float,
) -> SubPassPlan:
    """Compute how many sub-passes a phase needs and the per-pass cap.

    Formula:
      effective_cap = round(phase_max_mods * phase_scale_weight * preset_multiplier)
      sub_pass_count = ceil(effective_cap / PER_SUB_PASS_MAX)
      per_sub_pass_cap = ceil(effective_cap / sub_pass_count)
    """
    effective_cap = round(phase_max_mods * phase_scale_weight * preset_multiplier)
    if effective_cap <= 0:
        return SubPassPlan(effective_cap=0, sub_pass_count=0, per_sub_pass_cap=0)
    sub_pass_count = max(1, math.ceil(effective_cap / PER_SUB_PASS_MAX))
    per_sub_pass_cap = math.ceil(effective_cap / sub_pass_count)
    return SubPassPlan(
        effective_cap=effective_cap,
        sub_pass_count=sub_pass_count,
        per_sub_pass_cap=per_sub_pass_cap,
    )
