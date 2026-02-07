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
import type { Config } from '../config/config.js';
import { LoggingContentGenerator } from './loggingContentGenerator/index.js';
import type {
  ConfigSource,
  ConfigSourceKind,
  ConfigSources,
} from '../utils/configResolver.js';
import {
  getDefaultApiKeyEnvVar,
  getDefaultModelEnvVar,
  MissingAnthropicBaseUrlEnvError,
  MissingApiKeyError,
  MissingBaseUrlError,
  MissingModelError,
  StrictMissingCredentialsError,
  StrictMissingModelIdError,
} from '../models/modelConfigErrors.js';
import { PROVIDER_SOURCED_FIELDS } from '../models/modelsConfig.js';

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
  USE_OPENAI = 'openai',
  QWEN_OAUTH = 'qwen-oauth',
  XHS_SSO = 'xhs-sso',
  USE_GEMINI = 'gemini',
  USE_VERTEX_AI = 'vertex-ai',
  USE_ANTHROPIC = 'anthropic',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  apiKeyEnvKey?: string;
  baseUrl?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  enableOpenAILogging?: boolean;
  openAILoggingDir?: string;
  timeout?: number; // Timeout configuration in milliseconds
  maxRetries?: number; // Maximum retries for failed requests
  enableCacheControl?: boolean; // Enable cache control for DashScope providers
  samplingParams?: {
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    temperature?: number;
    max_tokens?: number;
  };
  reasoning?:
    | false
    | {
        effort?: 'low' | 'medium' | 'high';
        budget_tokens?: number;
      };
  proxy?: string | undefined;
  userAgent?: string;
  // Schema compliance mode for tool definitions
  schemaCompliance?: 'auto' | 'openapi_30';
  // Context window size override. If set to a positive number, it will override
  // the automatic detection. Leave undefined to use automatic detection.
  contextWindowSize?: number;
  // Custom HTTP headers to be sent with requests
  customHeaders?: Record<string, string>;
  // Extra body parameters to be merged into the request body
  extra_body?: Record<string, unknown>;
};

// Keep the public ContentGeneratorConfigSources API, but reuse the generic
// source-tracking types from utils/configResolver to avoid duplication.
export type ContentGeneratorConfigSourceKind = ConfigSourceKind;
export type ContentGeneratorConfigSource = ConfigSource;
export type ContentGeneratorConfigSources = ConfigSources;

export type ResolvedContentGeneratorConfig = {
  config: ContentGeneratorConfig;
  sources: ContentGeneratorConfigSources;
};

function setSource(
  sources: ContentGeneratorConfigSources,
  path: string,
  source: ContentGeneratorConfigSource,
): void {
  sources[path] = source;
}

function getSeedSource(
  seed: ContentGeneratorConfigSources | undefined,
  path: string,
): ContentGeneratorConfigSource | undefined {
  return seed?.[path];
}

/**
 * Resolve ContentGeneratorConfig while tracking the source of each effective field.
 *
 * This function now primarily validates and finalizes the configuration that has
 * already been resolved by ModelConfigResolver. The env fallback logic has been
 * moved to the unified resolver to eliminate duplication.
 *
 * Note: The generationConfig passed here should already be fully resolved with
 * proper source tracking from the caller (CLI/SDK layer).
 */
export function resolveContentGeneratorConfigWithSources(
  config: Config,
  authType: AuthType | undefined,
  generationConfig?: Partial<ContentGeneratorConfig>,
  seedSources?: ContentGeneratorConfigSources,
  options?: { strictModelProvider?: boolean },
): ResolvedContentGeneratorConfig {
  const sources: ContentGeneratorConfigSources = { ...(seedSources || {}) };
  const strictModelProvider = options?.strictModelProvider === true;

  // Build config with computed fields
  const newContentGeneratorConfig: Partial<ContentGeneratorConfig> = {
    ...(generationConfig || {}),
    authType,
    proxy: config?.getProxy(),
  };

  // Set sources for computed fields
  setSource(sources, 'authType', {
    kind: 'computed',
    detail: 'provided by caller',
  });
  if (config?.getProxy()) {
    setSource(sources, 'proxy', {
      kind: 'computed',
      detail: 'Config.getProxy()',
    });
  }

  // Preserve seed sources for fields that were passed in
  const seedOrUnknown = (path: string): ContentGeneratorConfigSource =>
    getSeedSource(seedSources, path) ?? { kind: 'unknown' };

  for (const field of PROVIDER_SOURCED_FIELDS) {
    if (generationConfig && field in generationConfig && !sources[field]) {
      setSource(sources, field, seedOrUnknown(field));
    }
  }

  // Validate required fields based on authType. This does not perform any
  // fallback resolution (resolution is handled by ModelConfigResolver).
  const validation = validateModelConfig(
    newContentGeneratorConfig as ContentGeneratorConfig,
    strictModelProvider,
  );
  if (!validation.valid) {
    throw new Error(validation.errors.map((e) => e.message).join('\n'));
  }

  return {
    config: newContentGeneratorConfig as ContentGeneratorConfig,
    sources,
  };
}

export interface ModelConfigValidationResult {
  valid: boolean;
  errors: Error[];
}

/**
 * Validate a resolved model configuration.
 * This is the single validation entry point used across Core.
 */
export function validateModelConfig(
  config: ContentGeneratorConfig,
  isStrictModelProvider: boolean = false,
): ModelConfigValidationResult {
  const errors: Error[] = [];

  // Qwen OAuth and XHS SSO don't need validation - they use dynamic tokens or pre-configured credentials
  if (
    config.authType === AuthType.QWEN_OAUTH ||
    config.authType === AuthType.XHS_SSO
  ) {
    return { valid: true, errors: [] };
  }

  // API key is required for all other auth types
  if (!config.apiKey) {
    if (isStrictModelProvider) {
      errors.push(
        new StrictMissingCredentialsError(
          config.authType,
          config.model,
          config.apiKeyEnvKey,
        ),
      );
    } else {
      const envKey =
        config.apiKeyEnvKey || getDefaultApiKeyEnvVar(config.authType);
      errors.push(
        new MissingApiKeyError({
          authType: config.authType,
          model: config.model,
          baseUrl: config.baseUrl,
          envKey,
        }),
      );
    }
  }

  // Model is required
  if (!config.model) {
    if (isStrictModelProvider) {
      errors.push(new StrictMissingModelIdError(config.authType));
    } else {
      const envKey = getDefaultModelEnvVar(config.authType);
      errors.push(new MissingModelError({ authType: config.authType, envKey }));
    }
  }

  // Explicit baseUrl is required for Anthropic; Migrated from existing code.
  if (config.authType === AuthType.USE_ANTHROPIC && !config.baseUrl) {
    if (isStrictModelProvider) {
      errors.push(
        new MissingBaseUrlError({
          authType: config.authType,
          model: config.model,
        }),
      );
    } else if (config.authType === AuthType.USE_ANTHROPIC) {
      errors.push(new MissingAnthropicBaseUrlEnvError());
    }
  }

  return { valid: errors.length === 0, errors };
}

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
  generationConfig?: Partial<ContentGeneratorConfig>,
): ContentGeneratorConfig {
  return resolveContentGeneratorConfigWithSources(
    config,
    authType,
    generationConfig,
  ).config;
}

export async function createContentGenerator(
  generatorConfig: ContentGeneratorConfig,
  config: Config,
  isInitialAuth?: boolean,
): Promise<ContentGenerator> {
  const validation = validateModelConfig(generatorConfig, false);
  if (!validation.valid) {
    throw new Error(validation.errors.map((e) => e.message).join('\n'));
  }

  const authType = generatorConfig.authType;
  if (!authType) {
    throw new Error('ContentGeneratorConfig must have an authType');
  }

  let baseGenerator: ContentGenerator;

  if (authType === AuthType.USE_OPENAI) {
    const { createOpenAIContentGenerator } = await import(
      './openaiContentGenerator/index.js'
    );
    baseGenerator = createOpenAIContentGenerator(generatorConfig, config);
  } else if (authType === AuthType.QWEN_OAUTH) {
    const { getQwenOAuthClient: getQwenOauthClient } = await import(
      '../qwen/qwenOAuth2.js'
    );
    const { QwenContentGenerator } = await import(
      '../qwen/qwenContentGenerator.js'
    );

    try {
      const qwenClient = await getQwenOauthClient(
        config,
        isInitialAuth ? { requireCachedCredentials: true } : undefined,
      );
      baseGenerator = new QwenContentGenerator(
        qwenClient,
        generatorConfig,
        config,
      );
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else if (authType === AuthType.XHS_SSO) {
    // API Key 和配置在启动时已经写入 settings.json
    if (!generatorConfig.apiKey) {
      throw new Error(
        '小红书 SSO 认证未完成：缺少 API Key。请重新启动应用完成认证。',
      );
    }

    // 根据模型名称选择不同的 ContentGenerator
    const model = generatorConfig.model.toLowerCase();
    if (model.startsWith('gemini')) {
      // 使用专门为 XHS_SSO 实现的 GeminiContentGenerator
      // 它使用自定义 baseUrl 和 api-key header
      const { GeminiContentGenerator } = await import(
        './geminiContentGenerator.js'
      );
      baseGenerator = new GeminiContentGenerator(generatorConfig, config);
    } else if (model.startsWith('claude')) {
      // 使用 Vertex AI Anthropic API 格式的 Claude 模型
      // 支持 claude-opus-4-5 等 Claude 系列模型
      // 使用 Vertex AI 的 :rawPredict 和 :streamRawPredict 端点
      const { VertexAnthropicContentGenerator } = await import(
        './vertexAnthropicContentGenerator.js'
      );
      baseGenerator = new VertexAnthropicContentGenerator(
        generatorConfig,
        config,
      );
    } else if (model.includes('codex')) {
      // 使用专门为 Codex 系列实现的 ContentGenerator
      // 它遵循 Microsoft Chat Response 协议
      const { CodexContentGenerator } = await import(
        './codexContentGenerator.js'
      );
      baseGenerator = new CodexContentGenerator(generatorConfig, config);
    } else {
      // 默认使用 OpenAI 兼容客户端
      const { createOpenAIContentGenerator } = await import(
        './openaiContentGenerator/index.js'
      );
      baseGenerator = createOpenAIContentGenerator(generatorConfig, config);
    }
  } else if (authType === AuthType.USE_ANTHROPIC) {
    const { createAnthropicContentGenerator } = await import(
      './anthropicContentGenerator/index.js'
    );
    baseGenerator = createAnthropicContentGenerator(generatorConfig, config);
  } else if (
    authType === AuthType.USE_GEMINI ||
    authType === AuthType.USE_VERTEX_AI
  ) {
    const { createGeminiContentGenerator } = await import(
      './geminiContentGenerator/index.js'
    );
    baseGenerator = createGeminiContentGenerator(generatorConfig, config);
  } else {
    throw new Error(
      `Error creating contentGenerator: Unsupported authType: ${authType}`,
    );
  }

  return new LoggingContentGenerator(baseGenerator, config, generatorConfig);
}
