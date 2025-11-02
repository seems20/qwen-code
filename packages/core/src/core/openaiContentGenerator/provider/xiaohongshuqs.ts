import OpenAI from 'openai';
import type { Config } from '../../../config/config.js';
import type { ContentGeneratorConfig } from '../../contentGenerator.js';
import { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES } from '../constants.js';
import type { OpenAICompatibleProvider } from './types.js';

/**
 * Xiaohongshu (XHS) provider for OpenAI-compatible APIs
 * Uses api-key header instead of Authorization: Bearer
 */
export class XiaohongshuOpenAICompatibleProvider
  implements OpenAICompatibleProvider
{
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
   * Check if the configuration is for Xiaohongshu provider
   */
  static isXiaohongshuProvider(
    contentGeneratorConfig: ContentGeneratorConfig,
  ): boolean {
    const baseUrl = contentGeneratorConfig.baseUrl;
    if (!baseUrl) {
      return false;
    }
    return (
      baseUrl ===
      'https://maas.devops.xiaohongshu.com/snsexperienceai-q3coder480ba35b-inst/v1'
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

    // For Xiaohongshu, we need to use api-key header instead of Authorization: Bearer
    // We'll create a custom client that overrides the default authentication
    const client = new OpenAI({
      apiKey: '', // Don't use the default apiKey handling
      baseURL: baseUrl,
      timeout,
      maxRetries,
      defaultHeaders: {
        ...defaultHeaders,
        'api-key': apiKey, // Use api-key header instead of Authorization: Bearer
      },
    });

    return client;
  }

  buildRequest(
    request: OpenAI.Chat.ChatCompletionCreateParams,
    _userPromptId: string,
  ): OpenAI.Chat.ChatCompletionCreateParams {
    // For Xiaohongshu, we might need to normalize the model name to lowercase
    // as the service might expect lowercase model names
    const normalizedRequest = { ...request };

    if (normalizedRequest.model) {
      // Convert model name to lowercase to match the service expectations
      normalizedRequest.model = normalizedRequest.model.toLowerCase();
    }

    // Preserve all original parameters including sampling params
    return normalizedRequest;
  }
}
