/**
 * LLM dispatcher types — unified across all 6 supported providers.
 *
 * Faithfully mirrors the request/response shapes used by
 * backend/app/llm/provider.py (LLMProvider abstract base) but pruned
 * to the 6 providers that work directly from the browser per spec
 * Decision 4 (anthropic, openai, gemini, groq, openrouter, ollama).
 *
 * The dispatcher is a SINGLE-TURN translator: it takes one
 * `LLMRequest` and returns one `LLMResponse`. The tool-calling LOOP
 * (max_iterations, consecutive-text-only nudge, finalized early-exit,
 * on_text streaming) lives in the pipeline (Task 13) — NOT here.
 * Compare to provider.py `generate_with_tools`: that is the loop
 * runner. We only port the per-iteration translation.
 */

export type ProviderId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'ollama';

/** Per-call configuration: which provider, which model, and the credentials. */
export interface LLMConfig {
  provider: ProviderId;
  model: string;
  /** Required for everything except Ollama (which is keyless / local). */
  apiKey?: string;
  /**
   * Override the default base URL. Currently only meaningful for `ollama`
   * (defaults to `http://localhost:11434`). The OpenAI-compatible providers
   * have their base URLs baked into the dispatcher.
   */
  baseUrl?: string;
}

/**
 * Unified tool-definition shape. Each provider's adapter translates this to
 * the provider-specific spec (Anthropic `input_schema`, OpenAI
 * `{type:'function', function:{...}}`, Gemini `functionDeclarations`,
 * Ollama OpenAI-shaped).
 */
export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema describing the tool's parameters. */
  parameters: object;
}

/**
 * Unified tool-call shape returned by ALL providers.
 *
 * `arguments` is always the parsed JSON object the LLM emitted —
 * NEVER the raw string. Anthropic and Gemini hand us an object directly;
 * OpenAI/Groq/OpenRouter hand us a JSON string we parse here.
 *
 * `id` is provided by Anthropic and OpenAI/Groq/OpenRouter natively. Gemini
 * doesn't surface a stable id, so the adapter synthesizes one (`gemini-<idx>`).
 * Ollama exposes ids inconsistently, so the adapter falls back the same way.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Unified message shape. Maps roughly to OpenAI Chat Completions but is
 * provider-agnostic. The dispatcher's per-provider adapter does the
 * translation:
 *
 * - Anthropic: `system` is extracted to a top-level `system` param.
 *   `tool` results become a `user` message with `tool_result` content blocks.
 * - OpenAI/Groq/OpenRouter: forwarded as-is (after wrapping toolCalls into
 *   `tool_calls`).
 * - Gemini: roles are remapped (`assistant` → `model`, `tool` → `function`),
 *   `system` becomes `systemInstruction`.
 * - Ollama: forwarded as-is to the OpenAI-shaped `/api/chat` endpoint.
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Required when role is 'tool' — links the result to the originating call. */
  toolCallId?: string;
  /** Set on assistant messages that requested tool calls. */
  toolCalls?: ToolCall[];
}

export interface LLMRequest {
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  /** Defaults to 0.3 (matches provider.py). */
  temperature?: number;
  /** Defaults to 4096 (matches Anthropic provider.py). */
  maxTokens?: number;
}

export interface LLMResponse {
  /** Concatenated text content from the assistant. Empty string if none. */
  content: string;
  /** Empty array if the assistant did not request any tools. */
  toolCalls: ToolCall[];
  /**
   * Why generation stopped:
   *   - `stop`     — natural end-of-turn
   *   - `tool_use` — assistant wants to call tool(s); see `toolCalls`
   *   - `length`   — hit max_tokens
   *   - `error`    — translation/parsing failure (rare; SDK errors throw)
   */
  finishReason: 'stop' | 'tool_use' | 'length' | 'error';
  usage?: { inputTokens: number; outputTokens: number };
}
