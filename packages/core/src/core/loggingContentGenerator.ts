/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import type {
  Content,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponseUsageMetadata,
  GenerateContentResponse,
} from '@google/genai';
import {
  ApiRequestEvent,
  ApiResponseEvent,
  ApiErrorEvent,
} from '../telemetry/types.js';
import type { Config } from '../config/config.js';
import {
  logApiError,
  logApiRequest,
  logApiResponse,
} from '../telemetry/loggers.js';
import type { ContentGenerator } from './contentGenerator.js';
import { toContents } from '../code_assist/converter.js';
import { isStructuredError } from '../utils/quotaErrorDetection.js';

interface StructuredError {
  status: number;
}

/**
 * A decorator that wraps a ContentGenerator to add logging to API calls.
 */
export class LoggingContentGenerator implements ContentGenerator {
  constructor(
    private readonly wrapped: ContentGenerator,
    private readonly config: Config,
  ) {}

  getWrapped(): ContentGenerator {
    return this.wrapped;
  }

  private logApiRequest(
    contents: Content[],
    model: string,
    promptId: string,
  ): void {
    const requestText = JSON.stringify(contents);
    logApiRequest(
      this.config,
      new ApiRequestEvent(model, promptId, requestText),
    );
  }

  private _logApiResponse(
    responseId: string,
    durationMs: number,
    model: string,
    prompt_id: string,
    usageMetadata?: GenerateContentResponseUsageMetadata,
    responseText?: string,
  ): void {
    logApiResponse(
      this.config,
      new ApiResponseEvent(
        responseId,
        model,
        durationMs,
        prompt_id,
        this.config.getContentGeneratorConfig()?.authType,
        usageMetadata,
        responseText,
      ),
    );
  }

  private _logApiError(
    responseId: string | undefined,
    durationMs: number,
    error: unknown,
    model: string,
    prompt_id: string,
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = error instanceof Error ? error.name : 'unknown';

    logApiError(
      this.config,
      new ApiErrorEvent(
        responseId,
        model,
        errorMessage,
        durationMs,
        prompt_id,
        this.config.getContentGeneratorConfig()?.authType,
        errorType,
        isStructuredError(error)
          ? (error as StructuredError).status
          : undefined,
      ),
    );
  }

  async generateContent(
    req: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const startTime = Date.now();
    // 在请求开始时生成一个 request_id，用于在整个重试过程中保持一致性
    // 如果 API 返回了 responseId，优先使用 API 的 responseId
    const requestId = randomUUID();
    this.logApiRequest(toContents(req.contents), req.model, userPromptId);
    try {
      const response = await this.wrapped.generateContent(req, userPromptId);
      const durationMs = Date.now() - startTime;
      // 优先使用 API 返回的 responseId，如果不存在则使用我们生成的 requestId
      this._logApiResponse(
        response.responseId ?? requestId,
        durationMs,
        req.model,
        userPromptId,
        response.usageMetadata,
        JSON.stringify(response),
      );
      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      // 错误时也使用同一个 requestId
      this._logApiError(requestId, durationMs, error, req.model, userPromptId);
      throw error;
    }
  }

  async generateContentStream(
    req: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const startTime = Date.now();
    // 在请求开始时生成一个 request_id，用于在整个重试过程中保持一致性
    const requestId = randomUUID();
    this.logApiRequest(toContents(req.contents), req.model, userPromptId);

    let stream: AsyncGenerator<GenerateContentResponse>;
    try {
      stream = await this.wrapped.generateContentStream(req, userPromptId);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      // 错误时使用同一个 requestId
      this._logApiError(requestId, durationMs, error, req.model, userPromptId);
      throw error;
    }

    return this.loggingStreamWrapper(
      stream,
      startTime,
      userPromptId,
      req.model,
      requestId,
    );
  }

  private async *loggingStreamWrapper(
    stream: AsyncGenerator<GenerateContentResponse>,
    startTime: number,
    userPromptId: string,
    model: string,
    requestId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    const responses: GenerateContentResponse[] = [];

    let lastUsageMetadata: GenerateContentResponseUsageMetadata | undefined;
    try {
      for await (const response of stream) {
        responses.push(response);
        if (response.usageMetadata) {
          lastUsageMetadata = response.usageMetadata;
        }
        yield response;
      }
      // Only log successful API response if no error occurred
      const durationMs = Date.now() - startTime;
      // 优先使用 API 返回的 responseId，如果不存在则使用我们生成的 requestId
      // 使用原始的 model 参数，保留完整的模型名称（包含思考等级后缀如 "(high)"）
      this._logApiResponse(
        responses[0]?.responseId ?? requestId,
        durationMs,
        model,
        userPromptId,
        lastUsageMetadata,
        JSON.stringify(responses),
      );
    } catch (error) {
      const durationMs = Date.now() - startTime;
      // 错误时使用同一个 requestId
      this._logApiError(requestId, durationMs, error, model, userPromptId);
      throw error;
    }
  }

  async countTokens(req: CountTokensParameters): Promise<CountTokensResponse> {
    return this.wrapped.countTokens(req);
  }

  async embedContent(
    req: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    return this.wrapped.embedContent(req);
  }
}
