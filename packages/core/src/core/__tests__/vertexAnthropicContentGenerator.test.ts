/**
 * @license
 * Copyright 2025 RedNote
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VertexAnthropicContentGenerator } from '../vertexAnthropicContentGenerator.js';
import type { ContentGeneratorConfig } from '../contentGenerator.js';
import { AuthType } from '../contentGenerator.js';

describe('VertexAnthropicContentGenerator', () => {
  let config: ContentGeneratorConfig;

  beforeEach(() => {
    config = {
      model: 'claude-opus-4-5@20251101',
      apiKey: 'test-api-key',
      baseUrl: 'https://runway.devops.rednote.life/openai/google/anthropic/v1',
      authType: AuthType.XHS_SSO,
    };
  });

  it('should construct with valid config', () => {
    expect(() => new VertexAnthropicContentGenerator(config)).not.toThrow();
  });

  it('should throw error when apiKey is missing', () => {
    const invalidConfig = { ...config, apiKey: '' };
    expect(() => new VertexAnthropicContentGenerator(invalidConfig)).toThrow(
      'API key is required',
    );
  });

  it('should throw error when baseUrl is missing', () => {
    const invalidConfig = { ...config, baseUrl: '' };
    expect(() => new VertexAnthropicContentGenerator(invalidConfig)).toThrow(
      'Base URL is required',
    );
  });

  it('should generate correct request URL for rawPredict', () => {
    const generator = new VertexAnthropicContentGenerator(config);
    const url = generator.getRequestUrl('rawPredict');
    expect(url).toBe(
      'https://runway.devops.rednote.life/openai/google/anthropic/v1:rawPredict',
    );
  });

  it('should generate correct request URL for streamRawPredict', () => {
    const generator = new VertexAnthropicContentGenerator(config);
    const url = generator.getRequestUrl('streamRawPredict');
    expect(url).toBe(
      'https://runway.devops.rednote.life/openai/google/anthropic/v1:streamRawPredict',
    );
  });

  it('should return false for useSummarizedThinking', () => {
    const generator = new VertexAnthropicContentGenerator(config);
    expect(generator.useSummarizedThinking()).toBe(false);
  });

  it('should throw error for embedContent', async () => {
    const generator = new VertexAnthropicContentGenerator(config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(generator.embedContent({} as any)).rejects.toThrow(
      'Vertex Anthropic does not support embeddings',
    );
  });
});
