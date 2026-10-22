import { detectProvider } from './key-detection';
import { LLM_PROVIDERS } from '../services/llm/providers-meta';
import { LlmProvider } from '../../shared/models/mod.model';

describe('detectProvider', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(detectProvider('', LLM_PROVIDERS)).toBeNull();
    expect(detectProvider('   ', LLM_PROVIDERS)).toBeNull();
  });

  it('returns null when no prefix matches', () => {
    expect(detectProvider('not-a-real-key', LLM_PROVIDERS)).toBeNull();
  });

  it('identifies Anthropic keys over the shorter sk- prefix', () => {
    const result = detectProvider('sk-ant-api03-abc', LLM_PROVIDERS);
    expect(result?.providerId).toBe('anthropic');
    expect(result?.confidence).toBe('exact');
  });

  it('identifies OpenRouter keys over the shorter sk- prefix', () => {
    expect(detectProvider('sk-or-v1-abc', LLM_PROVIDERS)?.providerId).toBe('openrouter');
  });

  it('identifies OpenAI project and legacy keys', () => {
    expect(detectProvider('sk-proj-abc', LLM_PROVIDERS)?.providerId).toBe('openai');
    expect(detectProvider('sk-abc', LLM_PROVIDERS)?.providerId).toBe('openai');
  });

  it('identifies Gemini and Groq keys', () => {
    expect(detectProvider('AIzaSyABC', LLM_PROVIDERS)?.providerId).toBe('gemini');
    expect(detectProvider('gsk_abc', LLM_PROVIDERS)?.providerId).toBe('groq');
  });

  it('trims surrounding whitespace before matching', () => {
    expect(detectProvider('  gsk_abc\n', LLM_PROVIDERS)?.providerId).toBe('groq');
  });

  it('marks keys as ambiguous when providers share the longest prefix', () => {
    const providers = [
      { id: 'a', name: 'A', key_prefixes: ['sk-'] },
      { id: 'b', name: 'B', key_prefixes: ['sk-'] },
    ] as LlmProvider[];
    const result = detectProvider('sk-xyz', providers);
    expect(result?.confidence).toBe('ambiguous');
    expect(result?.matchedProviders.map((m) => m.id)).toEqual(['a', 'b']);
  });
});
