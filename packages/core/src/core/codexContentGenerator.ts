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
  GenerateContentResponse,
  type Tool,
  type CallableTool,
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

// ============================================================================
// Codex API 类型定义 (Microsoft AI Foundry Create Response Protocol)
// ============================================================================

interface CodexMessage {
  role?: 'user' | 'assistant' | 'developer';
  type?: 'function_call' | 'function_call_output';
  name?: string;
  arguments?: string;
  call_id?: string;
  content?: string;
  output?: string;
}

interface CodexTool {
  type: 'function';
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

interface CodexRequest {
  model: string;
  input: string | CodexMessage[];
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
  tools?: CodexTool[];
}

interface CodexResponseUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface CodexResponse {
  id: string;
  status: string;
  usage?: CodexResponseUsage;
  output?: Array<{
    type: 'message' | 'reasoning' | 'function_call';
    id?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type: 'text'; text: string }>;
    summary?: Array<{ text: string }>;
  }>;
}

// SSE 事件类型
type CodexEventType =
  | 'response.reasoning_summary_text.delta'
  | 'response.output_text.delta'
  | 'response.tool_calls.delta'
  | 'response.output_item.done'
  | 'response.completed';

interface CodexStreamEvent {
  event: CodexEventType;
  data: {
    item_id?: string;
    delta?: string;
    tool_call_index?: number;
    tool_call_id?: string;
    item?: {
      type: string;
      id?: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    };
    response?: CodexResponse;
  };
}

// ============================================================================
// CodexContentGenerator 实现
// ============================================================================

export class CodexContentGenerator implements ContentGenerator {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly samplingParams?: ContentGeneratorConfig['samplingParams'];
  private readonly reasoning?: ContentGeneratorConfig['reasoning'];
  private readonly cliConfig?: Config;
  private readonly errorHandler: ErrorHandler;
  private readonly logger: OpenAILogger;

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

    this.errorHandler = new EnhancedErrorHandler(() => false);
    this.logger = new OpenAILogger(config.openAILoggingDir);
  }

  // ============================================================================
  // 主要 API 方法
  // ============================================================================

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const context = this.createContext(request, userPromptId, false);
    const codexRequest = await this.buildCodexRequest(request);

    try {
      const response = await this.fetchApi(codexRequest);
      const data = (await response.json()) as CodexResponse;

      context.duration = Date.now() - context.startTime;
      const geminiResponse = convertCodexResponseToGemini(data);

      await this.logSuccess(context, geminiResponse, codexRequest, data);
      return geminiResponse;
    } catch (error) {
      context.duration = Date.now() - context.startTime;
      await this.logError(context, error, codexRequest);
      return this.errorHandler.handle(error, context, request);
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const context = this.createContext(request, userPromptId, true);
    const codexRequest = await this.buildCodexRequest(request, true);

    try {
      const response = await this.fetchApi(codexRequest);
      if (!response.body) {
        throw new Error('Response body is null');
      }

      const stream = this.processStream(response.body, context, codexRequest);
      return stream;
    } catch (error) {
      context.duration = Date.now() - context.startTime;
      await this.logError(context, error, codexRequest);
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

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  private createContext(
    request: GenerateContentParameters,
    userPromptId: string,
    isStreaming: boolean,
  ): RequestContext {
    return {
      userPromptId,
      model: request.model,
      authType: 'xhs-sso',
      startTime: Date.now(),
      duration: 0,
      isStreaming,
    };
  }

  private async fetchApi(request: CodexRequest): Promise<Response> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Codex API request failed: ${response.status} - ${errorText}`);
    }

    return response;
  }

  private async buildCodexRequest(
    request: GenerateContentParameters,
    stream = false,
  ): Promise<CodexRequest> {
    const model = extractBaseModel(request.model);
    const reasoningEffort = extractReasoningEffort(request.model) ||
      (typeof this.reasoning === 'object' ? this.reasoning?.effort : 'medium');

    // 构建输入消息
    const input = buildCodexInput(request.contents, request.config?.systemInstruction);

    // 构建请求体
    const codexRequest: CodexRequest = {
      model,
      input,
      stream,
      store: true,
      temperature: this.samplingParams?.temperature ?? 1,
      top_p: this.samplingParams?.top_p,
      max_output_tokens: this.samplingParams?.max_tokens,
      reasoning: {
        effort: reasoningEffort as 'low' | 'medium' | 'high',
        summary: 'detailed',
      },
      text: {
        verbosity: 'medium',
      },
    };

    // 添加工具定义
    const tools = await convertTools(request.config?.tools);
    if (tools.length > 0) {
      codexRequest.tools = tools;
    }

    return codexRequest;
  }

  private async *processStream(
    body: ReadableStream<Uint8Array>,
    context: RequestContext,
    request: CodexRequest,
  ): AsyncGenerator<GenerateContentResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent: CodexEventType | '' = '';

    // 用于累积工具调用参数
    const toolCallArgs: Map<number, { id?: string; name?: string; args: string }> = new Map();

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

          // 解析事件类型
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim() as CodexEventType;
            continue;
          }

          // 解析数据
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') return;

            try {
              const data = JSON.parse(dataStr);
              const response = this.handleStreamEvent(
                currentEvent,
                data,
                toolCallArgs,
              );
              if (response) {
                yield response;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 流结束，记录成功日志
      context.duration = Date.now() - context.startTime;
      await this.logStreamingSuccess(context, request);
    } catch (error) {
      context.duration = Date.now() - context.startTime;
      await this.logError(context, error, request);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  private handleStreamEvent(
    event: CodexEventType | '',
    data: CodexStreamEvent['data'],
    toolCallArgs: Map<number, { id?: string; name?: string; args: string }>,
  ): GenerateContentResponse | null {
    switch (event) {
      case 'response.reasoning_summary_text.delta': {
        const text = data.delta;
        if (!text) return null;
        return createGeminiResponse(data.item_id || 'unknown', [
          { text, thought: true } as Part,
        ]);
      }

      case 'response.output_text.delta': {
        const text = data.delta;
        if (!text) return null;
        return createGeminiResponse(data.item_id || 'unknown', [{ text }]);
      }

      case 'response.tool_calls.delta': {
        const index = data.tool_call_index ?? 0;
        const current = toolCallArgs.get(index) || { args: '' };

        if (data.tool_call_id) current.id = data.tool_call_id;
        if (data.item?.name) current.name = data.item.name;
        if (data.delta) current.args += data.delta;

        toolCallArgs.set(index, current);
        return null; // 工具调用增量不立即返回
      }

      case 'response.output_item.done': {
        const item = data.item;
        if (item?.type === 'function_call' && item.arguments) {
          try {
            const args = JSON.parse(item.arguments);
            return createGeminiResponse(data.item_id || 'unknown', [
              {
                functionCall: {
                  id: item.call_id || item.id || `call_${Date.now()}`,
                  name: item.name || 'unknown',
                  args,
                },
              },
            ]);
          } catch {
            // JSON 解析失败，忽略
          }
        }
        return null;
      }

      case 'response.completed': {
        const response = data.response;
        return createGeminiResponse(
          response?.id || 'final',
          [],
          FinishReason.STOP,
          response?.usage
            ? {
                promptTokenCount: response.usage.prompt_tokens,
                candidatesTokenCount: response.usage.completion_tokens,
                totalTokenCount: response.usage.total_tokens,
              }
            : undefined,
        );
      }

      default:
        return null;
    }
  }

  // ============================================================================
  // 日志方法
  // ============================================================================

  private async logSuccess(
    context: RequestContext,
    response: GenerateContentResponse,
    request?: unknown,
    rawResponse?: unknown,
  ): Promise<void> {
    if (!this.cliConfig) return;

    const event = new ApiResponseEvent(
      response.responseId || 'unknown',
      context.model,
      context.duration,
      context.userPromptId,
      context.authType,
      response.usageMetadata as GenerateContentResponseUsageMetadata | undefined,
    );
    logApiResponse(this.cliConfig, event);

    if (request && rawResponse) {
      await this.logger.logInteraction(request, rawResponse);
    }
  }

  private async logError(
    context: RequestContext,
    error: unknown,
    request?: unknown,
  ): Promise<void> {
    if (!this.cliConfig) return;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const apiError = error as { requestID?: string; type?: string; code?: string | number };

    const event = new ApiErrorEvent(
      apiError?.requestID || 'unknown',
      context.model,
      errorMessage,
      context.duration,
      context.userPromptId,
      context.authType,
      apiError?.type,
      apiError?.code,
    );
    logApiError(this.cliConfig, event);

    if (request) {
      await this.logger.logInteraction(request, undefined, error as Error);
    }
  }

  private async logStreamingSuccess(
    context: RequestContext,
    request: unknown,
  ): Promise<void> {
    if (!this.cliConfig) return;

    const event = new ApiResponseEvent(
      'unknown',
      context.model,
      context.duration,
      context.userPromptId,
      context.authType,
      undefined,
    );
    logApiResponse(this.cliConfig, event);

    await this.logger.logInteraction(request, { streamed: true });
  }
}

// ============================================================================
// 纯转换函数
// ============================================================================

function extractBaseModel(model: string): string {
  // 处理 model(effort) 格式，如 gpt-5-codex(high)
  const match = model.match(/^(.+?)\((\w+)\)$/);
  return match ? match[1] : model;
}

function extractReasoningEffort(model: string): 'low' | 'medium' | 'high' | undefined {
  const match = model.match(/^(.+?)\((\w+)\)$/);
  if (!match) return undefined;

  const level = match[2].toLowerCase();
  if (level === 'low' || level === 'medium' || level === 'high') {
    return level;
  }
  return undefined;
}

function buildCodexInput(
  contents: unknown,
  systemInstruction?: unknown,
): string | CodexMessage[] {
  const messages: CodexMessage[] = [];

  // 处理系统指令
  if (systemInstruction) {
    const text = extractTextFromContent(systemInstruction);
    if (text) {
      messages.push({ role: 'developer', content: text });
    }
  }

  // 处理内容
  const contentsArray = Array.isArray(contents) ? contents : [contents];
  for (const content of contentsArray) {
    const codexMessages = convertContentToCodexMessages(content);
    messages.push(...codexMessages);
  }

  // 如果只有一条用户消息，简化返回字符串
  if (messages.length === 1 && messages[0].role === 'user') {
    return messages[0].content!;
  }

  return messages;
}

function convertContentToCodexMessages(content: unknown): CodexMessage[] {
  const messages: CodexMessage[] = [];

  if (!content) return messages;

  // 处理字符串类型
  if (typeof content === 'string') {
    if (content.trim()) {
      messages.push({ role: 'user', content });
    }
    return messages;
  }

  if (typeof content !== 'object') return messages;

  const obj = content as Record<string, unknown>;
  const role = obj['role'] === 'model' ? 'assistant' : 'user';

  // 处理 parts 数组
  if ('parts' in obj && Array.isArray(obj['parts'])) {
    const parts = obj['parts'] as Array<unknown>;

    for (const part of parts) {
      if (typeof part !== 'object' || !part) continue;

      const partObj = part as Record<string, unknown>;

      // 处理文本内容
      if ('text' in partObj && typeof partObj['text'] === 'string') {
        const text = partObj['text'];
        // 忽略 thought 类型的文本（推理内容）
        if (!partObj['thought']) {
          messages.push({ role, content: text });
        }
      }

      // 处理 functionCall - 转换为 function_call 类型消息（必须在 function_call_output 之前）
      if ('functionCall' in partObj && partObj['functionCall']) {
        const funcCall = partObj['functionCall'] as {
          id?: string;
          name: string;
          args?: Record<string, unknown>;
        };

        messages.push({
          type: 'function_call',
          call_id: funcCall.id || `call_${funcCall.name}`,
          name: funcCall.name,
          arguments: JSON.stringify(funcCall.args || {}),
        });
      }

      // 处理 functionResponse - 转换为 function_call_output
      if ('functionResponse' in partObj && partObj['functionResponse']) {
        const funcResp = partObj['functionResponse'] as {
          id?: string;
          name: string;
          response: unknown;
        };

        const output = typeof funcResp.response === 'string'
          ? funcResp.response
          : JSON.stringify(funcResp.response);

        messages.push({
          type: 'function_call_output',
          call_id: funcResp.id || funcResp.name,
          output,
        });
      }
    }
  }

  return messages;
}

function extractTextFromContent(content: unknown): string {
  if (!content) return '';

  if (typeof content === 'string') {
    return content;
  }

  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>;

    // 处理 parts 数组
    if ('parts' in obj && Array.isArray(obj['parts'])) {
      return obj['parts']
        .map((part) => {
          if (typeof part === 'string') return part;
          if (typeof part === 'object' && part && 'text' in part) {
            return (part as { text?: string }).text || '';
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }

    // 处理直接的 text 属性
    if ('text' in obj) {
      return String(obj['text'] || '');
    }
  }

  return '';
}

async function convertTools(toolList: unknown[] | undefined): Promise<CodexTool[]> {
  if (!toolList || toolList.length === 0) {
    return [];
  }

  const tools: CodexTool[] = [];

  for (const tool of toolList) {
    let actualTool: Tool | undefined;

    // 处理 CallableTool（异步获取工具定义）
    if (tool && typeof tool === 'object' && 'tool' in tool) {
      actualTool = await (tool as CallableTool).tool();
    } else {
      actualTool = tool as Tool;
    }

    if (!actualTool?.functionDeclarations) continue;

    for (const func of actualTool.functionDeclarations) {
      if (!func.name || !func.description) continue;

      let parameters: Record<string, unknown> | undefined;

      if (func.parametersJsonSchema) {
        parameters = func.parametersJsonSchema as Record<string, unknown>;
      } else if (func.parameters) {
        parameters = convertGeminiSchemaToOpenAI(func.parameters as Record<string, unknown>);
      }

      tools.push({
        type: 'function',
        name: func.name,
        description: func.description,
        parameters,
      });
    }
  }

  return tools;
}

function convertGeminiSchemaToOpenAI(
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const converted = JSON.parse(JSON.stringify(parameters));

  const convertTypes = (obj: unknown): unknown => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(convertTypes);

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'type' && typeof value === 'string') {
        result[key] = value.toLowerCase();
      } else if (typeof value === 'object') {
        result[key] = convertTypes(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  return convertTypes(converted) as Record<string, unknown>;
}

function convertCodexResponseToGemini(response: CodexResponse): GenerateContentResponse {
  const parts: Part[] = [];

  if (response.output && Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type === 'reasoning' && item.summary) {
        const text = item.summary.map((s) => s.text).filter(Boolean).join('');
        if (text) {
          parts.push({ text, thought: true } as Part);
        }
      } else if (item.type === 'message' && item.content) {
        const text = item.content.map((c) => c.text).filter(Boolean).join('');
        if (text) {
          parts.push({ text });
        }
      } else if (item.type === 'function_call' && item.arguments) {
        try {
          const args = JSON.parse(item.arguments);
          parts.push({
            functionCall: {
              id: item.call_id || item.id || `call_${Date.now()}`,
              name: item.name || 'unknown',
              args,
            },
          });
        } catch {
          // JSON 解析失败，忽略
        }
      }
    }
  }

  return createGeminiResponse(
    response.id,
    parts,
    FinishReason.STOP,
    response.usage
      ? {
          promptTokenCount: response.usage.prompt_tokens,
          candidatesTokenCount: response.usage.completion_tokens,
          totalTokenCount: response.usage.total_tokens,
        }
      : undefined,
  );
}

function createGeminiResponse(
  responseId: string,
  parts: Part[],
  finishReason: FinishReason = FinishReason.STOP,
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  },
): GenerateContentResponse {
  const response = new GenerateContentResponse();
  response.responseId = responseId;
  response.candidates = [
    {
      index: 0,
      content: { role: 'model', parts },
      finishReason,
      safetyRatings: [],
    },
  ];
  if (usageMetadata) {
    response.usageMetadata = usageMetadata;
  }
  return response;
}
