/**
 * Tests for preset.ts. Source of truth:
 *   `backend/app/services/generation/preset.py`
 *
 * Mirrors `_MULTIPLIERS`, `_TARGETS`, `requires_byok`, `preset_multiplier()`,
 * and `preset_target()` from the Python module.
 */

import {
  PRESET_MULTIPLIERS,
  PRESET_TARGETS,
  presetMultiplier,
  presetTarget,
  presetRequiresByok,
} from './preset';

describe('preset', () => {
  it('PRESET_MULTIPLIERS has 5 entries matching Python preset.py exactly', () => {
    // Verbatim from preset.py _MULTIPLIERS.
    expect(PRESET_MULTIPLIERS).toEqual({
      small: 0.5,
      medium: 1.0,
      large: 3.3,
      massive: 6.7,
      ultimate: 13.3,
    });
  });

  it('PRESET_TARGETS has 5 entries matching Python preset.py exactly', () => {
    expect(PRESET_TARGETS).toEqual({
      small: 75,
      medium: 150,
      large: 500,
      massive: 1000,
      ultimate: 2000,
    });
  });

  it('presetMultiplier returns the right multiplier for each preset', () => {
    expect(presetMultiplier('small')).toBe(0.5);
    expect(presetMultiplier('medium')).toBe(1.0);
    expect(presetMultiplier('large')).toBe(3.3);
    expect(presetMultiplier('massive')).toBe(6.7);
    expect(presetMultiplier('ultimate')).toBe(13.3);
  });

  it('presetTarget returns the right target for each preset', () => {
    expect(presetTarget('small')).toBe(75);
    expect(presetTarget('medium')).toBe(150);
    expect(presetTarget('large')).toBe(500);
    expect(presetTarget('massive')).toBe(1000);
    expect(presetTarget('ultimate')).toBe(2000);
  });

  it('presetRequiresByok matches Python SizePreset.requires_byok', () => {
    // Free tier: small + medium.
    expect(presetRequiresByok('small')).toBe(false);
    expect(presetRequiresByok('medium')).toBe(false);
    // BYOK tier: large + massive + ultimate.
    expect(presetRequiresByok('large')).toBe(true);
    expect(presetRequiresByok('massive')).toBe(true);
    expect(presetRequiresByok('ultimate')).toBe(true);
  });
});
