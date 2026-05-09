"""Tests for sub-pass planning (effective cap calculation + loop count)."""

from app.services.generation.sub_pass import plan_sub_passes


def test_medium_preset_no_sub_passes_needed():
    """Medium preset with a small phase fits in a single pass."""
    plan = plan_sub_passes(
        phase_max_mods=10,
        phase_scale_weight=1.0,
        preset_multiplier=1.0,
    )
    assert plan.sub_pass_count == 1
    assert plan.effective_cap == 10


def test_large_preset_texture_phase_splits():
    """Textures phase (max=40, weight=3.0) at Large (3.3x) => ~396 / 25 => 16 sub-passes."""
    plan = plan_sub_passes(
        phase_max_mods=40,
        phase_scale_weight=3.0,
        preset_multiplier=3.3,
    )
    # 40 * 3.0 * 3.3 = 396; ceil(396/25) = 16
    assert plan.effective_cap == 396
    assert plan.sub_pass_count == 16
    assert plan.per_sub_pass_cap == 25 or plan.per_sub_pass_cap == 24  # rounding


def test_ultimate_preset_essentials_still_tiny():
    """Essentials (max=8, weight=0.1) at Ultimate (13.3x) => still small."""
    plan = plan_sub_passes(
        phase_max_mods=8,
        phase_scale_weight=0.1,
        preset_multiplier=13.3,
    )
    # 8 * 0.1 * 13.3 = 10.64 → 11 rounded; fits in 1 sub-pass
    assert plan.effective_cap == 11
    assert plan.sub_pass_count == 1


def test_edge_case_zero_cap():
    """A phase with max_mods=0 (if it existed) returns a zero-cap plan."""
    plan = plan_sub_passes(
        phase_max_mods=0,
        phase_scale_weight=1.0,
        preset_multiplier=1.0,
    )
    assert plan.effective_cap == 0
    assert plan.sub_pass_count == 0
