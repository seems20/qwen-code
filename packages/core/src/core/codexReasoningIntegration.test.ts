/**
 * @license
 * Copyright 2025 RedNote
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type {
  ContentGenerator,
  ContentGeneratorConfig,
} from './contentGenerator.js';
import { GeminiChat, StreamEventType } from './geminiChat.js';
import type { Config } from '../config/config.js';
import type {
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';

class MockCodexGenerator implements ContentGenerator {
  public lastRequest?: GenerateContentParameters;

  constructor(private readonly streamChunks: GenerateContentResponse[]) {}

  async generateContent(): Promise<GenerateContentResponse> {
    throw new Error('not used');
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    this.lastRequest = request;
    const chunks = this.streamChunks;
    return (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })();
  }

  async countTokens() {
    return { totalTokens: 1 };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('not used');
  }

  useSummarizedThinking(): boolean {
    return false;
  }
}

describe('Codex reasoning integration', () => {
  it('preserves streamed reasoning text in history while keeping final metadata for replay', async () => {
    const reasoningChunkA = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'internal ', thought: true }],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const reasoningChunkB = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'reasoning', thought: true }],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const visibleChunk = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'visible ' }],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const finalChunk = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                text: '',
                thought: true,
                thoughtSignature: 'enc_state_stream',
                codexReasoningItem: {
                  type: 'reasoning',
                  id: 'rs_state_stream',
                  status: 'completed',
                  content: [{ type: 'reasoning_text', text: 'raw reasoning' }],
                  summary: [{ type: 'summary_text', text: 'internal reasoning' }],
                  encrypted_content: 'enc_state_stream',
                },
              },
            ],
          },
          finishReason: 'STOP',
          safetyRatings: [],
          index: 0,
        },
      ],
    } as unknown as GenerateContentResponse;

    const generator = new MockCodexGenerator([
      reasoningChunkA,
      reasoningChunkB,
      visibleChunk,
      finalChunk,
    ]);

    const config = {
      getContentGenerator: () => generator,
      getContentGeneratorConfig: () => ({}) as ContentGeneratorConfig,
      getToolRegistry: () => ({ getAllTools: () => [] }),
      getChatRecordingService: () => null,
    } as unknown as Config;

    const chat = new GeminiChat(config, {});

    const stream = await chat.sendMessageStream(
      'gpt-5.4',
      { message: 'hello' },
      'prompt-stream',
    );
    for await (const event of stream) {
      expect(event.type).toBe(StreamEventType.CHUNK);
    }

    const history = chat.getHistory();
    expect(history[1].parts).toEqual([
      {
        text: 'internal reasoning',
        thought: true,
        thoughtSignature: 'enc_state_stream',
        codexReasoningItem: {
          type: 'reasoning',
          id: 'rs_state_stream',
          status: 'completed',
          content: [{ type: 'reasoning_text', text: 'raw reasoning' }],
          summary: [{ type: 'summary_text', text: 'internal reasoning' }],
          encrypted_content: 'enc_state_stream',
        },
      },
      { text: 'visible ' },
    ]);

    const secondStream = await chat.sendMessageStream(
      'gpt-5.4',
      { message: 'next' },
      'prompt-stream-next',
    );
    for await (const event of secondStream) {
      expect(event.type).toBe(StreamEventType.CHUNK);
    }

    expect(generator.lastRequest?.contents).toEqual([
      { role: 'user', parts: [{ text: 'hello' }] },
      {
        role: 'model',
        parts: [
          {
            text: 'internal reasoning',
            thought: true,
            thoughtSignature: 'enc_state_stream',
            codexReasoningItem: {
              type: 'reasoning',
              id: 'rs_state_stream',
              status: 'completed',
              content: [{ type: 'reasoning_text', text: 'raw reasoning' }],
              summary: [{ type: 'summary_text', text: 'internal reasoning' }],
              encrypted_content: 'enc_state_stream',
            },
          },
          { text: 'visible ' },
        ],
      },
      { role: 'user', parts: [{ text: 'next' }] },
    ]);
  });

  it('preserves full reasoning item in history and replays it on the next turn', async () => {
    const firstChunk = {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: 'visible ' }],
          },
        },
      ],
    } as unknown as GenerateContentResponse;

    const finalChunk = {
      candidates: [
        {
          content: {
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
                  content: [{ type: 'reasoning_text', text: 'raw reasoning' }],
                  summary: [{ type: 'summary_text', text: 'internal reasoning' }],
                  encrypted_content: 'enc_state_1',
                },
              },
            ],
          },
          finishReason: 'STOP',
          safetyRatings: [],
          index: 0,
        },
      ],
    } as unknown as GenerateContentResponse;

    const generator = new MockCodexGenerator([firstChunk, finalChunk]);

    const config = {
      getContentGenerator: () => generator,
      getContentGeneratorConfig: () => ({}) as ContentGeneratorConfig,
      getToolRegistry: () => ({ getAllTools: () => [] }),
      getChatRecordingService: () => null,
    } as unknown as Config;

    const chat = new GeminiChat(config, {});

    const firstStream = await chat.sendMessageStream(
      'gpt-5.4',
      { message: 'hello' },
      'prompt-1',
    );
    for await (const event of firstStream) {
      expect(event.type).toBe(StreamEventType.CHUNK);
    }

    const history = chat.getHistory();
    expect(history[1].parts?.[0]).toEqual({
      text: 'internal reasoning',
      thought: true,
      thoughtSignature: 'enc_state_1',
      codexReasoningItem: {
        type: 'reasoning',
        id: 'rs_state_1',
        status: 'completed',
        content: [{ type: 'reasoning_text', text: 'raw reasoning' }],
        summary: [{ type: 'summary_text', text: 'internal reasoning' }],
        encrypted_content: 'enc_state_1',
      },
    });

    const secondStream = await chat.sendMessageStream(
      'gpt-5.4',
      { message: 'next' },
      'prompt-2',
    );
    for await (const event of secondStream) {
      expect(event.type).toBe(StreamEventType.CHUNK);
    }

    const secondRequest = generator.lastRequest;
    expect(secondRequest?.contents).toEqual([
      { role: 'user', parts: [{ text: 'hello' }] },
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
              content: [{ type: 'reasoning_text', text: 'raw reasoning' }],
              summary: [{ type: 'summary_text', text: 'internal reasoning' }],
              encrypted_content: 'enc_state_1',
            },
          },
          { text: 'visible ' },
        ],
      },
      { role: 'user', parts: [{ text: 'next' }] },
    ]);
  });
});
