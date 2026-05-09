/**
 * Browser-direct LLM provider registry — pruned to the 6 providers that
 * work without a backend proxy (per spec Decision 4 for v2.0).
 *
 * The Python original (backend/app/llm/registry.py) supported 14 providers;
 * the dropped 8 (Together, DeepSeek, Mistral, Cerebras, Qwen, Ollama Cloud,
 * Groq Scout, Gemini Pro) either failed CORS preflight from the browser or
 * didn't fit the BYOK model. They will return only if they ship a CORS-
 * friendly endpoint and the user explicitly opts in.
 *
 * Model IDs reflect the latest published versions as of May 2026. The
 * `defaultModel` is the recommended starting point; `models` is the
 * dropdown the user picks from.
 */
import { ProviderId } from './types';

export interface ProviderMeta {
  /** Human-readable name shown in the UI. */
  displayName: string;
  /** The model used when the user hasn't picked one yet. */
  defaultModel: string;
  /** All models surfaced in the model picker. */
  models: string[];
  /** Placeholder shown in the API key input — e.g., "sk-ant-...". */
  apiKeyHint: string;
  /** Where the user goes to obtain a key. */
  apiKeyUrl?: string;
  /** False only for Ollama (local, keyless). */
  requiresKey: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  anthropic: {
    displayName: 'Anthropic',
    defaultModel: 'claude-sonnet-4-5',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    apiKeyHint: 'sk-ant-...',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    requiresKey: true,
  },
  openai: {
    displayName: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'],
    apiKeyHint: 'sk-...',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    requiresKey: true,
  },
  gemini: {
    displayName: 'Google Gemini',
    defaultModel: 'gemini-2.5-pro',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    apiKeyHint: 'AIza...',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    requiresKey: true,
  },
  groq: {
    displayName: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'mixtral-8x7b-32768',
    ],
    apiKeyHint: 'gsk_...',
    apiKeyUrl: 'https://console.groq.com/keys',
    requiresKey: true,
  },
  openrouter: {
    displayName: 'OpenRouter',
    defaultModel: 'anthropic/claude-sonnet-4',
    models: [
      'anthropic/claude-opus-4',
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    apiKeyHint: 'sk-or-v1-...',
    apiKeyUrl: 'https://openrouter.ai/keys',
    requiresKey: true,
  },
  ollama: {
    displayName: 'Ollama (Local)',
    defaultModel: 'llama3.3',
    models: ['llama3.3', 'qwen2.5:32b', 'gemma3:27b', 'deepseek-r1'],
    apiKeyHint: '(no key required)',
    requiresKey: false,
  },
};

/** Convenience: the default model for a given provider. */
export function defaultModelFor(provider: ProviderId): string {
  return PROVIDERS[provider].defaultModel;
}
