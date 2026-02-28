/**
 * @license
 * Copyright 2025 RedNote
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Type, type GenerateContentParameters } from '@google/genai';
import { CodexContentGenerator } from './codexContentGenerator.js';
import type { ContentGeneratorConfig } from './contentGenerator.js';
import type { Config } from '../config/config.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConfig = {
  getProxy: vi.fn(),
  getUsageStatisticsEnabled: vi.fn().mockReturnValue(false),
  getSessionId: vi.fn().mockReturnValue('test-session-id'),
  getChatRecordingService: vi.fn().mockReturnValue(null),
} as unknown as Config;

describe('CodexContentGenerator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('buildCodexRequest', () => {
    it('should use nested function tool schema and apply codex extra_body options', async () => {
      const generatorConfig: ContentGeneratorConfig = {
        model: 'gpt-5.3-codex',
        apiKey: 'fake-api-key',
        baseUrl: 'https://example.com/openai/v1/responses?api-version=v1',
        extra_body: {
          store: true,
          tool_choice: 'auto',
          parallel_tool_calls: true,
          max_tool_calls: 3,
        },
      };
      const generator = new CodexContentGenerator(generatorConfig, mockConfig);

      const request: GenerateContentParameters = {
        model: 'gpt-5.3-codex(high)',
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        config: {
          systemInstruction: 'You are helpful.',
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'read_file',
                  description: 'Read file content',
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      path: { type: Type.STRING },
                    },
                    required: ['path'],
                  },
                },
              ],
            },
          ],
        },
      };

      const codexRequest = await (
        generator as unknown as {
          buildCodexRequest: (
            req: GenerateContentParameters,
            stream?: boolean,
          ) => Promise<Record<string, unknown>>;
        }
      ).buildCodexRequest(request, true);

      expect(codexRequest['model']).toBe('gpt-5.3-codex');
      expect(codexRequest['stream']).toBe(true);
      expect(codexRequest['store']).toBe(true);
      expect(codexRequest['tool_choice']).toBe('auto');
      expect(codexRequest['parallel_tool_calls']).toBe(true);
      expect(codexRequest['max_tool_calls']).toBe(3);

      expect(codexRequest['tools']).toEqual([
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read file content',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string' },
              },
              required: ['path'],
            },
          },
        },
      ]);
    });

    it('should default store to false when extra_body.store is not configured', async () => {
      const generatorConfig: ContentGeneratorConfig = {
        model: 'gpt-5.3-codex',
        apiKey: 'fake-api-key',
        baseUrl: 'https://example.com/openai/v1/responses?api-version=v1',
      };
      const generator = new CodexContentGenerator(generatorConfig, mockConfig);

      const request: GenerateContentParameters = {
        model: 'gpt-5.3-codex',
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      };

      const codexRequest = await (
        generator as unknown as {
          buildCodexRequest: (
            req: GenerateContentParameters,
            stream?: boolean,
          ) => Promise<Record<string, unknown>>;
        }
      ).buildCodexRequest(request, false);

      expect(codexRequest['store']).toBe(false);
    });
  });

  describe('stream event compatibility', () => {
    let generator: CodexContentGenerator;

    beforeEach(() => {
      const generatorConfig: ContentGeneratorConfig = {
        model: 'gpt-5.3-codex',
        apiKey: 'fake-api-key',
        baseUrl: 'https://example.com/openai/v1/responses?api-version=v1',
      };
      generator = new CodexContentGenerator(generatorConfig, mockConfig);
    });

    it('should parse function_call_arguments delta + output_item.done flow', () => {
      const toolCallArgs = new Map<number, { id?: string; name?: string; args: string }>();

      const access = generator as unknown as {
        handleStreamEvent: (
          event: string,
          data: Record<string, unknown>,
          argsMap: Map<number, { id?: string; name?: string; args: string }>,
        ) => unknown;
      };

      const first = access.handleStreamEvent(
        'response.function_call_arguments.delta',
        {
          output_index: 1,
          delta: '{"path":"/tmp',
          item: {
            type: 'function_call',
            call_id: 'call_1',
            name: 'read_file',
          },
        },
        toolCallArgs,
      );
      expect(first).toBeNull();

      const second = access.handleStreamEvent(
        'response.function_call_arguments.delta',
        {
          output_index: 1,
          delta: '/a.txt"}',
        },
        toolCallArgs,
      );
      expect(second).toBeNull();

      const done = access.handleStreamEvent(
        'response.output_item.done',
        {
          output_index: 1,
          item_id: 'item_1',
          item: {
            type: 'function_call',
          },
        },
        toolCallArgs,
      ) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              functionCall?: {
                id: string;
                name: string;
                args: Record<string, unknown>;
              };
            }>;
          };
        }>;
      };

      const functionCall =
        done?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
      expect(functionCall).toEqual({
        id: 'call_1',
        name: 'read_file',
        args: { path: '/tmp/a.txt' },
      });
    });

    it('should keep compatibility with legacy response.tool_calls.delta', () => {
      const toolCallArgs = new Map<number, { id?: string; name?: string; args: string }>();

      const access = generator as unknown as {
        handleStreamEvent: (
          event: string,
          data: Record<string, unknown>,
          argsMap: Map<number, { id?: string; name?: string; args: string }>,
        ) => unknown;
      };

      const delta = access.handleStreamEvent(
        'response.tool_calls.delta',
        {
          tool_call_index: 0,
          tool_call_id: 'call_legacy',
          delta: '{"query":"rdmind"}',
          item: {
            type: 'function_call',
            name: 'search',
          },
        },
        toolCallArgs,
      );
      expect(delta).toBeNull();

      const done = access.handleStreamEvent(
        'response.output_item.done',
        {
          tool_call_index: 0,
          item_id: 'item_legacy',
          item: {
            type: 'function_call',
          },
        },
        toolCallArgs,
      ) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              functionCall?: {
                id: string;
                name: string;
                args: Record<string, unknown>;
              };
            }>;
          };
        }>;
      };

      const functionCall =
        done?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
      expect(functionCall).toEqual({
        id: 'call_legacy',
        name: 'search',
        args: { query: 'rdmind' },
      });
    });
  });
});
