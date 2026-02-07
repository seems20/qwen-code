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
  type Part,
  type GenerateContentResponse,
  FinishReason,
} from '@google/genai';
import type {
  ContentGenerator,
  ContentGeneratorConfig,
} from './contentGenerator.js';
import type { Config } from '../config/config.js';
import {
  EnhancedErrorHandler,
  type ErrorHandler,
  type RequestContext,
} from './openaiContentGenerator/errorHandler.js';
import { logApiError, logApiResponse } from '../telemetry/loggers.js';
import { ApiErrorEvent, ApiResponseEvent } from '../telemetry/types.js';
import { OpenAILogger } from '../utils/openaiLogger.js';
import type { GenerateContentResponseUsageMetadata } from '@google/genai';

// --- Microsoft AI Foundry Create Response (Preview) 协议类型定义 ---

interface ChatResponseMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

interface ChatResponseRequest {
  model: string;
  input: string | ChatResponseMessage[];
  instructions?: string;
  max_output_tokens?: number;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  reasoning?: {
    effort: 'low' | 'medium' | 'high';
    summary?: 'none' | 'concise' | 'detailed';
  };
  text?: {
    verbosity?: 'low' | 'medium' | 'high';
  };
  store?: boolean;
}

/**
 * 对应事件: response.completed
 */
interface ChatResponseCompletedChunk {
  type: string;
  response?: {
    id: string;
    status: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    output?: Array<{
      type: string;
      content?: Array<{
        type: string;
        text?: string;
      }>;
    }>;
  };
}

// --- Telemetry & Logging ---

interface TelemetryService {
  logSuccess(
    context: RequestContext,
    response: GenerateContentResponse,
    request?: unknown,
    rawResponse?: unknown,
  ): Promise<void>;

  logError(
    context: RequestContext,
    error: unknown,
    request?: unknown,
  ): Promise<void>;

  logStreamingSuccess(
    context: RequestContext,
    responses: GenerateContentResponse[],
    request?: unknown,
    combinedResponse?: unknown,
  ): Promise<void>;
}

class DefaultTelemetryService implements TelemetryService {
  private logger: OpenAILogger;

  constructor(
    private config: Config,
    private enableLogging: boolean = false,
    loggingDir?: string,
  ) {
    this.logger = new OpenAILogger(loggingDir);
  }

  async logSuccess(
    context: RequestContext,
    response: GenerateContentResponse,
    request?: unknown,
    rawResponse?: unknown,
  ): Promise<void> {
    const responseEvent = new ApiResponseEvent(
      response.responseId || 'unknown',
      context.model,
      context.duration,
      context.userPromptId,
      context.authType,
      response.usageMetadata as
        | GenerateContentResponseUsageMetadata
        | undefined,
    );

    logApiResponse(this.config, responseEvent);

    if (this.enableLogging && request && rawResponse) {
      await this.logger.logInteraction(request, rawResponse);
    }
  }

  async logError(
    context: RequestContext,
    error: unknown,
    request?: unknown,
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const apiError = error as {
      requestID?: string;
      type?: string;
      code?: string | number;
    };

    const errorEvent = new ApiErrorEvent(
      apiError?.requestID || 'unknown',
      context.model,
      errorMessage,
      context.duration,
      context.userPromptId,
      context.authType,
      apiError?.type,
      apiError?.code,
    );
    logApiError(this.config, errorEvent);

    if (this.enableLogging && request) {
      await this.logger.logInteraction(request, undefined, error as Error);
    }
  }

  async logStreamingSuccess(
    context: RequestContext,
    responses: GenerateContentResponse[],
    request?: unknown,
    combinedResponse?: unknown,
  ): Promise<void> {
    const finalUsageMetadata = responses
      .slice()
      .reverse()
      .find((r) => r.usageMetadata)?.usageMetadata;

    const lastResponse = responses[responses.length - 1];
    const responseEvent = new ApiResponseEvent(
      lastResponse?.responseId || 'unknown',
      context.model,
      context.duration,
      context.userPromptId,
      context.authType,
      finalUsageMetadata as GenerateContentResponseUsageMetadata | undefined,
    );

    logApiResponse(this.config, responseEvent);

    if (this.enableLogging && request && combinedResponse) {
      await this.logger.logInteraction(request, combinedResponse);
    }
  }
}

/**
 * CodexContentGenerator 实现 Microsoft Chat Response 协议 (Preview 版本对齐)
 */
export class CodexContentGenerator implements ContentGenerator {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly samplingParams?: ContentGeneratorConfig['samplingParams'];
  private readonly reasoning?: ContentGeneratorConfig['reasoning'];
  private readonly cliConfig?: Config;
  private telemetryService: TelemetryService;
  private errorHandler: ErrorHandler;

  constructor(config: ContentGeneratorConfig, cliConfig?: Config) {
    this.baseUrl = config.baseUrl || '';
    this.apiKey = config.apiKey || '';
    this.samplingParams = config.samplingParams;
    this.reasoning = config.reasoning;
    this.cliConfig = cliConfig;

    if (!this.apiKey) {
      throw new Error('API key is required for Codex');
    }

    if (!this.baseUrl) {
      throw new Error('Base URL is required for Codex');
    }

    if (this.cliConfig) {
      this.telemetryService = new DefaultTelemetryService(
        this.cliConfig,
        config.enableOpenAILogging,
        config.openAILoggingDir,
      );
    } else {
      this.telemetryService = {
        logSuccess: async () => {},
        logError: async () => {},
        logStreamingSuccess: async () => {},
      };
    }

    this.errorHandler = new EnhancedErrorHandler(() => false);
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const startTime = Date.now();
    const context: RequestContext = {
      userPromptId,
      model: request.model,
      authType: 'xhs-sso',
      startTime,
      duration: 0,
      isStreaming: false,
    };

    try {
      const body = await this.convertToChatResponseRequest(request);
      const response = await this.fetchApi(
        this.baseUrl,
        body,
        request.config?.abortSignal,
      );
      const data = (await response.json()) as ChatResponseCompletedChunk;

      context.duration = Date.now() - startTime;
      const geminiResponse = this.convertChatResponseToGemini(data);
      await this.telemetryService.logSuccess(
        context,
        geminiResponse,
        body,
        data,
      );

      return geminiResponse;
    } catch (error) {
      context.duration = Date.now() - startTime;
      await this.telemetryService.logError(context, error, request);
      return this.errorHandler.handle(error, context, request);
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const startTime = Date.now();
    const context: RequestContext = {
      userPromptId,
      model: request.model,
      authType: 'xhs-sso',
      startTime,
      duration: 0,
      isStreaming: true,
    };

    try {
      const baseBody = await this.convertToChatResponseRequest(request);
      const body: ChatResponseRequest = {
        ...baseBody,
        stream: true,
      };

      const response = await this.fetchApi(
        this.baseUrl,
        body,
        request.config?.abortSignal,
      );

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const stream = this.handleStream(response.body);
      const collectedResponses: GenerateContentResponse[] = [];

      return async function* (this: CodexContentGenerator) {
        try {
          for await (const chunk of stream) {
            collectedResponses.push(chunk);
            yield chunk;
          }
          context.duration = Date.now() - startTime;
          const combinedResponse = this.combineResponses(collectedResponses);

          await this.telemetryService.logStreamingSuccess(
            context,
            collectedResponses,
            body,
            combinedResponse,
          );
        } catch (error) {
          context.duration = Date.now() - startTime;
          await this.telemetryService.logError(context, error, body);
          throw error;
        }
      }.call(this);
    } catch (error) {
      context.duration = Date.now() - startTime;
      await this.telemetryService.logError(context, error, request);
      return this.errorHandler.handle(error, context, request);
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    const content = JSON.stringify(request.contents);
    return { totalTokens: Math.ceil(content.length / 4) };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('EmbedContent not implemented for Codex');
  }

  useSummarizedThinking(): boolean {
    return false;
  }

  private async fetchApi(
    url: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
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
        `Codex API request failed: ${response.status} - ${errorText}`,
      );
    }

    return response;
  }

  private async convertToChatResponseRequest(
    request: GenerateContentParameters,
  ): Promise<ChatResponseRequest> {
    const inputMessages: ChatResponseMessage[] = [];
    let instructions: string | undefined;

    if (request.config?.systemInstruction) {
      const instruction = request.config.systemInstruction;
      if (typeof instruction === 'string') {
        instructions = instruction;
      } else if (
        instruction &&
        'parts' in instruction &&
        Array.isArray(instruction.parts)
      ) {
        instructions = instruction.parts
          .map((p) => ('text' in p ? p.text : ''))
          .filter(Boolean)
          .join('\n');
      }
    }

    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];
    for (const content of contents) {
      const typedContent = content as { parts: unknown; role: string };
      const parts = typedContent.parts;
      if (!Array.isArray(parts)) continue;

      const role = typedContent.role === 'model' ? 'assistant' : 'user';
      const text = parts
        .map((p: { text?: string }) => ('text' in p ? p.text : ''))
        .filter(Boolean)
        .join('\n');

      inputMessages.push({ role, content: text });
    }

    const { reasoningEffort } = this.parseModelWithReasoningEffort(
      request.model,
    );

    // 精准对齐您提供的 curl 参数
    const reasoningEffortConfig =
      typeof this.reasoning === 'object' ? this.reasoning?.effort : undefined;

    const chatRequest: ChatResponseRequest = {
      model: 'gpt-5-codex',
      input: inputMessages,
      instructions,
      temperature: this.samplingParams?.temperature ?? 1,
      top_p: this.samplingParams?.top_p,
      reasoning: {
        effort:
          reasoningEffort ||
          (reasoningEffortConfig as 'low' | 'medium' | 'high') ||
          'medium',
        summary: 'detailed',
      },
      text: {
        verbosity: 'medium',
      },
      store: true,
    };

    if (this.samplingParams?.max_tokens) {
      chatRequest.max_output_tokens = this.samplingParams.max_tokens;
    }

    return chatRequest;
  }

  private parseModelWithReasoningEffort(model: string): {
    baseModel: string;
    reasoningEffort: 'low' | 'medium' | 'high' | undefined;
  } {
    const match = model.match(/^(.+?)\((\w+)\)$/);
    if (!match) return { baseModel: model, reasoningEffort: undefined };

    const [, baseModel, levelStr] = match;
    const lowerLevel = levelStr.toLowerCase();

    let reasoningEffort: 'low' | 'medium' | 'high' | undefined;
    if (lowerLevel === 'low') reasoningEffort = 'low';
    else if (lowerLevel === 'medium') reasoningEffort = 'medium';
    else if (lowerLevel === 'high') reasoningEffort = 'high';

    return { baseModel, reasoningEffort };
  }

  private convertChatResponseToGemini(
    data: ChatResponseCompletedChunk,
  ): GenerateContentResponse {
    const parts: Part[] = [];
    const response = data.response;

    if (response?.output && Array.isArray(response.output)) {
      for (const item of response.output) {
        const typedItem = item as {
          type: string;
          summary?: Array<{ text: string }>;
          content?: Array<{ text: string }>;
        };
        if (typedItem.type === 'reasoning') {
          // 推理内容解析
          const summaryArr = typedItem.summary;
          if (Array.isArray(summaryArr)) {
            const summaryText = summaryArr
              .map((s) => s.text)
              .filter(Boolean)
              .join('');
            if (summaryText) {
              // 关键：确保标记为 thought，并且作为第一个 Part
              parts.push({ text: summaryText, thought: true } as Part);
            }
          }
        } else if (typedItem.type === 'message') {
          // 正文回复解析
          const contentArr = typedItem.content;
          if (Array.isArray(contentArr)) {
            const text = contentArr
              .map((c) => c.text)
              .filter(Boolean)
              .join('');
            if (text) {
              parts.push({ text });
            }
          }
        }
      }
    }

    const result: Partial<GenerateContentResponse> = {
      responseId: response?.id || 'unknown',
      candidates: [
        {
          index: 0,
          content: { role: 'model', parts },
          finishReason: FinishReason.STOP,
          safetyRatings: [],
        },
      ],
      usageMetadata: response?.usage
        ? {
            promptTokenCount: response.usage.prompt_tokens,
            candidatesTokenCount: response.usage.completion_tokens,
            totalTokenCount: response.usage.total_tokens,
          }
        : undefined,
    };

    return result as GenerateContentResponse;
  }

  private async *handleStream(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<GenerateContentResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastEvent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: ')) {
            lastEvent = trimmed.slice(7).trim();
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') return;

            try {
              const data = JSON.parse(dataStr);

              // 严格遵循 Foundry 协议：
              // reasoning_summary_text.delta 事件流式传输推理/思考过程
              // output_text.delta 事件流式传输最终回复
              if (lastEvent === 'response.reasoning_summary_text.delta') {
                const text = data.delta;
                if (text) {
                  yield {
                    responseId: data.item_id || 'unknown',
                    candidates: [
                      {
                        index: 0,
                        content: {
                          role: 'model',
                          parts: [{ text, thought: true }],
                        },
                        finishReason: undefined,
                        safetyRatings: [],
                      },
                    ],
                  } as unknown as GenerateContentResponse;
                }
              } else if (lastEvent === 'response.output_text.delta') {
                const text = data.delta;
                if (text) {
                  yield {
                    responseId: data.item_id || 'unknown',
                    candidates: [
                      {
                        index: 0,
                        content: { role: 'model', parts: [{ text }] },
                        safetyRatings: [],
                      },
                    ],
                  } as unknown as GenerateContentResponse;
                }
              } else if (lastEvent === 'response.completed') {
                const response = data.response;
                const usage = response?.usage;
                const parts: Part[] = [];

                // 从 response.output 中提取 reasoning 和 message 内容
                if (response?.output && Array.isArray(response.output)) {
                  for (const item of response.output) {
                    const typedItem = item as {
                      type: string;
                      summary?: Array<{ text: string }>;
                    };
                    if (typedItem.type === 'reasoning') {
                      // 提取思考内容
                      const summaryArr = typedItem.summary;
                      if (Array.isArray(summaryArr)) {
                        const summaryText = summaryArr
                          .map((s) => s.text)
                          .filter(Boolean)
                          .join('');
                        if (summaryText) {
                          parts.push({
                            text: summaryText,
                            thought: true,
                          } as Part);
                        }
                      }
                    } else if (typedItem.type === 'message') {
                      // 正文内容已经在 output_text.delta 事件中流式返回
                      // 这里不需要重复添加
                    }
                  }
                }

                yield {
                  responseId: response?.id || 'final',
                  usageMetadata: usage
                    ? {
                        promptTokenCount: usage.prompt_tokens,
                        candidatesTokenCount: usage.completion_tokens,
                        totalTokenCount: usage.total_tokens,
                      }
                    : undefined,
                  candidates: [
                    {
                      index: 0,
                      content: { role: 'model', parts },
                      finishReason: FinishReason.STOP,
                      safetyRatings: [],
                    },
                  ],
                } as unknown as GenerateContentResponse;
                return;
              }
            } catch (_e) {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private combineResponses(
    responses: GenerateContentResponse[],
  ): GenerateContentResponse {
    if (responses.length === 0) return {} as GenerateContentResponse;
    const last = responses[responses.length - 1];

    const thoughtParts: Part[] = [];
    const textParts: Part[] = [];

    for (const r of responses) {
      const parts = r.candidates?.[0]?.content?.parts;
      if (parts && Array.isArray(parts)) {
        for (const p of parts) {
          if ('thought' in p && (p as { thought: boolean }).thought) {
            thoughtParts.push(p);
          } else {
            textParts.push(p);
          }
        }
      }
    }

    // 合并同类型的 Part
    // 注意：思考内容应该放在正文内容前面
    const combinedParts: Part[] = [];
    if (thoughtParts.length > 0) {
      combinedParts.push({
        text: thoughtParts.map((p) => (p as { text: string }).text).join(''),
        thought: true,
      } as Part);
    }
    if (textParts.length > 0) {
      combinedParts.push({
        text: textParts.map((p) => (p as { text: string }).text).join(''),
      });
    }

    const result: Partial<GenerateContentResponse> = {
      ...last,
      candidates: last.candidates
        ? [
            {
              ...last.candidates[0],
              content: { role: 'model', parts: combinedParts },
            },
          ]
        : undefined,
    };

    return result as GenerateContentResponse;
  }
}
