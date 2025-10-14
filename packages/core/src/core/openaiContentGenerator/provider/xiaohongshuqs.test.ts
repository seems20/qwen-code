import { describe, it, expect, vi } from 'vitest';
import { XiaohongshuOpenAICompatibleProvider } from './xiaohongshuqs.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import type { Config } from '../../../config/config.js';

describe('XiaohongshuOpenAICompatibleProvider', () => {
  const mockConfig: Config = {
    getCliVersion: vi.fn().mockReturnValue('1.0.0'),
  } as unknown as Config;

  describe('isXiaohongshuProvider', () => {
    it('should return true for Xiaohongshu base URL', () => {
      const config: ContentGeneratorConfig = {
        model: 'test-model',
        baseUrl: 'https://maas.devops.xiaohongshu.com/snsexperienceai-q3coder480ba35b-inst/v1',
        apiKey: 'test-key',
      };

      expect(XiaohongshuOpenAICompatibleProvider.isXiaohongshuProvider(config)).toBe(true);
    });

    it('should return true for any Xiaohongshu domain', () => {
      const config: ContentGeneratorConfig = {
        model: 'test-model',
        baseUrl: 'https://maas.devops.xiaohongshu.com/other-service/v1',
        apiKey: 'test-key',
      };

      expect(XiaohongshuOpenAICompatibleProvider.isXiaohongshuProvider(config)).toBe(true);
    });

    it('should return false for non-Xiaohongshu URLs', () => {
      const config: ContentGeneratorConfig = {
        model: 'test-model',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
      };

      expect(XiaohongshuOpenAICompatibleProvider.isXiaohongshuProvider(config)).toBe(false);
    });

    it('should return false when baseUrl is undefined', () => {
      const config: ContentGeneratorConfig = {
        model: 'test-model',
        apiKey: 'test-key',
      };

      expect(XiaohongshuOpenAICompatibleProvider.isXiaohongshuProvider(config)).toBe(false);
    });
  });

  describe('buildHeaders', () => {
    it('should include User-Agent and Content-Type headers', () => {
      const config: ContentGeneratorConfig = {
        model: 'test-model',
        baseUrl: 'https://maas.devops.xiaohongshu.com/snsexperienceai-q3coder480ba35b-inst/v1',
        apiKey: 'test-key',
      };

      const provider = new XiaohongshuOpenAICompatibleProvider(config, mockConfig);
      const headers = provider.buildHeaders();

      expect(headers['User-Agent']).toContain('QwenCode/1.0.0');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('buildClient', () => {
    it('should create OpenAI client with api-key header', () => {
      const config: ContentGeneratorConfig = {
        model: 'test-model',
        baseUrl: 'https://maas.devops.xiaohongshu.com/snsexperienceai-q3coder480ba35b-inst/v1',
        apiKey: 'test-api-key',
      };

      const provider = new XiaohongshuOpenAICompatibleProvider(config, mockConfig);
      const client = provider.buildClient();

      expect(client).toBeDefined();
      // The client should be configured with the correct baseURL and headers
      expect(client.baseURL).toBe(config.baseUrl);
    });
  });

  describe('buildRequest', () => {
    it('should normalize model name to lowercase', () => {
      const config: ContentGeneratorConfig = {
        model: 'test-model',
        baseUrl: 'https://maas.devops.xiaohongshu.com/snsexperienceai-q3coder480ba35b-inst/v1',
        apiKey: 'test-key',
      };

      const provider = new XiaohongshuOpenAICompatibleProvider(config, mockConfig);
      
      const request = {
        model: 'Qwen3-Coder-480B-A35B-Instruct',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const result = provider.buildRequest(request, 'test-prompt-id');

      expect(result.model).toBe('qwen3-coder-480b-a35b-instruct');
      expect(result.messages).toEqual(request.messages);
    });

    it('should preserve all other request parameters', () => {
      const config: ContentGeneratorConfig = {
        model: 'test-model',
        baseUrl: 'https://maas.devops.xiaohongshu.com/snsexperienceai-q3coder480ba35b-inst/v1',
        apiKey: 'test-key',
      };

      const provider = new XiaohongshuOpenAICompatibleProvider(config, mockConfig);
      
      const request = {
        model: 'Test-Model',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        temperature: 0.7,
        top_p: 0.8,
        extra_body: {
          top_k: 20,
          repetition_penalty: 1.05,
        },
      };

      const result = provider.buildRequest(request, 'test-prompt-id');

      expect(result.model).toBe('test-model');
      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.8);
      expect((result as any).extra_body).toEqual({
        top_k: 20,
        repetition_penalty: 1.05,
      });
    });
  });
});
