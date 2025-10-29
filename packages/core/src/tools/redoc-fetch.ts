/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type {
  ToolCallConfirmationDetails,
  ToolInvocation,
  ToolResult,
} from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolConfirmationOutcome,
} from './tools.js';
import { ApprovalMode, type Config } from '@rdmind/rdmind-core';
import { getResponseText } from '../utils/partUtils.js';
import { DEFAULT_QWEN_MODEL } from '../config/models.js';

const REDOC_API_TIMEOUT_MS = 10000;
const REDOC_API_URL =
  'https://athena-next.devops.xiaohongshu.com/api/media/query/redoc';
const REDOC_URL_PATTERN =
  /^https:\/\/docs\.xiaohongshu\.com\/doc\/([a-f0-9]+)$/;

/**
 * RedocFetch 工具的参数接口
 */
export interface RedocFetchToolParams {
  /**
   * 要获取内容的 Redoc 文档 URL
   */
  url: string;
  /**
   * 用于处理获取内容的提示词
   */
  prompt: string;
}

/**
 * Redoc API 响应接口
 */
interface RedocApiResponse {
  code: number;
  success: boolean;
  msg: string;
  data: {
    content: string;
    title: string;
  };

  [key: string]: unknown;
}

/**
 * RedocFetch 工具调用逻辑的实现
 */
class RedocFetchToolInvocation extends BaseToolInvocation<
  RedocFetchToolParams,
  ToolResult
> {
  constructor(
    private readonly config: Config,
    params: RedocFetchToolParams,
  ) {
    super(params);
  }

  private extractDocIdFromUrl(url: string): string | null {
    const match = url.match(REDOC_URL_PATTERN);
    return match ? match[1] : null;
  }

  private async fetchRedocContent(
    docId: string,
    _signal: AbortSignal,
  ): Promise<string> {
    console.debug(`[RedocFetchTool] Fetching content for doc_id: ${docId}`);

    const requestBody = {
      doc_id: docId,
    };

    // 直接使用 fetch，因为 fetchWithTimeout 不接受 fetch 选项
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      REDOC_API_TIMEOUT_MS,
    );

    try {
      const response = await fetch(REDOC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorMessage = `Redoc API request failed with status code ${response.status} ${response.statusText}`;
        console.error(`[RedocFetchTool] ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const responseData: RedocApiResponse = await response.json();

      console.debug(`[RedocFetchTool] API 响应详情:`, {
        success: responseData.success,
        code: responseData.code,
        message: responseData.msg,
        title: responseData.data?.title,
        contentLength: responseData.data?.content?.length || 0,
      });

      // 检查API响应是否成功
      if (!responseData.success || responseData.code !== 0) {
        const errorMessage = `Redoc API returned error (code: ${responseData.code}): ${responseData.msg || 'Unknown error'}`;
        console.error(`[RedocFetchTool] ${errorMessage}`, responseData);
        throw new Error(errorMessage);
      }

      if (!responseData.data?.content) {
        throw new Error(
          'Redoc API response does not contain content field in data',
        );
      }

      console.debug(
        `[RedocFetchTool] Successfully fetched content for doc_id: ${docId}, title: ${responseData.data.title}`,
      );
      return responseData.data.content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  override getDescription(): string {
    const displayPrompt =
      this.params.prompt.length > 100
        ? this.params.prompt.substring(0, 97) + '...'
        : this.params.prompt;
    return `Fetching Redoc document from ${this.params.url} and processing with prompt: "${displayPrompt}"`;
  }

  override async shouldConfirmExecute(): Promise<
    ToolCallConfirmationDetails | false
  > {
    const approvalMode = this.config.getApprovalMode();
    // 在 PLAN 和 AUTO_EDIT 模式下不需要确认
    if (approvalMode === ApprovalMode.AUTO_EDIT || approvalMode === ApprovalMode.PLAN) {
      return false;
    }

    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'info',
      title: `Confirm Redoc Document Fetch`,
      prompt: `Fetch Redoc document from ${this.params.url} and process with: ${this.params.prompt}`,
      urls: [this.params.url],
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    const docId = this.extractDocIdFromUrl(this.params.url);
    if (!docId) {
      const errorMessage = `Invalid Redoc URL format: ${this.params.url}`;
      console.error(`[RedocFetchTool] ${errorMessage}`);
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
      };
    }

    try {
      const content = await this.fetchRedocContent(docId, signal);
      console.debug(
        `[RedocFetchTool] Processing content with prompt: "${this.params.prompt}"`,
      );

      const geminiClient = this.config.getGeminiClient();
      // 尝试解析 content 字段，如果是 JSON 则进行格式化处理
      let processedContent = content;
      try {
        const contentObj = JSON.parse(content);
        if (contentObj.children && Array.isArray(contentObj.children)) {
          // 这是结构化文档内容，提取主要文本信息
          processedContent = `文档结构化内容（包含 ${contentObj.children.length} 个内容块）：\n${content}`;
        }
      } catch (_e) {
        // 如果不是 JSON，直接使用原始内容
        processedContent = content;
      }
      const fallbackPrompt = `用户请求如下："${this.params.prompt}"。

我已经从 ${this.params.url} 获取了小红书 Redoc 文档内容。这是一个结构化的文档，包含了完整的内容信息。请仔细分析文档内容并回答用户的请求。

文档内容：
---
${processedContent}
---

请根据文档内容提供准确、详细的回答。如果文档是 JSON 格式的结构化内容，请从中提取关键信息进行分析和总结。`;

      const result = await geminiClient.generateContent(
        [{ role: 'user', parts: [{ text: fallbackPrompt }] }],
        {},
        signal,
        this.config.getModel() || DEFAULT_QWEN_MODEL,
      );
      const resultText = getResponseText(result) || '';

      console.debug(
        `[RedocFetchTool] Successfully processed Redoc content from ${this.params.url}`,
      );

      return {
        llmContent: resultText,
        returnDisplay: `Redoc document from ${this.params.url} processed successfully.`,
      };
    } catch (e) {
      const error = e as Error;
      const errorMessage = `Error during Redoc fetch for ${this.params.url}: ${error.message}`;
      console.error(`[RedocFetchTool] ${errorMessage}`, error);
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
      };
    }
  }
}

/**
 * RedocFetch 工具逻辑的实现
 */
export class RedocFetchTool extends BaseDeclarativeTool<
  RedocFetchToolParams,
  ToolResult
> {
  static readonly Name: string = 'redoc_fetch';

  constructor(private readonly config: Config) {
    super(
      RedocFetchTool.Name,
      'RedocFetch',
      '从小红书 Redoc 文档获取内容并使用 AI 模型处理\n- 接受 Redoc 文档 URL 和提示词作为输入\n- 从 URL 中提取文档 ID 并通过 Redoc API 获取内容\n- 使用小型快速模型处理内容和提示词\n- 返回模型对内容的响应\n- 专门用于小红书 Redoc 文档\n\n使用说明:\n  - 此工具专门针对格式为 https://docs.xiaohongshu.com/doc/{doc_id} 的 URL\n  - URL 必须包含有效的文档 ID（32 位十六进制字符串）\n  - 提示词应描述您想从文档中提取的信息\n  - 此工具为只读工具，不会修改任何文件\n  - 如果内容很大，结果可能会被摘要',
      Kind.Fetch,
      {
        properties: {
          url: {
            description:
              '要获取内容的 Redoc 文档 URL（必须匹配 https://docs.xiaohongshu.com/doc/{doc_id} 格式）',
            type: 'string',
          },
          prompt: {
            description: '用于处理获取内容的提示词',
            type: 'string',
          },
        },
        required: ['url', 'prompt'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: RedocFetchToolParams,
  ): string | null {
    if (!params.url || params.url.trim() === '') {
      return "'url' 参数不能为空。";
    }

    if (!REDOC_URL_PATTERN.test(params.url)) {
      return "'url' 必须是有效的 Redoc URL，格式为：https://docs.xiaohongshu.com/doc/{doc_id}";
    }

    if (!params.prompt || params.prompt.trim() === '') {
      return "'prompt' 参数不能为空。";
    }

    return null;
  }

  protected createInvocation(
    params: RedocFetchToolParams,
  ): ToolInvocation<RedocFetchToolParams, ToolResult> {
    return new RedocFetchToolInvocation(this.config, params);
  }
}
