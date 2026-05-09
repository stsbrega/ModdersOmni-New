/**
 * LLMDispatcherService — single-turn fan-out across the 6 browser-direct
 * providers. Faithful TS port of backend/app/llm/provider.py.
 *
 * Pipeline (Task 13) is responsible for the tool-calling LOOP — the
 * `is_finalized` early-exit, the consecutive-text-only nudge, the
 * `on_text` streaming callback, and `max_iterations`. This service is
 * a stateless translator: one `LLMRequest` → one HTTPS call → one
 * `LLMResponse`.
 *
 * ────────────────────────────────────────────────────────────────────
 * IMPORTANT IMPLEMENTATION NOTE
 * ────────────────────────────────────────────────────────────────────
 * The plan called for SDK-based clients (`@anthropic-ai/sdk`, `openai`,
 * `@google/genai`). They were attempted and uninstalled because:
 *   - Anthropic ships `lib/credentials/identity-token.mjs` with
 *     `await import('node:fs')`, breaking webpack's resolver.
 *   - OpenAI ships `helpers/audio.mjs` with `node:child_process`,
 *     `node:stream`, `node:process` imports.
 * Even with `dangerouslyAllowBrowser: true`, the build fails before
 * those code paths could be skipped at runtime.
 *
 * We use raw `fetch()` instead — same pattern as NexusService. The
 * wire formats are stable, well documented, and identical in shape to
 * what the SDKs send. This:
 *   - Eliminates 39 transitive deps and 29 high-severity vulns.
 *   - Keeps tests trivial (one mock surface: `httpFetch`).
 *   - Removes any risk that the production `ng build` breaks too.
 *   - Matches the v1 backend's translation logic 1:1 — see
 *     backend/app/llm/provider.py for ground truth.
 * ────────────────────────────────────────────────────────────────────
 *
 * Tool-call translation is the trickiest part. Each wire format encodes
 * a tool call differently:
 *
 *   Anthropic   — content blocks with `{type:'tool_use', id, name, input}`,
 *                 where `input` is already a parsed object.
 *   OpenAI/Groq/
 *   OpenRouter  — `tool_calls[i] = {id, function:{name, arguments}}`,
 *                 where `arguments` is a JSON STRING (we parse it).
 *   Gemini      — response parts with `{functionCall:{name, args}}`,
 *                 where `args` is already an object. Synthesizes ids.
 *   Ollama      — OpenAI-shaped, but `arguments` may be either a string OR
 *                 an object depending on the model. We handle both.
 *
 * The final `LLMResponse.toolCalls` is unified as
 * `{id: string, name: string, arguments: object}` regardless of provider.
 */
import { Injectable } from '@angular/core';
import {
  LLMConfig,
  LLMMessage,
  LLMRequest,
  LLMResponse,
  ProviderId,
  ToolCall,
} from './types';
import { PROVIDERS } from './registry';

/** Default temperature — matches provider.py (0.3). */
const DEFAULT_TEMPERATURE = 0.3;
/** Default max_tokens — matches Anthropic provider.py (4096). */
const DEFAULT_MAX_TOKENS = 4096;

/** OpenAI-compatible base URLs, baked in to mirror PROVIDER_REGISTRY. */
const OPENAI_BASE_URLS: Partial<Record<ProviderId, string>> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

/** Anthropic API endpoint (no SDK). */
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
/** Anthropic API version header — pinned to current stable. */
const ANTHROPIC_VERSION = '2023-06-01';

/** Gemini REST base — :generateContent suffix appended per call. */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Default Ollama endpoint — overridable via `LLMConfig.baseUrl`. */
const DEFAULT_OLLAMA_BASE = 'http://localhost:11434';

@Injectable({ providedIn: 'root' })
export class LLMDispatcherService {
  /**
   * Validates that the config refers to a known provider and that a key
   * is present when required. Throws synchronously — this is the cheap
   * pre-flight check the test suite asserts on.
   */
  validateConfig(cfg: LLMConfig): void {
    const meta = PROVIDERS[cfg.provider];
    if (!meta) {
      throw new Error(`Unsupported provider: ${(cfg as LLMConfig).provider}`);
    }
    if (meta.requiresKey && !cfg.apiKey) {
      throw new Error(`${meta.displayName} API key required`);
    }
  }

  /**
   * Single-turn completion. Routes to the correct adapter, which translates
   * the unified `LLMRequest` into the provider's wire format and the
   * response back into a unified `LLMResponse`.
   */
  async complete(cfg: LLMConfig, req: LLMRequest): Promise<LLMResponse> {
    this.validateConfig(cfg);
    switch (cfg.provider) {
      case 'anthropic':
        return this.callAnthropic(cfg, req);
      case 'openai':
      case 'groq':
      case 'openrouter':
        return this.callOpenAICompatible(cfg, req);
      case 'gemini':
        return this.callGemini(cfg, req);
      case 'ollama':
        return this.callOllama(cfg, req);
      default:
        // Defensive: should be unreachable due to validateConfig.
        throw new Error(`Unsupported provider: ${(cfg as LLMConfig).provider}`);
    }
  }

  /**
   * Sole network indirection — tests stub this with `spyOn` to inject
   * mock Response objects. Keeping the public dispatcher network-free
   * means no chrome instance ever has to hit a real API during karma.
   */
  protected httpFetch(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, init);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Adapter: Anthropic native Messages API
  // ─────────────────────────────────────────────────────────────────────

  private async callAnthropic(
    cfg: LLMConfig,
    req: LLMRequest,
  ): Promise<LLMResponse> {
    // 1. Extract the system message — Anthropic puts it in a top-level
    //    `system` param, NOT in `messages`. Mirrors provider.py:192-198.
    const { system, anthropicMessages } = this.translateMessagesAnthropic(
      req.messages,
    );

    // 2. Translate tool definitions to Anthropic's schema
    //    (provider.py:200-208). The unified `parameters` becomes
    //    `input_schema`; `name` and `description` are passed through.
    const tools = (req.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const body: Record<string, unknown> = {
      model: cfg.model,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      messages: anthropicMessages,
    };
    if (system) body['system'] = system;
    if (tools.length > 0) body['tools'] = tools;

    const resp = await this.httpFetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey!,
        'anthropic-version': ANTHROPIC_VERSION,
        // Browser-only header — Anthropic blocks browser requests by
        // default to discourage shipping keys in client code. Per spec
        // Decision 4, v2 is BYOK so the user's own key is in the
        // browser by their explicit choice.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await this.safeReadText(resp);
      throw new Error(`Anthropic request failed: ${resp.status} ${resp.statusText}${text ? ` — ${text}` : ''}`);
    }

    const json = (await resp.json()) as {
      content?: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      >;
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    // 3. Translate response back to unified shape.
    let textContent = '';
    const toolCalls: ToolCall[] = [];
    for (const block of json.content ?? []) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          // Anthropic gives us the parsed object directly — no JSON.parse.
          arguments: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      finishReason: this.mapAnthropicStop(json.stop_reason),
      usage: json.usage
        ? {
            inputTokens: json.usage.input_tokens ?? 0,
            outputTokens: json.usage.output_tokens ?? 0,
          }
        : undefined,
    };
  }

  /**
   * Anthropic message translation. Returns the extracted system prompt
   * and the messages array in Anthropic's expected shape.
   *
   * Faithful to provider.py:192-198 for the simple case (system + plain
   * user/assistant text). Extends it for the tool-call round-trip:
   * assistant messages with `toolCalls` become `content` arrays mixing
   * text + `tool_use` blocks; `role:'tool'` results are folded into a
   * `user` message whose content is a list of `tool_result` blocks
   * (mirrors provider.py:280-281: "Anthropic expects all tool results
   * in a single user message").
   */
  private translateMessagesAnthropic(messages: LLMMessage[]): {
    system: string;
    anthropicMessages: Array<{ role: string; content: unknown }>;
  } {
    let system = '';
    const out: Array<{ role: string; content: unknown }> = [];
    let pendingToolResults: Array<Record<string, unknown>> = [];

    const flushToolResults = () => {
      if (pendingToolResults.length > 0) {
        out.push({ role: 'user', content: pendingToolResults });
        pendingToolResults = [];
      }
    };

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
        continue;
      }

      if (msg.role === 'tool') {
        // Buffer consecutive tool results and emit them as one user message.
        pendingToolResults.push({
          type: 'tool_result',
          tool_use_id: msg.toolCallId ?? '',
          content: msg.content,
        });
        continue;
      }

      flushToolResults();

      if (msg.role === 'user') {
        out.push({ role: 'user', content: msg.content });
        continue;
      }

      // Assistant — may include tool_use blocks.
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const blocks: Array<Record<string, unknown>> = [];
        if (msg.content) {
          blocks.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        out.push({ role: 'assistant', content: blocks });
      } else {
        out.push({ role: 'assistant', content: msg.content });
      }
    }

    flushToolResults();
    return { system, anthropicMessages: out };
  }

  private mapAnthropicStop(
    reason: string | undefined,
  ): LLMResponse['finishReason'] {
    switch (reason) {
      case 'tool_use':
        return 'tool_use';
      case 'max_tokens':
        return 'length';
      case 'end_turn':
      case 'stop_sequence':
      case undefined:
        return 'stop';
      default:
        return 'stop';
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Adapter: OpenAI-compatible (OpenAI, Groq, OpenRouter)
  // ─────────────────────────────────────────────────────────────────────

  private async callOpenAICompatible(
    cfg: LLMConfig,
    req: LLMRequest,
  ): Promise<LLMResponse> {
    const baseURL = (
      cfg.baseUrl ?? OPENAI_BASE_URLS[cfg.provider] ?? OPENAI_BASE_URLS.openai!
    ).replace(/\/$/, '');
    const url = `${baseURL}/chat/completions`;

    // System message stays in `messages` for OpenAI-compatible APIs
    // (the OPPOSITE of Anthropic — see provider.py:54-62).
    const messages = this.translateMessagesOpenAI(req.messages);

    const tools = (req.tools ?? []).map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const body: Record<string, unknown> = {
      model: cfg.model,
      messages,
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
    };
    if (req.maxTokens) body['max_tokens'] = req.maxTokens;
    if (tools.length > 0) body['tools'] = tools;

    const resp = await this.httpFetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey!}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await this.safeReadText(resp);
      throw new Error(
        `${PROVIDERS[cfg.provider].displayName} request failed: ${resp.status} ${resp.statusText}${text ? ` — ${text}` : ''}`,
      );
    }

    const json = (await resp.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string | null;
      }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const choice = json.choices?.[0];
    const msg = choice?.message;

    const toolCalls: ToolCall[] = [];
    for (const tc of msg?.tool_calls ?? []) {
      // OpenAI gives `arguments` as a JSON STRING — we parse it. If the
      // model emits invalid JSON, fall back to {} to match provider.py:133-135.
      if (tc.type !== 'function') continue;
      let parsed: Record<string, unknown> = {};
      try {
        parsed = tc.function.arguments
          ? JSON.parse(tc.function.arguments)
          : {};
      } catch {
        parsed = {};
      }
      toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        arguments: parsed,
      });
    }

    return {
      content: msg?.content ?? '',
      toolCalls,
      finishReason: this.mapOpenAIFinish(choice?.finish_reason),
      usage: json.usage
        ? {
            inputTokens: json.usage.prompt_tokens ?? 0,
            outputTokens: json.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }

  private translateMessagesOpenAI(
    messages: LLMMessage[],
  ): Array<Record<string, unknown>> {
    const out: Array<Record<string, unknown>> = [];
    for (const m of messages) {
      if (m.role === 'system') {
        out.push({ role: 'system', content: m.content });
      } else if (m.role === 'user') {
        out.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        const am: Record<string, unknown> = {
          role: 'assistant',
          content: m.content || null,
        };
        if (m.toolCalls && m.toolCalls.length > 0) {
          am['tool_calls'] = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              // OpenAI expects `arguments` as a JSON string on the way IN too.
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }
        out.push(am);
      } else if (m.role === 'tool') {
        out.push({
          role: 'tool',
          tool_call_id: m.toolCallId ?? '',
          content: m.content,
        });
      }
    }
    return out;
  }

  private mapOpenAIFinish(
    reason: string | null | undefined,
  ): LLMResponse['finishReason'] {
    switch (reason) {
      case 'tool_calls':
      case 'function_call':
        return 'tool_use';
      case 'length':
        return 'length';
      case 'stop':
      case null:
      case undefined:
        return 'stop';
      default:
        return 'stop';
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Adapter: Gemini via REST :generateContent
  //
  // INTENTIONAL DIVERGENCE FROM PYTHON: backend/app/llm/provider.py routes
  // Gemini through the OpenAI-compat shim at
  // generativelanguage.googleapis.com/v1beta/openai/. The v2 architecture
  // uses Gemini's NATIVE REST endpoint so we get first-class structured
  // tool-calling. Native field name is `parameters` (not the SDK type's
  // `parametersJsonSchema`) — verified from googleapis/js-genai docs.
  // ─────────────────────────────────────────────────────────────────────

  private async callGemini(
    cfg: LLMConfig,
    req: LLMRequest,
  ): Promise<LLMResponse> {
    const { systemInstruction, contents } = this.translateMessagesGemini(
      req.messages,
    );

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: req.temperature ?? DEFAULT_TEMPERATURE,
        ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
      },
    };
    if (systemInstruction) {
      body['systemInstruction'] = { parts: [{ text: systemInstruction }] };
    }
    if (req.tools && req.tools.length > 0) {
      body['tools'] = [
        {
          functionDeclarations: req.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const url = `${GEMINI_BASE}/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey!)}`;

    const resp = await this.httpFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await this.safeReadText(resp);
      throw new Error(
        `Gemini request failed: ${resp.status} ${resp.statusText}${text ? ` — ${text}` : ''}`,
      );
    }

    const json = (await resp.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<Record<string, unknown>> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    // Extract text and function calls from the first candidate's parts.
    let textContent = '';
    const toolCalls: ToolCall[] = [];
    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    let toolCallIdx = 0;
    for (const part of parts) {
      if (typeof part['text'] === 'string') {
        textContent += part['text'];
      }
      const fc = part['functionCall'] as
        | { name?: string; args?: Record<string, unknown>; id?: string }
        | undefined;
      if (fc && fc.name) {
        toolCalls.push({
          // Gemini doesn't always provide a stable id — synthesize one.
          id: fc.id ?? `gemini-${toolCallIdx}`,
          name: fc.name,
          arguments: (fc.args ?? {}) as Record<string, unknown>,
        });
        toolCallIdx++;
      }
    }

    return {
      content: textContent,
      toolCalls,
      finishReason: this.mapGeminiFinish(
        candidate?.finishReason,
        toolCalls.length > 0,
      ),
      usage: json.usageMetadata
        ? {
            inputTokens: json.usageMetadata.promptTokenCount ?? 0,
            outputTokens: json.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  }

  /**
   * Gemini message translation:
   *   - 'system' → top-level `systemInstruction` (string, wrapped at call site).
   *   - 'user' → `{role:'user', parts:[{text}]}`.
   *   - 'assistant' → `{role:'model', parts:[{text}, {functionCall}, ...]}`.
   *   - 'tool' → `{role:'user', parts:[{functionResponse:{name, response}}]}`.
   */
  private translateMessagesGemini(messages: LLMMessage[]): {
    systemInstruction: string;
    contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  } {
    let systemInstruction = '';
    const contents: Array<{
      role: string;
      parts: Array<Record<string, unknown>>;
    }> = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemInstruction = m.content;
        continue;
      }
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content }] });
        continue;
      }
      if (m.role === 'assistant') {
        const parts: Array<Record<string, unknown>> = [];
        if (m.content) parts.push({ text: m.content });
        for (const tc of m.toolCalls ?? []) {
          parts.push({
            functionCall: { name: tc.name, args: tc.arguments },
          });
        }
        contents.push({ role: 'model', parts });
        continue;
      }
      if (m.role === 'tool') {
        // Gemini expects function results under role 'user' with a
        // `functionResponse` part. The unified shape only carries
        // toolCallId + content — use the toolCallId as the name fallback.
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.toolCallId ?? 'tool',
                response: { content: m.content },
              },
            },
          ],
        });
      }
    }
    return { systemInstruction, contents };
  }

  private mapGeminiFinish(
    reason: string | undefined,
    hasToolCalls: boolean,
  ): LLMResponse['finishReason'] {
    if (hasToolCalls) return 'tool_use';
    switch (reason) {
      case 'MAX_TOKENS':
        return 'length';
      case 'STOP':
      case undefined:
        return 'stop';
      default:
        return 'stop';
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Adapter: Ollama via native /api/chat
  //
  // INTENTIONAL DIVERGENCE FROM PYTHON: provider.py routes Ollama through
  // the OpenAI-compat shim (http://localhost:11434/v1). v2 uses Ollama's
  // native /api/chat endpoint so we get accurate tool-call shapes that
  // some Ollama models only produce on the native endpoint.
  //
  // BROWSER GOTCHA: the user MUST set OLLAMA_ORIGINS=* (or at least their
  // app origin) for the browser to reach localhost:11434. The Setup
  // wizard surfaces this in a later task.
  // ─────────────────────────────────────────────────────────────────────

  private async callOllama(
    cfg: LLMConfig,
    req: LLMRequest,
  ): Promise<LLMResponse> {
    const baseUrl = (cfg.baseUrl ?? DEFAULT_OLLAMA_BASE).replace(/\/$/, '');
    const url = `${baseUrl}/api/chat`;

    // Ollama accepts an OpenAI-shaped messages array on /api/chat.
    const messages = req.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId,
        };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const body: Record<string, unknown> = {
      model: cfg.model,
      messages,
      stream: false,
      options: { temperature: req.temperature ?? DEFAULT_TEMPERATURE },
    };
    if (req.tools && req.tools.length > 0) {
      body['tools'] = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const resp = await this.httpFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(
        `Ollama request failed: ${resp.status} ${resp.statusText}`,
      );
    }

    const json = (await resp.json()) as {
      message?: {
        content?: string;
        tool_calls?: Array<{
          id?: string;
          function: {
            name: string;
            // Ollama may emit arguments as either an object OR a string.
            arguments: Record<string, unknown> | string;
          };
        }>;
      };
      done_reason?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    const message = json.message ?? {};
    const toolCalls: ToolCall[] = [];
    let idx = 0;
    for (const tc of message.tool_calls ?? []) {
      let args: Record<string, unknown> = {};
      const raw = tc.function?.arguments;
      if (typeof raw === 'string') {
        try {
          args = raw ? JSON.parse(raw) : {};
        } catch {
          args = {};
        }
      } else if (raw && typeof raw === 'object') {
        args = raw;
      }
      toolCalls.push({
        id: tc.id ?? `ollama-${idx}`,
        name: tc.function.name,
        arguments: args,
      });
      idx++;
    }

    return {
      content: message.content ?? '',
      toolCalls,
      finishReason: this.mapOllamaFinish(json.done_reason, toolCalls.length > 0),
      usage:
        json.prompt_eval_count != null || json.eval_count != null
          ? {
              inputTokens: json.prompt_eval_count ?? 0,
              outputTokens: json.eval_count ?? 0,
            }
          : undefined,
    };
  }

  private mapOllamaFinish(
    reason: string | undefined,
    hasToolCalls: boolean,
  ): LLMResponse['finishReason'] {
    if (hasToolCalls) return 'tool_use';
    switch (reason) {
      case 'length':
        return 'length';
      case 'stop':
      case undefined:
        return 'stop';
      default:
        return 'stop';
    }
  }

  /**
   * Best-effort response body reader for error messages. Never throws —
   * we'd rather surface the original HTTP status than an unrelated parse
   * error masking it.
   */
  private async safeReadText(resp: Response): Promise<string> {
    try {
      const text = await resp.text();
      // Truncate noisy provider responses for log readability.
      return text.length > 500 ? text.slice(0, 500) + '...' : text;
    } catch {
      return '';
    }
  }
}
