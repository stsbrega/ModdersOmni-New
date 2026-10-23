import { LlmProvider } from '../../shared/models/mod.model';
import { detectProvider } from './key-detection';

function provider(id: string, name: string, key_prefixes: string[]): LlmProvider {
  return { id, name, key_prefixes } as LlmProvider;
}

describe('detectProvider', () => {
  const providers = [
    provider('anthropic', 'Anthropic', ['sk-ant-']),
    provider('openai', 'OpenAI', ['sk-']),
    provider('other', 'Other', ['sk-']),
    provider('gemini', 'Gemini', ['AIza']),
    provider('ollama', 'Ollama', []),
  ];

  it('returns null for empty or whitespace-only keys', () => {
    expect(detectProvider('', providers)).toBeNull();
    expect(detectProvider('   ', providers)).toBeNull();
  });

  it('returns null when no prefix matches', () => {
    expect(detectProvider('zzz-123', providers)).toBeNull();
  });

  it('prefers the longest matching prefix as an exact match', () => {
    const result = detectProvider('sk-ant-abc123', providers);
    expect(result?.providerId).toBe('anthropic');
    expect(result?.confidence).toBe('exact');
  });

  it('marks keys as ambiguous when providers share the longest prefix', () => {
    const result = detectProvider('sk-abc123', providers);
    expect(result?.confidence).toBe('ambiguous');
    expect(result?.matchedProviders.map((m) => m.id)).toEqual(['openai', 'other']);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(detectProvider('  AIzaXYZ  ', providers)?.providerId).toBe('gemini');
  });

  it('does not duplicate a provider listing the same prefix twice', () => {
    const dup = [provider('a', 'A', ['sk-', 'sk-'])];
    const result = detectProvider('sk-1', dup);
    expect(result?.confidence).toBe('exact');
    expect(result?.matchedProviders.length).toBe(1);
  });
});
