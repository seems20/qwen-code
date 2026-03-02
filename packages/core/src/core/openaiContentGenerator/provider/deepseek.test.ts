/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepSeekOpenAICompatibleProvider } from './deepseek.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import type { Config } from '../../../config/config.js';

// Mock OpenAI client to avoid real network calls
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation((config) => ({
    config,
  })),
}));

describe('DeepSeekOpenAICompatibleProvider', () => {
  let mockContentGeneratorConfig: ContentGeneratorConfig;
  let mockCliConfig: Config;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContentGeneratorConfig = {
      apiKey: 'test-api-key',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    } as ContentGeneratorConfig;

    mockCliConfig = {
      getCliVersion: vi.fn().mockReturnValue('1.0.0'),
    } as unknown as Config;
  });

  describe('isDeepSeekProvider', () => {
    it('returns true when model name includes deepseek', () => {
      const result = DeepSeekOpenAICompatibleProvider.isDeepSeekProvider(
        mockContentGeneratorConfig,
      );
      expect(result).toBe(true);
    });

    it('returns false for non deepseek model', () => {
      const config = {
        ...mockContentGeneratorConfig,
        model: 'gpt-4',
      } as ContentGeneratorConfig;

      const result =
        DeepSeekOpenAICompatibleProvider.isDeepSeekProvider(config);
      expect(result).toBe(false);
    });
  });

  describe('getDefaultGenerationConfig', () => {
    it('returns temperature 0', () => {
      const provider = new DeepSeekOpenAICompatibleProvider(
        mockContentGeneratorConfig,
        mockCliConfig,
      );
      expect(provider.getDefaultGenerationConfig()).toEqual({
        temperature: 0,
      });
    });

    it('inherits buildRequest from parent without modifications', () => {
      const provider = new DeepSeekOpenAICompatibleProvider(
        mockContentGeneratorConfig,
        mockCliConfig,
      );
      expect(provider.buildRequest).toBeDefined();
    });
  });
});
