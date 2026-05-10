/**
 * Static `LlmProvider[]` derived from the in-browser PROVIDERS registry.
 *
 * Replaces the `/api/settings/llm-providers` endpoint that the deleted
 * ApiService used to hit. Components import LLM_PROVIDERS where they
 * previously called `api.getLlmProviders()`.
 *
 * Why a separate file: the `LlmProvider` shape in `shared/models/mod.model.ts`
 * carries fields (`key_prefixes`, `placeholder`, `hint_url`) that the leaner
 * `ProviderMeta` registry doesn't have — `key_prefixes` is the load-bearing
 * one for `detectProvider()`. Keeping the prefix list here, alongside the
 * registry it shadows, makes the two easy to keep in sync.
 */

import { LlmProvider } from '../../../shared/models/mod.model';
import { PROVIDERS } from './registry';

/**
 * Known API key prefixes per provider, longest-first within each provider.
 * Mirrors what the backend's old `/llm-providers` response surfaced. Used by
 * `detectProvider()` to identify a pasted API key.
 */
const KEY_PREFIXES: Record<string, string[]> = {
  anthropic: ['sk-ant-'],
  openai: ['sk-proj-', 'sk-'],
  gemini: ['AIza'],
  groq: ['gsk_'],
  openrouter: ['sk-or-v1-', 'sk-or-'],
  // Ollama is local/keyless — no prefix can identify a user-pasted key.
  ollama: [],
};

export const LLM_PROVIDERS: LlmProvider[] = Object.entries(PROVIDERS).map(
  ([id, meta]) => ({
    id,
    name: meta.displayName,
    model: meta.defaultModel,
    placeholder: meta.apiKeyHint,
    hint_url: meta.apiKeyUrl ?? '',
    key_prefixes: KEY_PREFIXES[id] ?? [],
    keyless: !meta.requiresKey,
  }),
);
