import { detectProvider } from './key-detection';
import { LlmProvider } from '../../shared/models/mod.model';
import { LLM_PROVIDERS } from '../services/llm/providers-meta';

function provider(id: string, key_prefixes: string[]): LlmProvider {
  return { id, name: id.toUpperCase(), model: 'm', placeholder: '', hint_url: '', key_prefixes };
}

describe('detectProvider', () => {
  it('returns null for empty or whitespace-only keys', () => {
    expect(detectProvider('', LLM_PROVIDERS)).toBeNull();
    expect(detectProvider('   ', LLM_PROVIDERS)).toBeNull();
  });

  it('returns null when no prefix matches', () => {
    expect(detectProvider('not-a-key', LLM_PROVIDERS)).toBeNull();
  });

  it('trims surrounding whitespace before matching', () => {
    expect(detectProvider('  gsk_abc123\n', LLM_PROVIDERS)?.providerId).toBe('groq');
  });

  it('prefers the longest prefix (sk-ant- beats sk-)', () => {
    const result = detectProvider('sk-ant-api03-xyz', LLM_PROVIDERS);
    expect(result?.providerId).toBe('anthropic');
    expect(result?.confidence).toBe('exact');
  });

  it('identifies each real browser-direct provider from its key shape', () => {
    const cases: [string, string][] = [
      ['sk-proj-abc', 'openai'],
      ['sk-abc', 'openai'],
      ['AIzaSyExample', 'gemini'],
      ['gsk_abc', 'groq'],
      ['sk-or-v1-abc', 'openrouter'],
    ];
    for (const [key, id] of cases) {
      const result = detectProvider(key, LLM_PROVIDERS);
      expect(result?.providerId).withContext(key).toBe(id);
      expect(result?.confidence).withContext(key).toBe('exact');
    }
  });

  it('never matches keyless providers such as ollama', () => {
    const ids = LLM_PROVIDERS.flatMap((p) => p.key_prefixes.length === 0 ? [p.id] : []);
    expect(ids).toContain('ollama');
    expect(detectProvider('anything', LLM_PROVIDERS)?.providerId).not.toBe('ollama');
  });

  it('marks a shared longest prefix as ambiguous and lists every match once', () => {
    const providers = [provider('a', ['xx-', 'xx-long-']), provider('b', ['xx-']), provider('c', ['xx-'])];
    const result = detectProvider('xx-123', providers);
    expect(result?.confidence).toBe('ambiguous');
    expect(result?.matchedProviders.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('does not report a provider twice when it matches via several prefixes of one length', () => {
    const providers = [provider('a', ['zz-', 'zz-'])];
    expect(detectProvider('zz-1', providers)?.matchedProviders.length).toBe(1);
  });
});
