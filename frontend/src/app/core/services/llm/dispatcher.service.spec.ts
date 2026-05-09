/**
 * LLMDispatcherService spec — covers validation, per-provider request
 * translation, and round-trip tool-call parsing.
 *
 * Mocking strategy: the dispatcher's only network indirection is the
 * protected `httpFetch(url, init)` method. Tests `spyOn` it on the
 * service instance and return canned `Response` objects. We then read
 * the recorded `init.body` to assert exact request shapes.
 */
import { TestBed } from '@angular/core/testing';
import { LLMDispatcherService } from './dispatcher.service';
import { LLMConfig, LLMRequest, ToolDefinition } from './types';

/** Build a faux `Response`-shaped object that the dispatcher can read. */
function fakeResponse(json: unknown, init?: { ok?: boolean; status?: number; statusText?: string }): Response {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: () => Promise.resolve(json),
    text: () => Promise.resolve(typeof json === 'string' ? json : JSON.stringify(json)),
  } as unknown as Response;
}

/** Read and parse the body of an httpFetch call. */
function getBody(init: RequestInit | undefined): Record<string, unknown> {
  return JSON.parse(init?.body as string);
}

/** Read a header from an httpFetch call (case-insensitive). */
function getHeader(init: RequestInit | undefined, name: string): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === name.toLowerCase()) return v;
  }
  return undefined;
}

describe('LLMDispatcherService', () => {
  let svc: LLMDispatcherService;
  let fetchSpy: jasmine.Spy<(url: string, init: RequestInit) => Promise<Response>>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(LLMDispatcherService);
    // The dispatcher's sole network indirection — overridden per test.
    fetchSpy = spyOn(svc as unknown as { httpFetch: () => Promise<Response> }, 'httpFetch') as unknown as jasmine.Spy<
      (url: string, init: RequestInit) => Promise<Response>
    >;
  });

  // ───────────────────────────────────────────────────────────────────
  // Validation
  // ───────────────────────────────────────────────────────────────────

  describe('validateConfig', () => {
    it('throws when an Anthropic config has no apiKey', async () => {
      const cfg: LLMConfig = { provider: 'anthropic', model: 'claude-sonnet-4-5' };
      await expectAsync(
        svc.complete(cfg, { messages: [{ role: 'user', content: 'hi' }] }),
      ).toBeRejectedWithError(/api key required/i);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws when an OpenAI config has no apiKey', async () => {
      const cfg: LLMConfig = { provider: 'openai', model: 'gpt-4o' };
      await expectAsync(
        svc.complete(cfg, { messages: [{ role: 'user', content: 'hi' }] }),
      ).toBeRejectedWithError(/api key required/i);
    });

    it('throws when a Gemini config has no apiKey', async () => {
      const cfg: LLMConfig = { provider: 'gemini', model: 'gemini-2.5-pro' };
      await expectAsync(
        svc.complete(cfg, { messages: [{ role: 'user', content: 'hi' }] }),
      ).toBeRejectedWithError(/api key required/i);
    });

    it('does NOT throw when ollama has no apiKey', () => {
      const cfg: LLMConfig = { provider: 'ollama', model: 'llama3.3' };
      expect(() => svc.validateConfig(cfg)).not.toThrow();
    });

    it('throws on unsupported provider', async () => {
      const cfg = { provider: 'cohere' as 'anthropic', model: 'command-r' };
      await expectAsync(
        svc.complete(cfg, { messages: [{ role: 'user', content: 'hi' }] }),
      ).toBeRejectedWithError(/unsupported provider/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // Anthropic adapter
  // ───────────────────────────────────────────────────────────────────

  describe('Anthropic adapter', () => {
    const cfg: LLMConfig = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      apiKey: 'sk-ant-test',
    };

    it('POSTs to https://api.anthropic.com/v1/messages with browser headers', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            content: [{ type: 'text', text: 'pong' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 5, output_tokens: 1 },
          }),
        ),
      );

      const resp = await svc.complete(cfg, {
        messages: [
          { role: 'system', content: 'you are helpful' },
          { role: 'user', content: 'ping' },
        ],
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.calls.mostRecent().args;
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(getHeader(init, 'x-api-key')).toBe('sk-ant-test');
      expect(getHeader(init, 'anthropic-version')).toBe('2023-06-01');
      expect(getHeader(init, 'anthropic-dangerous-direct-browser-access')).toBe('true');

      const body = getBody(init);
      // Anthropic puts system in a top-level param, NOT in messages.
      expect(body['system']).toBe('you are helpful');
      expect(body['messages']).toEqual([{ role: 'user', content: 'ping' }]);
      expect(body['model']).toBe('claude-sonnet-4-5');

      expect(resp.content).toBe('pong');
      expect(resp.toolCalls).toEqual([]);
      expect(resp.finishReason).toBe('stop');
      expect(resp.usage).toEqual({ inputTokens: 5, outputTokens: 1 });
    });

    it('translates tool definitions to Anthropic input_schema and parses tool_use blocks', async () => {
      const tools: ToolDefinition[] = [
        {
          name: 'search_nexus',
          description: 'Search Nexus mods',
          parameters: { type: 'object', properties: { q: { type: 'string' } } },
        },
      ];
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            content: [
              { type: 'text', text: 'searching...' },
              {
                type: 'tool_use',
                id: 'toolu_01',
                name: 'search_nexus',
                input: { q: 'skyui' },
              },
            ],
            stop_reason: 'tool_use',
            usage: { input_tokens: 10, output_tokens: 8 },
          }),
        ),
      );

      const resp = await svc.complete(cfg, {
        messages: [{ role: 'user', content: 'find skyui' }],
        tools,
      });

      const body = getBody(fetchSpy.calls.mostRecent().args[1]);
      expect(body['tools']).toEqual([
        {
          name: 'search_nexus',
          description: 'Search Nexus mods',
          input_schema: { type: 'object', properties: { q: { type: 'string' } } },
        },
      ]);
      expect(resp.content).toBe('searching...');
      expect(resp.toolCalls).toEqual([
        { id: 'toolu_01', name: 'search_nexus', arguments: { q: 'skyui' } },
      ]);
      expect(resp.finishReason).toBe('tool_use');
    });

    it('round-trips an assistant tool-call message and a tool-result message', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            content: [{ type: 'text', text: 'done' }],
            stop_reason: 'end_turn',
          }),
        ),
      );

      await svc.complete(cfg, {
        messages: [
          { role: 'user', content: 'find skyui' },
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              { id: 'toolu_1', name: 'search_nexus', arguments: { q: 'skyui' } },
            ],
          },
          { role: 'tool', toolCallId: 'toolu_1', content: '{"results":[]}' },
        ],
      });

      const body = getBody(fetchSpy.calls.mostRecent().args[1]);
      const messages = body['messages'] as Array<Record<string, unknown>>;
      // user msg + assistant-with-tool-use + user-with-tool-result
      expect(messages.length).toBe(3);
      expect(messages[0]).toEqual({ role: 'user', content: 'find skyui' });
      expect(messages[1]['role']).toBe('assistant');
      expect((messages[1]['content'] as Array<Record<string, unknown>>)[0]).toEqual({
        type: 'tool_use',
        id: 'toolu_1',
        name: 'search_nexus',
        input: { q: 'skyui' },
      });
      expect(messages[2]['role']).toBe('user');
      expect((messages[2]['content'] as Array<Record<string, unknown>>)[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: '{"results":[]}',
      });
    });

    it('raises an informative error on non-2xx HTTP responses', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({ error: 'invalid_api_key' }, { ok: false, status: 401, statusText: 'Unauthorized' }),
        ),
      );

      await expectAsync(
        svc.complete(cfg, { messages: [{ role: 'user', content: 'hi' }] }),
      ).toBeRejectedWithError(/Anthropic.*401/);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // OpenAI-compatible adapter (covers openai, groq, openrouter)
  // ───────────────────────────────────────────────────────────────────

  describe('OpenAI-compatible adapter', () => {
    it('POSTs to /chat/completions with Bearer auth and keeps system in messages', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            choices: [
              { message: { content: 'hello', tool_calls: [] }, finish_reason: 'stop' },
            ],
            usage: { prompt_tokens: 4, completion_tokens: 2 },
          }),
        ),
      );

      const resp = await svc.complete(
        { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-x' },
        {
          messages: [
            { role: 'system', content: 'sys' },
            { role: 'user', content: 'hi' },
          ],
        },
      );

      const [url, init] = fetchSpy.calls.mostRecent().args;
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(getHeader(init, 'authorization')).toBe('Bearer sk-x');

      const body = getBody(init);
      expect(body['messages']).toEqual([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ]);
      expect(resp.content).toBe('hello');
      expect(resp.usage).toEqual({ inputTokens: 4, outputTokens: 2 });
    });

    it('uses the Groq base URL when provider is groq', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            choices: [{ message: { content: 'g', tool_calls: [] }, finish_reason: 'stop' }],
          }),
        ),
      );

      await svc.complete(
        { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'gsk_x' },
        { messages: [{ role: 'user', content: 'hi' }] },
      );

      expect(fetchSpy.calls.mostRecent().args[0]).toBe(
        'https://api.groq.com/openai/v1/chat/completions',
      );
    });

    it('uses the OpenRouter base URL when provider is openrouter', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            choices: [{ message: { content: 'o', tool_calls: [] }, finish_reason: 'stop' }],
          }),
        ),
      );

      await svc.complete(
        { provider: 'openrouter', model: 'anthropic/claude-sonnet-4', apiKey: 'sk-or-v1-x' },
        { messages: [{ role: 'user', content: 'hi' }] },
      );

      expect(fetchSpy.calls.mostRecent().args[0]).toBe(
        'https://openrouter.ai/api/v1/chat/completions',
      );
    });

    it('translates tools to {type:function, function:{...}} and parses tool_calls (arguments JSON.parsed)', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            choices: [
              {
                message: {
                  content: '',
                  tool_calls: [
                    {
                      id: 'call_42',
                      type: 'function',
                      function: {
                        name: 'add_to_modlist',
                        arguments: JSON.stringify({ mod_id: 1840, priority: 'high' }),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
        ),
      );

      const tools: ToolDefinition[] = [
        {
          name: 'add_to_modlist',
          description: 'Add mod to list',
          parameters: { type: 'object', properties: { mod_id: { type: 'number' } } },
        },
      ];
      const resp = await svc.complete(
        { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-x' },
        { messages: [{ role: 'user', content: 'add 1840' }], tools },
      );

      const body = getBody(fetchSpy.calls.mostRecent().args[1]);
      expect(body['tools']).toEqual([
        {
          type: 'function',
          function: {
            name: 'add_to_modlist',
            description: 'Add mod to list',
            parameters: { type: 'object', properties: { mod_id: { type: 'number' } } },
          },
        },
      ]);
      expect(resp.toolCalls).toEqual([
        { id: 'call_42', name: 'add_to_modlist', arguments: { mod_id: 1840, priority: 'high' } },
      ]);
      expect(resp.finishReason).toBe('tool_use');
    });

    it('falls back to {} on malformed tool-call arguments JSON', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            choices: [
              {
                message: {
                  content: '',
                  tool_calls: [
                    {
                      id: 'call_bad',
                      type: 'function',
                      function: { name: 'foo', arguments: '{not valid' },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
        ),
      );

      const resp = await svc.complete(
        { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-x' },
        { messages: [{ role: 'user', content: 'hi' }] },
      );
      expect(resp.toolCalls[0].arguments).toEqual({});
    });

    it('serializes assistant tool calls back to OpenAI shape (arguments as JSON string)', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            choices: [{ message: { content: 'ok', tool_calls: [] }, finish_reason: 'stop' }],
          }),
        ),
      );

      await svc.complete(
        { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-x' },
        {
          messages: [
            { role: 'user', content: 'find' },
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ id: 'c1', name: 'fn', arguments: { x: 1 } }],
            },
            { role: 'tool', toolCallId: 'c1', content: 'result' },
          ],
        },
      );

      const body = getBody(fetchSpy.calls.mostRecent().args[1]);
      const messages = body['messages'] as Array<Record<string, unknown>>;
      // assistant tool_calls preserved with stringified arguments
      const asst = messages[1];
      expect(asst['role']).toBe('assistant');
      const toolCalls = asst['tool_calls'] as Array<Record<string, unknown>>;
      const fn = toolCalls[0]['function'] as Record<string, unknown>;
      expect(fn['arguments']).toBe(JSON.stringify({ x: 1 }));
      // tool result message
      expect(messages[2]).toEqual({ role: 'tool', tool_call_id: 'c1', content: 'result' });
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // Gemini adapter (raw REST)
  // ───────────────────────────────────────────────────────────────────

  describe('Gemini adapter', () => {
    const cfg: LLMConfig = {
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      apiKey: 'AIza-x',
    };

    it('POSTs to v1beta :generateContent with key in query string', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            candidates: [
              { content: { parts: [{ text: 'hi back' }] }, finishReason: 'STOP' },
            ],
            usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
          }),
        ),
      );

      const resp = await svc.complete(cfg, {
        messages: [
          { role: 'system', content: 'be terse' },
          { role: 'user', content: 'hi' },
        ],
      });

      const [url, init] = fetchSpy.calls.mostRecent().args;
      expect(url).toContain('generativelanguage.googleapis.com');
      expect(url).toContain('gemini-2.5-pro:generateContent');
      expect(url).toContain('key=AIza-x');

      const body = getBody(init);
      expect(body['systemInstruction']).toEqual({ parts: [{ text: 'be terse' }] });
      expect(body['contents']).toEqual([
        { role: 'user', parts: [{ text: 'hi' }] },
      ]);
      expect(resp.content).toBe('hi back');
      expect(resp.finishReason).toBe('stop');
      expect(resp.usage).toEqual({ inputTokens: 3, outputTokens: 2 });
    });

    it('translates tools to functionDeclarations with native `parameters` field', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
          }),
        ),
      );

      const tools: ToolDefinition[] = [
        {
          name: 'search_nexus',
          description: 'Search',
          parameters: { type: 'object', properties: { q: { type: 'string' } } },
        },
      ];
      await svc.complete(cfg, {
        messages: [{ role: 'user', content: 'hi' }],
        tools,
      });

      const body = getBody(fetchSpy.calls.mostRecent().args[1]);
      expect(body['tools']).toEqual([
        {
          functionDeclarations: [
            {
              name: 'search_nexus',
              description: 'Search',
              parameters: {
                type: 'object',
                properties: { q: { type: 'string' } },
              },
            },
          ],
        },
      ]);
    });

    it('parses functionCall parts into LLMResponse.toolCalls (args object preserved)', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            candidates: [
              {
                content: {
                  parts: [
                    { text: 'searching' },
                    { functionCall: { name: 'search_nexus', args: { q: 'skyui' } } },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          }),
        ),
      );

      const resp = await svc.complete(cfg, {
        messages: [{ role: 'user', content: 'find skyui' }],
      });

      expect(resp.content).toBe('searching');
      expect(resp.toolCalls.length).toBe(1);
      expect(resp.toolCalls[0].name).toBe('search_nexus');
      expect(resp.toolCalls[0].arguments).toEqual({ q: 'skyui' });
      // hasToolCalls → finishReason becomes tool_use even though Gemini said STOP
      expect(resp.finishReason).toBe('tool_use');
      // Synthesized id when Gemini doesn't provide one
      expect(resp.toolCalls[0].id).toMatch(/^gemini-/);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // Ollama adapter
  // ───────────────────────────────────────────────────────────────────

  describe('Ollama adapter', () => {
    it('POSTs to /api/chat at the default localhost URL with stream:false', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            message: { content: 'pong', tool_calls: [] },
            done_reason: 'stop',
          }),
        ),
      );

      const resp = await svc.complete(
        { provider: 'ollama', model: 'llama3.3' },
        { messages: [{ role: 'user', content: 'ping' }] },
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.calls.mostRecent().args;
      expect(url).toBe('http://localhost:11434/api/chat');
      const body = getBody(init);
      expect(body['stream']).toBe(false);
      expect(body['model']).toBe('llama3.3');
      expect(body['messages']).toEqual([{ role: 'user', content: 'ping' }]);
      expect(resp.content).toBe('pong');
      expect(resp.finishReason).toBe('stop');
    });

    it('honors a custom baseUrl from LLMConfig', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(fakeResponse({ message: { content: '', tool_calls: [] } })),
      );

      await svc.complete(
        { provider: 'ollama', model: 'llama3.3', baseUrl: 'http://192.168.1.50:11434' },
        { messages: [{ role: 'user', content: 'hi' }] },
      );
      expect(fetchSpy.calls.mostRecent().args[0]).toBe('http://192.168.1.50:11434/api/chat');
    });

    it('parses tool_calls when arguments are an object', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            message: {
              content: '',
              tool_calls: [
                { function: { name: 'search_nexus', arguments: { q: 'skyui' } } },
              ],
            },
          }),
        ),
      );

      const resp = await svc.complete(
        { provider: 'ollama', model: 'llama3.3' },
        { messages: [{ role: 'user', content: 'find skyui' }] },
      );
      expect(resp.toolCalls.length).toBe(1);
      expect(resp.toolCalls[0].name).toBe('search_nexus');
      expect(resp.toolCalls[0].arguments).toEqual({ q: 'skyui' });
      expect(resp.finishReason).toBe('tool_use');
    });

    it('parses tool_calls when arguments are a JSON string', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            message: {
              content: '',
              tool_calls: [
                {
                  function: {
                    name: 'add_to_modlist',
                    arguments: JSON.stringify({ mod_id: 99 }),
                  },
                },
              ],
            },
          }),
        ),
      );

      const resp = await svc.complete(
        { provider: 'ollama', model: 'llama3.3' },
        { messages: [{ role: 'user', content: 'add' }] },
      );
      expect(resp.toolCalls[0].arguments).toEqual({ mod_id: 99 });
    });

    it('throws on non-ok HTTP responses with status info', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({}, { ok: false, status: 404, statusText: 'Not Found' }),
        ),
      );

      await expectAsync(
        svc.complete(
          { provider: 'ollama', model: 'llama3.3' },
          { messages: [{ role: 'user', content: 'hi' }] },
        ),
      ).toBeRejectedWithError(/404/);
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // Round-trip parity: tool-call shape is unified across providers.
  // ───────────────────────────────────────────────────────────────────

  describe('tool-call shape unification', () => {
    const expected = {
      name: 'add_to_modlist',
      arguments: { mod_id: 1840 },
    };

    it('Anthropic tool_use → unified ToolCall', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            content: [
              {
                type: 'tool_use',
                id: 'tu_a',
                name: 'add_to_modlist',
                input: { mod_id: 1840 },
              },
            ],
            stop_reason: 'tool_use',
          }),
        ),
      );
      const resp = await svc.complete(
        { provider: 'anthropic', model: 'claude-sonnet-4-5', apiKey: 'sk-ant-x' },
        { messages: [{ role: 'user', content: 'add 1840' }] },
      );
      expect(resp.toolCalls[0]).toEqual({ id: 'tu_a', ...expected });
    });

    it('OpenAI tool_calls → unified ToolCall', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            choices: [
              {
                message: {
                  content: '',
                  tool_calls: [
                    {
                      id: 'call_o',
                      type: 'function',
                      function: {
                        name: 'add_to_modlist',
                        arguments: JSON.stringify({ mod_id: 1840 }),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
        ),
      );
      const resp = await svc.complete(
        { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-x' },
        { messages: [{ role: 'user', content: 'add 1840' }] },
      );
      expect(resp.toolCalls[0]).toEqual({ id: 'call_o', ...expected });
    });

    it('Gemini functionCall → unified ToolCall', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            candidates: [
              {
                content: {
                  parts: [
                    { functionCall: { name: 'add_to_modlist', args: { mod_id: 1840 } } },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          }),
        ),
      );
      const resp = await svc.complete(
        { provider: 'gemini', model: 'gemini-2.5-pro', apiKey: 'AIza-x' },
        { messages: [{ role: 'user', content: 'add 1840' }] },
      );
      // id is synthesized for Gemini
      expect(resp.toolCalls[0].name).toBe(expected.name);
      expect(resp.toolCalls[0].arguments).toEqual(expected.arguments);
      expect(resp.toolCalls[0].id).toBeTruthy();
    });

    it('Ollama tool_calls → unified ToolCall', async () => {
      fetchSpy.and.returnValue(
        Promise.resolve(
          fakeResponse({
            message: {
              content: '',
              tool_calls: [
                { function: { name: 'add_to_modlist', arguments: { mod_id: 1840 } } },
              ],
            },
          }),
        ),
      );
      const resp = await svc.complete(
        { provider: 'ollama', model: 'llama3.3' },
        { messages: [{ role: 'user', content: 'add 1840' }] },
      );
      expect(resp.toolCalls[0].name).toBe(expected.name);
      expect(resp.toolCalls[0].arguments).toEqual(expected.arguments);
      expect(resp.toolCalls[0].id).toBeTruthy();
    });
  });
});
