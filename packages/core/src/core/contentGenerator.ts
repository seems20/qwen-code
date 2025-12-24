/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import { DEFAULT_QWEN_MODEL } from '../config/models.js';
import type { Config } from '../config/config.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  useSummarizedThinking(): boolean;
}

export enum AuthType {
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  USE_OPENAI = 'openai',
  QWEN_OAUTH = 'qwen-oauth',
  XHS_SSO = 'xhs-sso',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  enableOpenAILogging?: boolean;
  openAILoggingDir?: string;
  timeout?: number; // Timeout configuration in milliseconds
  maxRetries?: number; // Maximum retries for failed requests
  disableCacheControl?: boolean; // Disable cache control for DashScope providers
  samplingParams?: {
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    temperature?: number;
    max_tokens?: number;
  };
  reasoning?: {
    effort?: 'low' | 'medium' | 'high';
  };
  proxy?: string | undefined;
  userAgent?: string;
  // Schema compliance mode for tool definitions
  schemaCompliance?: 'auto' | 'openapi_30';
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
  generationConfig?: Partial<ContentGeneratorConfig>,
): ContentGeneratorConfig {
  const newContentGeneratorConfig: Partial<ContentGeneratorConfig> = {
    ...(generationConfig || {}),
    authType,
    proxy: config?.getProxy(),
  };

  if (authType === AuthType.QWEN_OAUTH) {
    // For Qwen OAuth, we'll handle the API key dynamically in createContentGenerator
    // Set a special marker to indicate this is Qwen OAuth
    return {
      ...newContentGeneratorConfig,
      model: DEFAULT_QWEN_MODEL,
      apiKey: 'QWEN_OAUTH_DYNAMIC_TOKEN',
    } as ContentGeneratorConfig;
  }

  if (authType === AuthType.USE_OPENAI) {
    if (!newContentGeneratorConfig.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    return {
      ...newContentGeneratorConfig,
      model: newContentGeneratorConfig?.model || 'qwen3-coder-plus',
    } as ContentGeneratorConfig;
  }

  if (authType === AuthType.XHS_SSO) {
    // XHS SSO 使用 OpenAI 兼容的客户端
    // apiKey、baseUrl、model 应该已经在 settings.json 中配置好了
    if (!newContentGeneratorConfig.apiKey) {
      throw new Error('小红书 SSO API key is required');
    }

    return {
      ...newContentGeneratorConfig,
      model: newContentGeneratorConfig?.model || 'qwen3-coder-plus',
    } as ContentGeneratorConfig;
  }

  return {
    ...newContentGeneratorConfig,
    model: newContentGeneratorConfig?.model || DEFAULT_QWEN_MODEL,
  } as ContentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  isInitialAuth?: boolean,
): Promise<ContentGenerator> {
  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    const { createGeminiContentGenerator } = await import(
      './geminiContentGenerator/index.js'
    );
    return createGeminiContentGenerator(config, gcConfig);
  }

  if (config.authType === AuthType.USE_OPENAI) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Import OpenAIContentGenerator dynamically to avoid circular dependencies
    const { createOpenAIContentGenerator } = await import(
      './openaiContentGenerator/index.js'
    );

    // Always use OpenAIContentGenerator, logging is controlled by enableOpenAILogging flag
    return createOpenAIContentGenerator(config, gcConfig);
  }

  if (config.authType === AuthType.QWEN_OAUTH) {
    // Import required classes dynamically
    const { getQwenOAuthClient: getQwenOauthClient } = await import(
      '../qwen/qwenOAuth2.js'
    );
    const { QwenContentGenerator } = await import(
      '../qwen/qwenContentGenerator.js'
    );

    try {
      // Get the Qwen OAuth client (now includes integrated token management)
      // If this is initial auth, require cached credentials to detect missing credentials
      const qwenClient = await getQwenOauthClient(
        gcConfig,
        isInitialAuth ? { requireCachedCredentials: true } : undefined,
      );

      // Create the content generator with dynamic token management
      return new QwenContentGenerator(qwenClient, config, gcConfig);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (config.authType === AuthType.XHS_SSO) {
    // API Key 和配置在启动时已经写入 settings.json
    if (!config.apiKey) {
      throw new Error(
        '小红书 SSO 认证未完成：缺少 API Key。请重新启动应用完成认证。',
      );
    }

    // 根据模型名称选择不同的 ContentGenerator
    const model = config.model.toLowerCase();
    if (model.startsWith('gemini')) {
      const { GeminiContentGenerator } = await import(
        './geminiContentGenerator.js'
      );
      const { LoggingContentGenerator } = await import(
        './geminiContentGenerator/loggingContentGenerator.js'
      );
      return new LoggingContentGenerator(
        new GeminiContentGenerator(config, gcConfig),
        gcConfig,
      );
    }

    // 默认使用 OpenAI 兼容客户端
    const { createOpenAIContentGenerator } = await import(
      './openaiContentGenerator/index.js'
    );

    return createOpenAIContentGenerator(config, gcConfig);
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
