/**
 * @license
 * Copyright 2025 RedNote
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiContentGenerator } from './geminiContentGenerator.js';
import type { ContentGeneratorConfig } from './contentGenerator.js';
import type { GenerateContentParameters } from '@google/genai';
import type { Config } from '../config/config.js';

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Config
const mockConfig = {
  getProxy: vi.fn(),
  getUsageStatisticsEnabled: vi.fn().mockReturnValue(false),
  getSessionId: vi.fn().mockReturnValue('test-session-id'),
  getChatRecordingService: vi.fn().mockReturnValue(null),
} as unknown as Config;

describe('GeminiContentGenerator Integration Tests', () => {
  let generator: GeminiContentGenerator;
  let mockContentGeneratorConfig: ContentGeneratorConfig;

  beforeEach(() => {
    mockContentGeneratorConfig = {
      model: 'gemini-3-pro-preview',
      apiKey: 'fake-test-api-key', // Use a fake key for testing
    } as ContentGeneratorConfig;
    generator = new GeminiContentGenerator(
      mockContentGeneratorConfig,
      mockConfig,
    );

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchApi', () => {
    it('should make a request successfully', async () => {
      // Mock a successful response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ text: 'Hello!' }],
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      // Access private method getRequestUrl
      const url = generator.getRequestUrl('generateContent');
      const body = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };

      // Access private method fetchApi
      const response = await generator.fetchApi(url, body);

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toBeDefined();
      expect(data.candidates).toBeDefined();

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('generateContent', () => {
    it('should generate content successfully', async () => {
      // Mock a successful response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          candidates: [
            {
              content: {
                parts: [{ text: 'Generated response' }],
              },
            },
          ],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const request: GenerateContentParameters = {
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };

      const response = await generator.generateContent(request, 'test-id');

      expect(response).toBeDefined();
      expect(response.candidates).toBeDefined();
      expect(response.candidates?.length).toBeGreaterThan(0);

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('generateContentStream', () => {
    it('should return a stream without throwing errors', async () => {
      // Create a simple mock response with a body that has a getReader method
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      const mockBody = {
        getReader: () => mockReader,
      };

      const mockResponse = {
        ok: true,
        body: mockBody,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const request: GenerateContentParameters = {
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };

      // Simply test that the method doesn't throw an error when called
      const streamPromise = generator.generateContentStream(request, 'test-id');

      // Verify that it returns a promise that resolves to an async generator
      await expect(streamPromise).resolves.toBeDefined();

      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should parse model with low thinking level correctly', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      const mockBody = {
        getReader: () => mockReader,
      };

      const mockResponse = {
        ok: true,
        body: mockBody,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const request: GenerateContentParameters = {
        model: 'gemini-3-pro-preview(low)',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };

      await generator.generateContentStream(request, 'test-id');

      // Verify fetch was called with correct body containing thinkingConfig
      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      // The model name should be stripped of the thinking level suffix
      // and thinkingConfig should be set
      expect(requestBody.generationConfig?.thinkingConfig?.thinkingLevel).toBe(
        'LOW',
      );
    });

    it('should parse model with high thinking level correctly', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      const mockBody = {
        getReader: () => mockReader,
      };

      const mockResponse = {
        ok: true,
        body: mockBody,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const request: GenerateContentParameters = {
        model: 'gemini-3-pro-preview(high)',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };

      await generator.generateContentStream(request, 'test-id');

      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.generationConfig?.thinkingConfig?.thinkingLevel).toBe(
        'HIGH',
      );
    });

    it('should handle model without thinking level suffix', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      const mockBody = {
        getReader: () => mockReader,
      };

      const mockResponse = {
        ok: true,
        body: mockBody,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const request: GenerateContentParameters = {
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };

      await generator.generateContentStream(request, 'test-id');

      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      // Should have THINKING_LEVEL_UNSPECIFIED for models without suffix
      expect(requestBody.generationConfig?.thinkingConfig?.thinkingLevel).toBe(
        'THINKING_LEVEL_UNSPECIFIED',
      );
    });
  });
});
