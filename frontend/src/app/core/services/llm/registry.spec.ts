import { PROVIDERS, defaultModelFor, ProviderMeta } from './registry';
import { ProviderId } from './types';

describe('LLM registry', () => {
  it('exposes exactly the 6 supported providers', () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(
      ['anthropic', 'gemini', 'groq', 'ollama', 'openai', 'openrouter'].sort(),
    );
  });

  it('every provider has a defaultModel', () => {
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
      expect(defaultModelFor(id)).toBeTruthy();
    }
  });

  it('every provider has a non-empty models list including its defaultModel', () => {
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
      const meta: ProviderMeta = PROVIDERS[id];
      expect(meta.models.length).toBeGreaterThan(0);
      expect(meta.models).toContain(meta.defaultModel);
    }
  });

  it('every provider declares an apiKeyHint', () => {
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
      expect(PROVIDERS[id].apiKeyHint).toBeTruthy();
    }
  });

  it('every provider declares a requiresKey flag (boolean)', () => {
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
      expect(typeof PROVIDERS[id].requiresKey).toBe('boolean');
    }
  });

  it('only ollama is keyless', () => {
    for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
      const expected = id === 'ollama' ? false : true;
      expect(PROVIDERS[id].requiresKey).toBe(expected);
    }
  });

  it('anthropic default model is a Claude 4 family ID', () => {
    expect(defaultModelFor('anthropic')).toMatch(/claude-(opus|sonnet|haiku)-4/);
  });
});
