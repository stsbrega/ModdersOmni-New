"""Modlist size preset — controls per-phase effective cap via multiplier.

The generation pipeline multiplies each phase's `max_mods * scale_weight` by
the preset's multiplier to produce the phase's *effective cap*. Once that cap
exceeds `PER_SUB_PASS_MAX` (see `sub_pass.py`), the phase splits into N
sub-passes so each LLM turn starts with fresh context.

Free-tier users are restricted to SMALL and MEDIUM. LARGE/MASSIVE/ULTIMATE
require a user-supplied API key (BYOK) because throughput and token spend
scale with effective cap.
"""

from enum import Enum


class SizePreset(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    MASSIVE = "massive"
    ULTIMATE = "ultimate"

    @property
    def requires_byok(self) -> bool:
        return self in (SizePreset.LARGE, SizePreset.MASSIVE, SizePreset.ULTIMATE)


_MULTIPLIERS: dict[SizePreset, float] = {
    SizePreset.SMALL:    0.5,
    SizePreset.MEDIUM:   1.0,
    SizePreset.LARGE:    3.3,
    SizePreset.MASSIVE:  6.7,
    SizePreset.ULTIMATE: 13.3,
}

_TARGETS: dict[SizePreset, int] = {
    SizePreset.SMALL:    75,
    SizePreset.MEDIUM:   150,
    SizePreset.LARGE:    500,
    SizePreset.MASSIVE:  1000,
    SizePreset.ULTIMATE: 2000,
}


def preset_multiplier(preset: SizePreset) -> float:
    return _MULTIPLIERS[preset]


def preset_target(preset: SizePreset) -> int:
    """Approximate total mod count target for this preset (empirical calibration)."""
    return _TARGETS[preset]
