import { PRESETS } from './generation.model';
import { presetRequiresByok, presetTarget } from '../../core/services/generation/preset';

describe('PRESETS (UI descriptors)', () => {
  it('lists the five presets in ascending size order', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['small', 'medium', 'large', 'massive', 'ultimate']);
    const targets = PRESETS.map((p) => p.targetMods);
    expect(targets).toEqual([...targets].sort((a, b) => a - b));
  });

  it('targetMods matches the pipeline PRESET_TARGETS', () => {
    for (const p of PRESETS) {
      expect(p.targetMods).toBe(presetTarget(p.id));
    }
  });

  it('requiresByok matches the pipeline presetRequiresByok', () => {
    for (const p of PRESETS) {
      expect(p.requiresByok).toBe(presetRequiresByok(p.id));
    }
  });

  it('every preset has a label and blurb', () => {
    for (const p of PRESETS) {
      expect(p.label).toBeTruthy();
      expect(p.blurb).toBeTruthy();
    }
  });
});
