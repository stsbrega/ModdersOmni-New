"""Tests for the SizePreset enum and multiplier resolution."""

import pytest

from app.services.generation.preset import SizePreset, preset_multiplier, preset_target


@pytest.mark.parametrize(
    "preset,expected_mult",
    [
        (SizePreset.SMALL,    0.5),
        (SizePreset.MEDIUM,   1.0),
        (SizePreset.LARGE,    3.3),
        (SizePreset.MASSIVE,  6.7),
        (SizePreset.ULTIMATE, 13.3),
    ],
)
def test_preset_multiplier(preset: SizePreset, expected_mult: float):
    assert preset_multiplier(preset) == pytest.approx(expected_mult)


@pytest.mark.parametrize(
    "preset,expected_target",
    [
        (SizePreset.SMALL,    75),
        (SizePreset.MEDIUM,   150),
        (SizePreset.LARGE,    500),
        (SizePreset.MASSIVE,  1000),
        (SizePreset.ULTIMATE, 2000),
    ],
)
def test_preset_target(preset: SizePreset, expected_target: int):
    assert preset_target(preset) == expected_target


def test_requires_byok():
    assert SizePreset.SMALL.requires_byok is False
    assert SizePreset.MEDIUM.requires_byok is False
    assert SizePreset.LARGE.requires_byok is True
    assert SizePreset.MASSIVE.requires_byok is True
    assert SizePreset.ULTIMATE.requires_byok is True
