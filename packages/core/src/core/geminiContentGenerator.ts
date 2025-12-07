/**
 * @license
 * Copyright 2025 RedNote
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CountTokensParameters,
  type CountTokensResponse,
  type EmbedContentParameters,
  type EmbedContentResponse,
  type GenerateContentParameters,
  type GenerateContentResponse,
  ThinkingLevel,
} from '@google/genai';
import type { UserTierId } from '../code_assist/types.js';
import type {
  ContentGenerator,
  ContentGeneratorConfig,
} from './contentGenerator.js';
import type { Config } from '../config/config.js';
import {
  DefaultTelemetryService,
  type RequestContext,
  type TelemetryService,
} from './openaiContentGenerator/index.js';
import {
  EnhancedErrorHandler,
  type ErrorHandler,
} from './openaiContentGenerator/index.js';

export class GeminiContentGenerator implements ContentGenerator {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly samplingParams?: ContentGeneratorConfig['samplingParams'];
  userTier?: UserTierId;
  private telemetryService: TelemetryService;
  private errorHandler: ErrorHandler;

  constructor(
    config: ContentGeneratorConfig,
    cliConfig?: Config, // Optional for backward compatibility
  ) {
    this.baseUrl =
      config.baseUrl || 'https://runway.devops.rednote.life/openai/google/v1';
    this.apiKey = config.apiKey || '';
    this.samplingParams = config.samplingParams;

    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }

    // Initialize TelemetryService and ErrorHandler
    // If cliConfig is not provided, we can't use telemetry properly, but we handle it gracefully
    if (cliConfig) {
      this.telemetryService = new DefaultTelemetryService(
        cliConfig,
        config.enableOpenAILogging,
        config.openAILoggingDir,
      );
    } else {
      // Mock telemetry service if config is missing (e.g. in tests)
      this.telemetryService = {
        logSuccess: async () => {},
        logError: async () => {},
        logStreamingSuccess: async () => {},
      };
    }

    this.errorHandler = new EnhancedErrorHandler(
      (error: unknown, request: GenerateContentParameters) =>
        this.shouldSuppressErrorLogging(error, request),
    );
  }

  /**
   * Hook for subclasses to customize error handling behavior
   * @returns true if error logging should be suppressed, false otherwise
   * @param _error
   * @param _request
   */
  protected shouldSuppressErrorLogging(
    _error: unknown,
    _request: GenerateContentParameters,
  ): boolean {
    return false; // Default behavior: never suppress error logging
  }

  getRequestUrl(action: string): string {
    return this.baseUrl + ':' + action;
  }

  async fetchApi(
    url: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.apiKey, // 尝试适配可能的自定义 Header
    };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response;
  }

  private sanitizeContents(contents: unknown): unknown {
    if (!Array.isArray(contents)) {
      return contents;
    }

    // Check if we should keep IDs (e.g. for OpenAI-compatible proxies)
    // But if the URL contains 'google', it's likely a Gemini endpoint which rejects IDs
    const shouldKeepId =
      this.baseUrl.includes('openai') && !this.baseUrl.includes('google');

    if (shouldKeepId) {
      return contents;
    }

    return contents.map((content: unknown) => {
      if (
        !content ||
        typeof content !== 'object' ||
        !('parts' in content) ||
        !Array.isArray((content as { parts: unknown[] }).parts)
      ) {
        return content;
      }

      const typedContent = content as { parts: unknown[] };
      let partsModified = false;

      const sanitizedParts = typedContent.parts.map((part: unknown) => {
        if (!part || typeof part !== 'object') return part;

        let newPart = part as Record<string, unknown>;
        let partModified = false;

        const keysToCheck = [
          'functionCall',
          'functionResponse',
          'function_call',
          'function_response',
        ];

        for (const key of keysToCheck) {
          if (
            key in newPart &&
            newPart[key] &&
            typeof newPart[key] === 'object' &&
            'id' in (newPart[key] as Record<string, unknown>)
          ) {
            const { id: _id, ...rest } = newPart[key] as {
              id: unknown;
              [key: string]: unknown;
            };
            newPart = { ...newPart, [key]: rest };
            partModified = true;
          }
        }

        if (partModified) {
          partsModified = true;
          return newPart;
        }
        return part;
      });

      if (partsModified) {
        return { ...typedContent, parts: sanitizedParts };
      }
      return typedContent;
    });
  }

  private createRequestBody(request: GenerateContentParameters): {
    body: unknown;
    abortSignal?: AbortSignal;
  } {
    const { systemInstruction, tools, abortSignal, ...generationConfig } =
      request.config || {};

    let formattedSystemInstruction = systemInstruction;
    if (typeof systemInstruction === 'string') {
      formattedSystemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    // Use temperature from config if available, otherwise default to 1
    const temperature = this.samplingParams?.temperature ?? 1;

    return {
      body: {
        contents: this.sanitizeContents(request.contents),
        generationConfig: {
          ...generationConfig,
          temperature,
        },
        tools,
        systemInstruction: formattedSystemInstruction,
      },
      abortSignal: abortSignal as AbortSignal,
    };
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const startTime = Date.now();
    const context: RequestContext = {
      userPromptId,
      model: request.model,
      authType: 'gemini', // Or get from config if available
      startTime,
      duration: 0,
      isStreaming: false,
    };

    try {
      const url = this.getRequestUrl('generateContent');
      const { body, abortSignal } = this.createRequestBody(request);

      const response = await this.fetchApi(url, body, abortSignal);
      const data = (await response.json()) as GenerateContentResponse;

      context.duration = Date.now() - startTime;
      await this.telemetryService.logSuccess(context, data, body, data);

      return data;
    } catch (error) {
      context.duration = Date.now() - startTime;
      await this.telemetryService.logError(context, error, request);
      return this.errorHandler.handle(error, context, request);
    }
  }

  /**
   * 解析模型名称，提取基础模型名和思考等级
   * @param model 完整模型名称，例如 "gemini-3-pro-preview(low)"
   * @returns 包含基础模型名和思考等级的对象
   */
  private parseModelWithThinkingLevel(model: string): {
    baseModel: string;
    thinkingLevel: ThinkingLevel;
  } {
    // 匹配模型名称中括号内的思考等级，例如 "gemini-3-pro-preview(low)"
    const match = model.match(/^(.+?)\((\w+)\)$/);

    if (!match) {
      // 没有括号，返回原始模型名和默认思考等级
      return {
        baseModel: model,
        thinkingLevel: ThinkingLevel.THINKING_LEVEL_UNSPECIFIED,
      };
    }

    const [, baseModel, levelStr] = match;
    const lowerLevel = levelStr.toLowerCase();

    let thinkingLevel: ThinkingLevel;
    if (lowerLevel === 'low') {
      thinkingLevel = ThinkingLevel.LOW;
    } else if (lowerLevel === 'high') {
      thinkingLevel = ThinkingLevel.HIGH;
    } else {
      thinkingLevel = ThinkingLevel.THINKING_LEVEL_UNSPECIFIED;
    }

    return { baseModel, thinkingLevel };
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const startTime = Date.now();
    const context: RequestContext = {
      userPromptId,
      model: request.model,
      authType: 'gemini',
      startTime,
      duration: 0,
      isStreaming: true,
    };

    try {
      const url = this.getRequestUrl('streamGenerateContent');

      // 解析模型名称，提取基础模型名和思考等级
      const { baseModel, thinkingLevel } = this.parseModelWithThinkingLevel(
        request.model,
      );

      // 更新请求中的模型名称为基础模型名
      const updatedRequest: GenerateContentParameters = {
        ...request,
        model: baseModel,
        config: {
          ...request.config,
          thinkingConfig: {
            includeThoughts: true,
            thinkingLevel,
          },
        },
      };

      const { body: requestBody, abortSignal } =
        this.createRequestBody(updatedRequest);

      const response = await this.fetchApi(url, requestBody, abortSignal);

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Use a wrapper generator to capture the stream for logging
      const stream = this.handleStream(response.body);
      const collectedResponses: GenerateContentResponse[] = [];

      return async function* (this: GeminiContentGenerator) {
        try {
          for await (const chunk of stream) {
            collectedResponses.push(chunk);
            yield chunk;
          }
          context.duration = Date.now() - startTime;
          // Construct a combined response for logging
          // Since Gemini response structure is different, we pass the collected responses
          // and let the telemetry service handle it or pass a custom combined object if needed.
          // For now, we can construct a simple combined object similar to what we receive in non-streaming.
          const combinedResponse =
            this.combineGeminiResponses(collectedResponses);

          await this.telemetryService.logStreamingSuccess(
            context,
            collectedResponses,
            requestBody,
            undefined, // openaiChunks
            combinedResponse,
          );
        } catch (error) {
          context.duration = Date.now() - startTime;
          await this.telemetryService.logError(context, error, requestBody);
          throw error;
        }
      }.call(this);
    } catch (error) {
      context.duration = Date.now() - startTime;
      await this.telemetryService.logError(context, error, request);
      return this.errorHandler.handle(error, context, request);
    }
  }

  private combineGeminiResponses(
    responses: GenerateContentResponse[],
  ): GenerateContentResponse {
    if (responses.length === 0) {
      return {} as GenerateContentResponse;
    }

    // Basic combination logic:
    // 1. Use the last response for usageMetadata and finishReason
    // 2. Concatenate text parts
    const lastResponse = responses[responses.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combinedResponse: any = {
      candidates: lastResponse.candidates
        ? [...lastResponse.candidates]
        : undefined,
      usageMetadata: lastResponse.usageMetadata,
    };

    if (combinedResponse.candidates && combinedResponse.candidates.length > 0) {
      let combinedText = '';
      for (const response of responses) {
        if (response.candidates && response.candidates[0].content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.text) {
              combinedText += part.text;
            }
          }
        }
      }
      // Update the content with combined text
      if (combinedResponse.candidates[0].content) {
        combinedResponse.candidates[0].content.parts = [{ text: combinedText }];
      }
    }

    return combinedResponse as GenerateContentResponse;
  }

  private async *handleStream(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<GenerateContentResponse> {
    // 处理 SSE 流
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === ': keep-alive') continue;

          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr) as GenerateContentResponse;
              yield data;
            } catch (_) {
              // Silently ignore parse errors for SSE data
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    const url = this.getRequestUrl('countTokens');
    const response = await this.fetchApi(url, request);
    return (await response.json()) as CountTokensResponse;
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    const url = this.getRequestUrl('embedContent');
    const response = await this.fetchApi(url, request);
    return (await response.json()) as EmbedContentResponse;
  }
}
