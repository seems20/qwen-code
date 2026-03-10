import type { GenerateContentConfig } from '@google/genai';
import OpenAI from 'openai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES } from '../constants.js';
import type { OpenAICompatibleProvider } from './types.js';

/**
 * Runway provider for OpenAI-compatible APIs (e.g. gpt-5.4 via Rednote life)
 * Uses api-key header instead of Authorization: Bearer.
 */
export class RunwayOpenAICompatibleProvider implements OpenAICompatibleProvider {
  protected contentGeneratorConfig: ContentGeneratorConfig;
  protected cliConfig: Config;

  constructor(
    contentGeneratorConfig: ContentGeneratorConfig,
    cliConfig: Config,
  ) {
    this.cliConfig = cliConfig;
    this.contentGeneratorConfig = contentGeneratorConfig;
  }

  /**
   * Check if the configuration is for Runway provider
   */
  static isRunwayProvider(
    contentGeneratorConfig: ContentGeneratorConfig,
  ): boolean {
    const baseUrl = contentGeneratorConfig.baseUrl;
    if (!baseUrl) {
      return false;
    }
    // 精确匹配 gpt-5.4 使用的 base url 路径，避免误伤该域名下未来可能添加的其他模型协议
    return (
      baseUrl === 'https://runway.devops.rednote.life/openai' ||
      baseUrl === 'https://runway.devops.rednote.life/openai/'
    );
  }

  buildHeaders(): Record<string, string | undefined> {
    const version = this.cliConfig.getCliVersion() || 'unknown';
    const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;
    return {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
    };
  }

  buildClient(): OpenAI {
    const {
      apiKey,
      baseUrl,
      timeout = DEFAULT_TIMEOUT,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = this.contentGeneratorConfig;
    const defaultHeaders = this.buildHeaders();

    const client = new OpenAI({
      apiKey: '', // 禁用标准的 Bearer Token 机制
      baseURL: baseUrl,
      timeout,
      maxRetries,
      defaultHeaders: {
        ...defaultHeaders,
        'api-key': apiKey, // 改用 api-key Header
      },
      defaultQuery: {
        'api-version': '2024-12-01-preview',
      },
    });

    return client;
  }

  buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    _userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    return request;
  }

  getDefaultGenerationConfig(): GenerateContentConfig {
    return {};
  }
}
