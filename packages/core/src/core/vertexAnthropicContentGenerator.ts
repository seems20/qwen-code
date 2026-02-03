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
  type GenerateContentResponseUsageMetadata,
  type Part,
  GenerateContentResponse,
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

// Vertex AI Anthropic API 类型定义
// Anthropic 内容块类型
type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: {
        type: 'base64';
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        data: string;
      };
    }
  | {
      type: 'document';
      source: {
        type: 'base64';
        media_type: 'application/pdf';
        data: string;
      };
    }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string | AnthropicContentBlock[];
    }
  | {
      type: 'thinking';
      thinking: string;
      signature?: string;
    };

interface VertexAnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

// Anthropic 工具定义
interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

interface VertexAnthropicRequest {
  anthropic_version: string;
  messages: VertexAnthropicMessage[];
  max_tokens: number;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  system?: string;
  tools?: AnthropicTool[];
  thinking?: {
    type: 'enabled';
    budget_tokens: number;
  };
}

interface VertexAnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
    thinking?: string;
    signature?: string;  // thinking 块的签名
    // tool_use 类型
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Define TelemetryService interface locally
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
    chunks?: unknown[],
    combinedResponse?: unknown,
  ): Promise<void>;
}

// Local implementation of DefaultTelemetryService
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
      response.usageMetadata as GenerateContentResponseUsageMetadata | undefined,
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
    const apiError = error as { requestID?: string; type?: string; code?: string | number };

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
    _chunks?: unknown[],
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
 * Content Generator for Vertex AI Anthropic API (Claude via Vertex AI)
 * Used for XHS SSO internal proxy that follows Vertex AI's Claude API format
 */
export class VertexAnthropicContentGenerator implements ContentGenerator {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly samplingParams?: ContentGeneratorConfig['samplingParams'];
  private readonly reasoning?: ContentGeneratorConfig['reasoning'];
  private readonly cliConfig?: Config;
  private telemetryService: TelemetryService;
  private errorHandler: ErrorHandler;

  constructor(
    config: ContentGeneratorConfig,
    cliConfig?: Config,
  ) {
    this.baseUrl = config.baseUrl || '';
    this.apiKey = config.apiKey || '';
    this.samplingParams = config.samplingParams;
    this.reasoning = config.reasoning;
    this.cliConfig = cliConfig;

    if (!this.apiKey) {
      throw new Error('API key is required for Vertex Anthropic');
    }

    if (!this.baseUrl) {
      throw new Error('Base URL is required for Vertex Anthropic');
    }

    // Initialize TelemetryService
    if (cliConfig) {
      this.telemetryService = new DefaultTelemetryService(
        cliConfig,
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

    this.errorHandler = new EnhancedErrorHandler(
      (error: unknown, _request: GenerateContentParameters) =>
        this.shouldSuppressErrorLogging(error, _request),
    );
  }

  protected shouldSuppressErrorLogging(
    _error: unknown,
    _request: GenerateContentParameters,
  ): boolean {
    return false;
  }

  getRequestUrl(action: 'rawPredict' | 'streamRawPredict'): string {
    return `${this.baseUrl}:${action}`;
  }

  async fetchApi(
    url: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.apiKey,
    };

    if (this.cliConfig?.getDebugMode()) {
      console.debug(
        `[VertexAnthropicContentGenerator] Request URL: ${url}`,
      );
      console.debug(
        `[VertexAnthropicContentGenerator] Request body:`,
        JSON.stringify(body, null, 2),
      );
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (this.cliConfig?.getDebugMode()) {
        console.error(
          `[VertexAnthropicContentGenerator] API Error (${response.status}):`,
          errorText,
        );
      }
      throw new Error(
        `Vertex Anthropic API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response;
  }

  private async convertGeminiRequestToVertexAnthropic(
    request: GenerateContentParameters,
  ): Promise<VertexAnthropicRequest> {
    const messages: VertexAnthropicMessage[] = [];
    let systemInstruction: string | undefined;

    // Extract system instruction
    if (request.config?.systemInstruction) {
      if (typeof request.config.systemInstruction === 'string') {
        systemInstruction = request.config.systemInstruction;
      } else if (
        'parts' in request.config.systemInstruction &&
        Array.isArray(request.config.systemInstruction.parts)
      ) {
        systemInstruction = request.config.systemInstruction.parts
          .filter((p) => typeof p === 'object' && 'text' in p)
          .map((p) => (p as { text: string }).text)
          .join('\n');
      }
    }

    // Convert contents to messages
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];

    for (const content of contents) {
      if (typeof content === 'string') {
        messages.push({ role: 'user', content });
      } else if ('role' in content && 'parts' in content && content.parts) {
        const role = content.role === 'model' ? 'assistant' : 'user';
        const contentBlocks = this.convertPartsToAnthropicBlocks(content.parts);

        if (contentBlocks.length > 0) {
          // 如果只有一个文本块，使用简单字符串格式
          if (
            contentBlocks.length === 1 &&
            contentBlocks[0].type === 'text'
          ) {
            messages.push({ role, content: contentBlocks[0].text });
          } else {
            // 多个块或包含图片，使用数组格式
            messages.push({ role, content: contentBlocks });
          }
        }
      }
    }

    // Use temperature from config if available
    const temperature = this.samplingParams?.temperature ?? 1;

    // 先计算 thinking 配置，因为 max_tokens 必须大于 budget_tokens
    const thinking = this.buildThinkingConfig(request);

    // 确保 max_tokens > budget_tokens
    // Anthropic 要求：max_tokens 必须大于 thinking.budget_tokens
    // 参考 SDK 版本默认值：max_tokens = 10_000，但 thinking 时需要更大的值
    // Claude 的输出上限是 128K，thinking 时建议 max_tokens = budget_tokens + 16_000
    const defaultMaxTokens = thinking 
      ? thinking.budget_tokens + 16_000  // 思考模式：budget + 16K 用于输出
      : 10_000;                          // 非思考模式：与 SDK 保持一致
    const maxTokens = this.samplingParams?.max_tokens ?? defaultMaxTokens;

    const vertexRequest: VertexAnthropicRequest = {
      anthropic_version: 'vertex-2023-10-16',
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (systemInstruction) {
      vertexRequest.system = systemInstruction;
    }

    if (this.samplingParams?.top_p !== undefined) {
      vertexRequest.top_p = this.samplingParams.top_p;
    }

    if (this.samplingParams?.top_k !== undefined) {
      vertexRequest.top_k = this.samplingParams.top_k;
    }

    // 添加 thinking 配置
    if (thinking) {
      vertexRequest.thinking = thinking;
    }

    // 添加工具定义
    if (request.config?.tools && request.config.tools.length > 0) {
      const tools = await this.convertGeminiToolsToAnthropic(
        request.config.tools as unknown[],
      );
      if (tools.length > 0) {
        vertexRequest.tools = tools;
      }
    }

    return vertexRequest;
  }

  private buildThinkingConfig(
    request: GenerateContentParameters,
  ): { type: 'enabled'; budget_tokens: number } | undefined {
    // 如果请求中明确禁用思考
    if (request.config?.thinkingConfig?.includeThoughts === false) {
      return undefined;
    }

    const reasoning = this.reasoning;

    // 如果配置中禁用思考
    if (reasoning === false) {
      return undefined;
    }

    // 如果配置了具体的 budget_tokens
    if (reasoning?.budget_tokens !== undefined) {
      return {
        type: 'enabled',
        budget_tokens: reasoning.budget_tokens,
      };
    }

    // 根据 effort 级别设置 budget_tokens
    // 与 SDK 版本保持一致：默认启用思考模式（使用 medium effort）
    const effort = reasoning?.effort ?? 'medium';
    const budgetTokens =
      effort === 'low' ? 16_000 : effort === 'high' ? 64_000 : 32_000;

    return {
      type: 'enabled',
      budget_tokens: budgetTokens,
    };
  }

  /**
   * 将 Gemini Part 数组转换为 Anthropic 内容块数组
   */
  private convertPartsToAnthropicBlocks(parts: Part[]): AnthropicContentBlock[] {
    const blocks: AnthropicContentBlock[] = [];

    for (const part of parts) {
      const block = this.convertPartToAnthropicBlock(part);
      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  /**
   * 将单个 Gemini Part 转换为 Anthropic 内容块
   */
  private convertPartToAnthropicBlock(part: Part): AnthropicContentBlock | null {
    // 处理思考块（assistant 的思考内容）
    if ('text' in part && 'thought' in part && part.thought) {
      const thinkingBlock: AnthropicContentBlock = {
        type: 'thinking',
        thinking: part.text || '',
      };
      if ('thoughtSignature' in part && typeof part.thoughtSignature === 'string') {
        (thinkingBlock as { signature?: string }).signature = part.thoughtSignature;
      }
      return thinkingBlock;
    }

    // 处理普通文本（非思考）
    if ('text' in part && part.text && !('thought' in part && part.thought)) {
      return { type: 'text', text: part.text };
    }

    // 处理内联数据（图片、PDF 等）
    if (part.inlineData?.mimeType && part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType;

      // 支持的图片类型
      if (this.isSupportedImageMimeType(mimeType)) {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as
              | 'image/jpeg'
              | 'image/png'
              | 'image/gif'
              | 'image/webp',
            data: part.inlineData.data,
          },
        };
      }

      // PDF 文档
      if (mimeType === 'application/pdf') {
        return {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: part.inlineData.data,
          },
        };
      }

      // 不支持的类型，添加提示文本
      const displayName = part.inlineData.displayName
        ? ` (${part.inlineData.displayName})`
        : '';
      return {
        type: 'text',
        text: `[Unsupported media type: ${mimeType}${displayName}]`,
      };
    }

    // 处理文件 URL（如果有的话）
    if (part.fileData?.mimeType && part.fileData?.fileUri) {
      // Anthropic 不直接支持 URL，添加提示
      return {
        type: 'text',
        text: `[External file reference: ${part.fileData.fileUri}]`,
      };
    }

    // 处理 functionCall（assistant 发出的工具调用）
    if ('functionCall' in part && part.functionCall) {
      return {
        type: 'tool_use',
        id: part.functionCall.id || `tool_${Date.now()}`,
        name: part.functionCall.name || '',
        input: (part.functionCall.args as Record<string, unknown>) || {},
      };
    }

    // 处理 functionResponse（用户返回的工具结果）
    if ('functionResponse' in part && part.functionResponse) {
      const response = part.functionResponse;
      let content: string | AnthropicContentBlock[];
      
      if (response.response) {
        // 如果有 response 对象，序列化为 JSON
        content = JSON.stringify(response.response);
      } else {
        content = '';
      }

      return {
        type: 'tool_result',
        tool_use_id: response.id || '',
        content,
      };
    }

    return null;
  }

  /**
   * 检查是否是 Anthropic 支持的图片类型
   */
  private isSupportedImageMimeType(
    mimeType: string,
  ): mimeType is 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
    return (
      mimeType === 'image/jpeg' ||
      mimeType === 'image/png' ||
      mimeType === 'image/gif' ||
      mimeType === 'image/webp'
    );
  }

  /**
   * 将 Gemini 工具定义转换为 Anthropic 格式
   * 参考 AnthropicContentConverter.convertGeminiToolsToAnthropic
   */
  private async convertGeminiToolsToAnthropic(
    geminiTools: unknown[],
  ): Promise<AnthropicTool[]> {
    const tools: AnthropicTool[] = [];

    if (!geminiTools) {
      return tools;
    }

    for (const tool of geminiTools) {
      // 处理 CallableTool（延迟加载的工具）
      let actualTool: { functionDeclarations?: Array<{
        name?: string;
        description?: string;
        parametersJsonSchema?: Record<string, unknown>;
        parameters?: Record<string, unknown>;
      }> };

      const toolObj = tool as Record<string, unknown>;
      if ('tool' in toolObj && typeof toolObj['tool'] === 'function') {
        actualTool = await (toolObj['tool'] as () => Promise<typeof actualTool>)();
      } else {
        actualTool = tool as typeof actualTool;
      }

      if (!actualTool.functionDeclarations) {
        continue;
      }

      for (const func of actualTool.functionDeclarations) {
        if (!func.name) continue;

        let inputSchema: Record<string, unknown> | undefined;
        if (func.parametersJsonSchema) {
          inputSchema = {
            ...(func.parametersJsonSchema as Record<string, unknown>),
          };
        } else if (func.parameters) {
          inputSchema = func.parameters as Record<string, unknown>;
        }

        if (!inputSchema) {
          inputSchema = { type: 'object', properties: {} };
        }

        // 确保 type 是 'object'
        if (typeof inputSchema['type'] !== 'string') {
          inputSchema['type'] = 'object';
        }

        tools.push({
          name: func.name,
          description: func.description,
          input_schema: inputSchema as AnthropicTool['input_schema'],
        });
      }
    }

    return tools;
  }

  private convertVertexAnthropicResponseToGemini(
    response: VertexAnthropicResponse,
  ): GenerateContentResponse {
    const parts: Part[] = [];

    for (const content of response.content) {
      if (content.type === 'text' && content.text) {
        parts.push({ text: content.text } as Part);
      } else if (content.type === 'thinking' && content.thinking) {
        const thinkingPart: Part = { text: content.thinking, thought: true } as Part;
        if (content.signature) {
          (thinkingPart as { thoughtSignature?: string }).thoughtSignature = content.signature;
        }
        parts.push(thinkingPart);
      } else if (content.type === 'tool_use' && content.name && content.id) {
        // 转换 tool_use 为 Gemini 格式的 functionCall
        parts.push({
          functionCall: {
            name: content.name,
            args: content.input || {},
            id: content.id,
          },
        } as Part);
      }
    }

    // Create a proper GenerateContentResponse object
    const result: Partial<GenerateContentResponse> = {
      responseId: response.id,
      modelVersion: response.model,
      candidates: [
        {
          content: {
            parts,
            role: 'model',
          },
          index: 0,
          finishReason: this.mapFinishReason(response.stop_reason),
          safetyRatings: [],
        },
      ],
      promptFeedback: { safetyRatings: [] },
      usageMetadata: {
        promptTokenCount: response.usage.input_tokens,
        candidatesTokenCount: response.usage.output_tokens,
        totalTokenCount: response.usage.input_tokens + response.usage.output_tokens,
      },
    };

    return result as GenerateContentResponse;
  }

  private mapFinishReason(stopReason: string | null): FinishReason | undefined {
    if (!stopReason) {
      return undefined; // 流式传输中，没有 stop_reason 时返回 undefined
    }
    
    switch (stopReason) {
      case 'end_turn':
        return FinishReason.STOP;
      case 'max_tokens':
        return FinishReason.MAX_TOKENS;
      case 'stop_sequence':
        return FinishReason.STOP;
      case 'tool_use':
        return FinishReason.STOP;
      default:
        return FinishReason.OTHER;
    }
  }

  /**
   * 安全解析 JSON，失败时返回默认值
   */
  private safeJsonParse<T>(jsonStr: string, defaultValue: T): T {
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      return defaultValue;
    }
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
      const url = this.getRequestUrl('rawPredict');
      const body = await this.convertGeminiRequestToVertexAnthropic(request);

      const response = await this.fetchApi(
        url,
        body,
        request.config?.abortSignal,
      );
      const data = (await response.json()) as VertexAnthropicResponse;

      context.duration = Date.now() - startTime;
      const geminiResponse = this.convertVertexAnthropicResponseToGemini(data);
      await this.telemetryService.logSuccess(context, geminiResponse, body, data);

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
      const url = this.getRequestUrl('streamRawPredict');
      const baseBody = await this.convertGeminiRequestToVertexAnthropic(request);
      const body = {
        ...baseBody,
        stream: true,
      };

      const response = await this.fetchApi(
        url,
        body,
        request.config?.abortSignal,
      );

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const stream = this.handleStream(response.body);
      const collectedResponses: GenerateContentResponse[] = [];

      return async function* (this: VertexAnthropicContentGenerator) {
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
            undefined,
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

  private combineResponses(
    responses: GenerateContentResponse[],
  ): GenerateContentResponse {
    if (responses.length === 0) {
      return {} as GenerateContentResponse;
    }

    const lastResponse = responses[responses.length - 1];
    let combinedText = '';
    
    for (const response of responses) {
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if ('text' in part && part.text) {
            combinedText += part.text;
          }
        }
      }
    }

    return {
      ...lastResponse,
      candidates: lastResponse.candidates
        ? [
            {
              ...lastResponse.candidates[0],
              content: {
                ...lastResponse.candidates[0].content,
                parts: [{ text: combinedText }],
              },
            },
          ]
        : undefined,
    } as GenerateContentResponse;
  }

  private async *handleStream(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<GenerateContentResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    // 参考 AnthropicContentGenerator.processStream 的实现
    let messageId: string | undefined;
    let model = '';
    let cachedTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let finishReason: string | undefined;

    // 跟踪 content blocks 状态（用于处理 tool_use 和 thinking）
    const blocks = new Map<
      number,
      { type: string; id?: string; name?: string; inputJson: string; signature: string }
    >();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (!trimmedLine) {
            currentEvent = '';
            continue;
          }

          if (trimmedLine.startsWith('event: ')) {
            currentEvent = trimmedLine.slice(7).trim();
            continue;
          }

          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.slice(6).trim();
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              // Anthropic SSE 格式：event 行和 data.type 可能都包含事件类型
              // 优先使用 data.type，因为它更可靠
              const eventType = data.type || currentEvent;

              switch (eventType) {
                case 'message_start': {
                  if (data.message) {
                    messageId = data.message.id ?? messageId;
                    model = data.message.model ?? model;
                    if (data.message.usage) {
                      cachedTokens = data.message.usage.cache_read_input_tokens ?? 0;
                      promptTokens = data.message.usage.input_tokens ?? 0;
                    }
                  }
                  break;
                }

                case 'content_block_start': {
                  // 初始化 content block 状态
                  const index = data.index ?? 0;
                  const type = String(data.content_block?.type || 'text');
                  const initialInput =
                    type === 'tool_use' && data.content_block?.input
                      ? JSON.stringify(data.content_block.input)
                      : '';
                  // 思考块可能有初始 signature
                  const initialSignature =
                    type === 'thinking' && data.content_block?.signature
                      ? String(data.content_block.signature)
                      : '';

                  if (this.cliConfig?.getDebugMode() && type === 'tool_use') {
                    console.debug(
                      `[VertexAnthropicContentGenerator] Tool use block start:`,
                      JSON.stringify({
                        index,
                        id: data.content_block?.id,
                        name: data.content_block?.name,
                        initialInput,
                      }),
                    );
                  }

                  blocks.set(index, {
                    type,
                    id:
                      type === 'tool_use'
                        ? String(data.content_block?.id || '')
                        : undefined,
                    name:
                      type === 'tool_use'
                        ? String(data.content_block?.name || '')
                        : undefined,
                    // SDK 兼容：如果初始 input 是空对象 {}，则设为空字符串
                    // 实际参数通过后续的 input_json_delta 事件发送
                    inputJson: initialInput !== '{}' ? initialInput : '',
                    signature: initialSignature,
                  });
                  break;
                }

                case 'content_block_delta': {
                  const deltaType = data.delta?.type;
                  const index = data.index ?? 0;
                  
                  if (deltaType === 'text_delta' && data.delta?.text) {
                    const chunk = this.buildGeminiChunk(
                      { text: data.delta.text },
                      messageId,
                      model,
                    );
                    yield chunk;
                  } else if (deltaType === 'thinking_delta' && data.delta?.thinking) {
                    const chunk = this.buildGeminiChunk(
                      { text: data.delta.thinking, thought: true },
                      messageId,
                      model,
                    );
                    yield chunk;
                  } else if (deltaType === 'input_json_delta' && data.delta?.partial_json) {
                    // 累积 tool_use 的 JSON 输入
                    const blockState = blocks.get(index);
                    if (blockState) {
                      blockState.inputJson += data.delta.partial_json;
                      if (this.cliConfig?.getDebugMode()) {
                        console.debug(
                          `[VertexAnthropicContentGenerator] input_json_delta:`,
                          data.delta.partial_json,
                        );
                      }
                    }
                  } else if (deltaType === 'signature_delta' && data.delta?.signature) {
                    // 累积 thinking 块的签名
                    const blockState = blocks.get(index);
                    if (blockState) {
                      blockState.signature += data.delta.signature;
                      const chunk = this.buildGeminiChunk(
                        { thought: true, thoughtSignature: data.delta.signature },
                        messageId,
                        model,
                      );
                      yield chunk;
                    }
                  }
                  break;
                }

                case 'content_block_stop': {
                  // content block 结束，如果是 tool_use 则发出 functionCall
                  const index = data.index ?? 0;
                  const blockState = blocks.get(index);
                  if (blockState?.type === 'tool_use') {
                    const args = this.safeJsonParse(blockState.inputJson || '{}', {});

                    if (this.cliConfig?.getDebugMode()) {
                      console.debug(
                        `[VertexAnthropicContentGenerator] Tool use block stop:`,
                        JSON.stringify({
                          index,
                          id: blockState.id,
                          name: blockState.name,
                          inputJson: blockState.inputJson,
                          parsedArgs: args,
                        }),
                      );
                    }

                    const chunk = this.buildGeminiChunk(
                      {
                        functionCall: {
                          id: blockState.id,
                          name: blockState.name,
                          args,
                        },
                      },
                      messageId,
                      model,
                    );
                    yield chunk;
                  }
                  blocks.delete(index);
                  break;
                }

                case 'message_delta': {
                  if (data.delta?.stop_reason) {
                    finishReason = data.delta.stop_reason;
                  }
                  if (data.usage?.output_tokens !== undefined) {
                    completionTokens = data.usage.output_tokens;
                  }

                  // 发送带 finishReason 和 usage 的响应
                  if (finishReason || data.usage) {
                    const chunk = this.buildGeminiChunk(
                      undefined,
                      messageId,
                      model,
                      finishReason,
                      {
                        cachedContentTokenCount: cachedTokens,
                        promptTokenCount: cachedTokens + promptTokens,
                        candidatesTokenCount: completionTokens,
                        totalTokenCount: cachedTokens + promptTokens + completionTokens,
                      },
                    );
                    yield chunk;
                  }
                  break;
                }

                case 'message_stop': {
                  // 最终响应
                  if (promptTokens || completionTokens) {
                    const chunk = this.buildGeminiChunk(
                      undefined,
                      messageId,
                      model,
                      finishReason,
                      {
                        cachedContentTokenCount: cachedTokens,
                        promptTokenCount: cachedTokens + promptTokens,
                        candidatesTokenCount: completionTokens,
                        totalTokenCount: cachedTokens + promptTokens + completionTokens,
                      },
                    );
                    yield chunk;
                  }
                  break;
                }

                default:
                  break;
              }
            } catch (error) {
              if (this.cliConfig?.getDebugMode()) {
                console.error(
                  `[VertexAnthropicContentGenerator] Failed to parse SSE data:`,
                  dataStr,
                  error,
                );
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private buildGeminiChunk(
    part?: {
      text?: string;
      thought?: boolean;
      thoughtSignature?: string;
      functionCall?: {
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      };
    },
    responseId?: string,
    model?: string,
    finishReason?: string,
    usageMetadata?: {
      cachedContentTokenCount?: number;
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    },
  ): GenerateContentResponse {
    const response = new GenerateContentResponse();
    response.responseId = responseId;
    response.createTime = Date.now().toString();
    response.modelVersion = model || '';
    response.promptFeedback = { safetyRatings: [] };

    let candidateParts: Part[] = [];
    if (part) {
      if (part.functionCall) {
        // 处理 functionCall
        candidateParts = [
          {
            functionCall: {
              name: part.functionCall.name || '',
              args: part.functionCall.args || {},
              id: part.functionCall.id,
            },
          } as Part,
        ];
      } else {
        // 处理 text/thought
        candidateParts = [part as unknown as Part];
      }
    }
    const mappedFinishReason = finishReason 
      ? this.mapFinishReason(finishReason)
      : undefined;

    response.candidates = [
      {
        content: {
          parts: candidateParts,
          role: 'model' as const,
        },
        index: 0,
        safetyRatings: [],
        ...(mappedFinishReason ? { finishReason: mappedFinishReason } : {}),
      },
    ];

    if (usageMetadata) {
      response.usageMetadata = usageMetadata;
    }

    return response;
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Simple estimation based on content length
    const content = JSON.stringify(request.contents);
    const totalTokens = Math.ceil(content.length / 4);
    return { totalTokens };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw new Error('Vertex Anthropic does not support embeddings.');
  }

  useSummarizedThinking(): boolean {
    return false;
  }
}
