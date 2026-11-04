import { LLM_PROVIDERS } from './providers-meta';
import { PROVIDERS } from './registry';

describe('LLM_PROVIDERS', () => {
  it('has one entry per registry provider', () => {
    expect(LLM_PROVIDERS.map((p) => p.id).sort()).toEqual(Object.keys(PROVIDERS).sort());
  });

  it('mirrors registry name, default model and keyless flag', () => {
    for (const p of LLM_PROVIDERS) {
      const meta = PROVIDERS[p.id as keyof typeof PROVIDERS];
      expect(p.name).toBe(meta.displayName);
      expect(p.model).toBe(meta.defaultModel);
      expect(p.keyless).toBe(!meta.requiresKey);
    }
  });

  it('every key-requiring provider declares at least one key prefix', () => {
    for (const p of LLM_PROVIDERS.filter((x) => !x.keyless)) {
      expect(p.key_prefixes.length).toBeGreaterThan(0);
    }
  });

  it('keyless providers declare no key prefixes', () => {
    for (const p of LLM_PROVIDERS.filter((x) => x.keyless)) {
      expect(p.key_prefixes).toEqual([]);
    }
  });

  it('lists longer prefixes before shorter ones they start with', () => {
    for (const p of LLM_PROVIDERS) {
      p.key_prefixes.forEach((pre, i) => {
        p.key_prefixes.slice(0, i).forEach((earlier) => {
          expect(pre.startsWith(earlier)).toBeFalse();
        });
      });
    }
  });
});
