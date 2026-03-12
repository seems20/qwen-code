/**
 * @license
 * Copyright 2025 RedNote
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateContentParameters } from '@google/genai';
import type { Config } from '../config/config.js';
import { CodexContentGenerator } from './codexContentGenerator.js';
import type { ContentGeneratorConfig } from './contentGenerator.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConfig = {
  getProxy: vi.fn(),
  getUsageStatisticsEnabled: vi.fn().mockReturnValue(false),
  getSessionId: vi.fn().mockReturnValue('test-session-id'),
  getChatRecordingService: vi.fn().mockReturnValue(null),
} as unknown as Config;

describe('CodexContentGenerator', () => {
  let generator: CodexContentGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new CodexContentGenerator(
      {
        model: 'gpt-5.4',
        apiKey: 'test-key',
        baseUrl: 'https://example.invalid/responses',
        samplingParams: {},
      } as ContentGeneratorConfig,
      mockConfig,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests encrypted reasoning in stateless mode', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'resp_1',
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'text', text: 'hello' }],
          },
        ],
      }),
    });

    const request: GenerateContentParameters = {
      model: 'gpt-5.4',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    };

    await generator.generateContent(request, 'prompt-1');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body['store']).toBe(false);
    expect(body['include']).toEqual(['reasoning.encrypted_content']);
  });

  it('converts reasoning output into thought parts with raw reasoning item preserved', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'resp_2',
        status: 'completed',
        output: [
          {
            type: 'reasoning',
            id: 'rs_123',
            status: 'completed',
            content: [{ type: 'reasoning_text', text: 'internal reasoning raw' }],
            summary: [{ type: 'summary_text', text: 'internal reasoning' }],
            encrypted_content: 'enc_123',
          },
          {
            type: 'message',
            content: [{ type: 'text', text: 'visible answer' }],
          },
        ],
      }),
    });

    const request: GenerateContentParameters = {
      model: 'gpt-5.4',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    };

    const response = await generator.generateContent(request, 'prompt-2');
    const parts = response.candidates?.[0]?.content?.parts ?? [];

    expect(parts[0]).toEqual({
      text: 'internal reasoning',
      thought: true,
      thoughtSignature: 'enc_123',
      codexReasoningItem: {
        type: 'reasoning',
        id: 'rs_123',
        status: 'completed',
        content: [{ type: 'reasoning_text', text: 'internal reasoning raw' }],
        summary: [{ type: 'summary_text', text: 'internal reasoning' }],
        encrypted_content: 'enc_123',
      },
    });
    expect(parts[1]).toEqual({ text: 'visible answer' });
  });

  it('replays encrypted reasoning as reasoning input on the next request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'resp_3',
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'text', text: 'done' }],
          },
        ],
      }),
    });

    const request: GenerateContentParameters = {
      model: 'gpt-5.4',
      contents: [
        { role: 'user', parts: [{ text: 'first turn' }] },
        {
          role: 'model',
          parts: [
            {
              text: 'internal reasoning',
              thought: true,
              thoughtSignature: 'enc_state_1',
              codexReasoningItem: {
                type: 'reasoning',
                id: 'rs_state_1',
                status: 'completed',
                content: [{ type: 'reasoning_text', text: 'internal reasoning raw' }],
                summary: [{ type: 'summary_text', text: 'internal reasoning' }],
                encrypted_content: 'enc_state_1',
              },
            },
            { text: 'assistant visible' },
          ],
        },
        { role: 'user', parts: [{ text: 'next turn' }] },
      ] as GenerateContentParameters['contents'],
    };

    await generator.generateContent(request, 'prompt-3');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      input: Array<Record<string, unknown>>;
    };

    expect(body.input).toEqual([
      { role: 'user', content: 'first turn' },
      {
        type: 'reasoning',
        id: 'rs_state_1',
        status: 'completed',
        content: [{ type: 'reasoning_text', text: 'internal reasoning raw' }],
        summary: [{ type: 'summary_text', text: 'internal reasoning' }],
        encrypted_content: 'enc_state_1',
      },
      { role: 'assistant', content: 'assistant visible' },
      { role: 'user', content: 'next turn' },
    ]);
  });

  it('streams reasoning summary deltas immediately and avoids duplicating them on completion', async () => {
    const sse = [
      'event: response.reasoning_summary_text.delta',
      'data: {"item_id":"rs_stream","delta":"internal "}',
      '',
      'event: response.reasoning_summary_text.delta',
      'data: {"item_id":"rs_stream","delta":"stream"}',
      '',
      'event: response.output_text.delta',
      'data: {"item_id":"msg_1","delta":"visible "}',
      '',
      'event: response.completed',
      'data: {"response":{"id":"resp_stream","status":"completed","output":[{"type":"reasoning","id":"rs_stream","status":"completed","content":[{"type":"reasoning_text","text":"internal stream raw"}],"summary":[{"type":"summary_text","text":"internal stream"}],"encrypted_content":"enc_stream"},{"type":"message","content":[{"type":"text","text":"visible final"}]}]}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const encoder = new TextEncoder();
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: encoder.encode(sse) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const request: GenerateContentParameters = {
      model: 'gpt-5.4',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    };

    const stream = await generator.generateContentStream(request, 'prompt-4');
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(4);
    expect(chunks[0].candidates?.[0]?.content?.parts).toEqual([
      { text: 'internal ', thought: true },
    ]);
    expect(chunks[1].candidates?.[0]?.content?.parts).toEqual([
      { text: 'stream', thought: true },
    ]);
    expect(chunks[2].candidates?.[0]?.content?.parts).toEqual([{ text: 'visible ' }]);
    expect(chunks[3].candidates?.[0]?.content?.parts).toEqual([
      {
        text: '',
        thought: true,
        thoughtSignature: 'enc_stream',
        codexReasoningItem: {
          type: 'reasoning',
          id: 'rs_stream',
          status: 'completed',
          content: [{ type: 'reasoning_text', text: 'internal stream raw' }],
          summary: [{ type: 'summary_text', text: 'internal stream' }],
          encrypted_content: 'enc_stream',
        },
      },
    ]);
  });

  it('emits final streamed reasoning part on completion without repeating visible text', async () => {
    const sse = [
      'event: response.output_text.delta',
      'data: {"item_id":"msg_1","delta":"visible "}',
      '',
      'event: response.completed',
      'data: {"response":{"id":"resp_stream","status":"completed","output":[{"type":"reasoning","id":"rs_stream","status":"completed","content":[{"type":"reasoning_text","text":"internal stream raw"}],"summary":[{"type":"summary_text","text":"internal stream"}],"encrypted_content":"enc_stream"},{"type":"message","content":[{"type":"text","text":"visible final"}]}]}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const encoder = new TextEncoder();
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: encoder.encode(sse) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const request: GenerateContentParameters = {
      model: 'gpt-5.4',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    };

    const stream = await generator.generateContentStream(request, 'prompt-4');
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0].candidates?.[0]?.content?.parts).toEqual([{ text: 'visible ' }]);
    expect(chunks[1].candidates?.[0]?.content?.parts).toEqual([
      {
        text: 'internal stream',
        thought: true,
        thoughtSignature: 'enc_stream',
        codexReasoningItem: {
          type: 'reasoning',
          id: 'rs_stream',
          status: 'completed',
          content: [{ type: 'reasoning_text', text: 'internal stream raw' }],
          summary: [{ type: 'summary_text', text: 'internal stream' }],
          encrypted_content: 'enc_stream',
        },
      },
    ]);
  });
});
