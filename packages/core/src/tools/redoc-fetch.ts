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
import type { Part } from '@google/genai';
import mime from 'mime/lite';

const REDOC_API_TIMEOUT_MS = 10000;
const REDOC_API_URL =
  'https://athena-next.devops.xiaohongshu.com/api/media/query/redoc';
const REDOC_URL_PATTERN =
  /^https:\/\/docs\.xiaohongshu\.com\/doc\/([a-f0-9]+)$/;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30000; // 30秒超时
const MAX_IMAGE_SIZE_MB = 20; // 最大图片大小

/**
 * RedocFetch 工具的参数接口
 */
export interface RedocFetchToolParams {
  /**
   * 要获取内容的 Redoc 文档 URL
   */
  url: string;
  /**
   * 描述用户想从文档中了解什么信息的提示词，
   * 应该根据用户的原始问题生成，不要假设文档类型
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

      if (!responseData.data) {
        const errorMessage = 'Redoc API response does not contain data field';
        console.error(`[RedocFetchTool] ${errorMessage}`);
        console.error(
          `[RedocFetchTool] 完整响应数据:`,
          JSON.stringify(responseData, null, 2),
        );
        throw new Error(errorMessage);
      }

      if (!responseData.data.content) {
        const errorMessage =
          'Redoc API response does not contain content field in data';
        console.error(`[RedocFetchTool] ${errorMessage}`);
        console.error(
          `[RedocFetchTool] 完整响应数据:`,
          JSON.stringify(responseData, null, 2),
        );
        console.error(
          `[RedocFetchTool] data 字段内容:`,
          JSON.stringify(responseData.data, null, 2),
        );
        console.error(
          `[RedocFetchTool] data 字段的所有键:`,
          Object.keys(responseData.data),
        );
        throw new Error(
          `${errorMessage}. 可用字段: ${Object.keys(responseData.data).join(', ')}`,
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

  /**
   * 解析文档内容并构建包含文本和图片（按原始顺序）的结构
   */
  private async buildContentWithImages(
    content: string,
    signal: AbortSignal,
  ): Promise<{
    parts: Part[];
    textContent: string;
    imageCount: number;
    successCount: number;
  }> {
    try {
      const contentObj = JSON.parse(content);
      
      if (!contentObj.children || !Array.isArray(contentObj.children)) {
        // 不是结构化内容，返回纯文本
        return {
          parts: [{ text: content }],
          textContent: content,
          imageCount: 0,
          successCount: 0,
        };
      }

      const parts: Part[] = [];
      let textBuffer: string[] = [];
      let imageCount = 0;
      let successCount = 0;

      // 递归处理节点，支持嵌套结构
      const processNode = async (node: any, depth: number = 0): Promise<void> => {
        if (!node) return;

        // 处理图片节点
        if (node.type === 'image' && node.url) {
          imageCount++;
          
          // 在遇到图片前，先把累积的文本作为一个 part
          if (textBuffer.length > 0) {
            parts.push({ text: textBuffer.join('\n') });
            textBuffer = [];
          }

          // 下载图片
          console.debug(
            `[RedocFetchTool] Downloading image ${imageCount} (depth ${depth}): ${node.url}`,
          );
          
          const imageData = await this.downloadImageAsBase64(node.url, signal);
          
          if (imageData) {
            // 成功下载，添加图片说明和图片数据
            const imageCaption = `\n[图片 ${imageCount}${node.width && node.height ? ` (${node.width}x${node.height})` : ''}]\n`;
            parts.push({ text: imageCaption });
            parts.push({
              inlineData: {
                data: imageData.data,
                mimeType: imageData.mimeType,
              },
            });
            successCount++;
            console.debug(
              `[RedocFetchTool] Image ${imageCount} downloaded successfully`,
            );
          } else {
            // 下载失败，添加占位符
            const placeholder = `\n[图片 ${imageCount} - 下载失败: ${node.url}]\n`;
            parts.push({ text: placeholder });
            console.warn(
              `[RedocFetchTool] Failed to download image ${imageCount}: ${node.url}`,
            );
          }
          return;
        }

        // 处理嵌套容器节点（columns, column, table-cell-block 等）
        if (node.children && Array.isArray(node.children)) {
          // 对于某些容器类型，添加结构提示
          if (node.type === 'columns') {
            textBuffer.push('\n[多栏布局]');
          } else if (node.type === 'column') {
            textBuffer.push('\n[栏目]');
          }

          // 递归处理子节点
          for (const child of node.children) {
            await processNode(child, depth + 1);
          }
          return;
        }

        // 提取文本内容
        const textContent = this.extractTextFromNode(node);
        if (textContent) {
          textBuffer.push(textContent);
        }
      };

      // 遍历所有顶层子节点
      for (const child of contentObj.children) {
        await processNode(child, 0);
      }

      // 添加最后剩余的文本
      if (textBuffer.length > 0) {
        parts.push({ text: textBuffer.join('\n') });
      }

      // 生成纯文本内容用于日志（递归提取）
      const extractAllText = (node: any): string => {
        if (!node) return '';
        if (node.type === 'image') return ''; // 忽略图片
        
        const nodeText = this.extractTextFromNode(node);
        let childrenText = '';
        
        if (node.children && Array.isArray(node.children)) {
          childrenText = node.children
            .map((child: any) => extractAllText(child))
            .filter((text: string) => text)
            .join('\n');
        }
        
        return [nodeText, childrenText].filter(Boolean).join('\n');
      };

      const textContent = contentObj.children
        .map((child: any) => extractAllText(child))
        .filter((text: string) => text)
        .join('\n');

      return {
        parts,
        textContent,
        imageCount,
        successCount,
      };
    } catch {
      // 解析失败，返回原始内容
      return {
        parts: [{ text: content }],
        textContent: content,
        imageCount: 0,
        successCount: 0,
      };
    }
  }

  /**
   * 从文档节点中提取文本内容（支持递归）
   */
  private extractTextFromNode(node: any): string {
    if (!node) return '';

    // 跳过图片节点（图片单独处理）
    if (node.type === 'image') return '';

    switch (node.type) {
      case 'title':
        return this.extractTextFromChildren(node.children, '# ');
      case 'h1':
        return this.extractTextFromChildren(node.children, '## ');
      case 'h2':
        return this.extractTextFromChildren(node.children, '### ');
      case 'h3':
        return this.extractTextFromChildren(node.children, '#### ');
      case 'paragraph':
        return this.extractTextFromChildren(node.children);
      case 'code':
        return `\`\`\`\n${this.extractTextFromChildren(node.children)}\n\`\`\``;
      case 'numbered-list':
      case 'list':
        return this.extractTextFromChildren(node.children, '- ');
      case 'block-quote':
        return `> ${this.extractTextFromChildren(node.children)}`;
      case 'table':
        return this.extractTableContent(node);
      case 'columns':
      case 'column':
      case 'table-cell-block':
        // 递归处理容器节点的子节点
        if (node.children && Array.isArray(node.children)) {
          return node.children
            .map((child: any) => this.extractTextFromNode(child))
            .filter((text: string) => text)
            .join('\n');
        }
        return '';
      default:
        if (node.children) {
          return this.extractTextFromChildren(node.children);
        }
        if (node.text) {
          return node.text;
        }
        return '';
    }
  }

  /**
   * 从表格节点中提取文本内容
   */
  private extractTableContent(tableNode: any): string {
    if (!tableNode.children || !Array.isArray(tableNode.children)) {
      return '';
    }

    const rows: string[] = [];
    for (const row of tableNode.children) {
      if (row.type === 'tr' && row.children) {
        const cells = row.children
          .map((cell: any) => {
            if (cell.type === 'td') {
              return this.extractTextFromNode(cell);
            }
            return '';
          })
          .filter((text: string) => text);
        
        if (cells.length > 0) {
          rows.push('| ' + cells.join(' | ') + ' |');
        }
      }
    }

    return rows.join('\n');
  }

  /**
   * 从子节点数组中提取文本
   */
  private extractTextFromChildren(
    children: any[],
    prefix: string = '',
  ): string {
    if (!children || !Array.isArray(children)) return '';
    
    return children
      .map((child) => {
        if (typeof child === 'string') return child;
        if (child.text) return prefix + child.text;
        return this.extractTextFromNode(child);
      })
      .join('');
  }

  /**
   * 下载图片并转换为 Base64
   */
  private async downloadImageAsBase64(
    url: string,
    signal: AbortSignal,
  ): Promise<{ data: string; mimeType: string } | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      IMAGE_DOWNLOAD_TIMEOUT_MS,
    );

    try {
      console.debug(`[RedocFetchTool] Downloading image from: ${url}`);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RDMind/1.0)',
        },
      });

      if (!response.ok) {
        console.warn(
          `[RedocFetchTool] Failed to download image: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');

      // 检查文件大小
      if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        if (sizeMB > MAX_IMAGE_SIZE_MB) {
          console.warn(
            `[RedocFetchTool] Image too large: ${sizeMB.toFixed(2)}MB (max: ${MAX_IMAGE_SIZE_MB}MB)`,
          );
          return null;
        }
      }

      // 检查是否是图片类型
      if (!contentType.startsWith('image/')) {
        console.warn(
          `[RedocFetchTool] URL does not return an image: ${contentType}`,
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 再次检查实际大小
      const actualSizeMB = buffer.length / (1024 * 1024);
      if (actualSizeMB > MAX_IMAGE_SIZE_MB) {
        console.warn(
          `[RedocFetchTool] Downloaded image too large: ${actualSizeMB.toFixed(2)}MB`,
        );
        return null;
      }

      const base64Data = buffer.toString('base64');

      // 尝试从 URL 或 Content-Type 获取 MIME 类型
      let mimeType = contentType;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const urlPath = new URL(url).pathname;
        const detectedMime = mime.getType(urlPath);
        if (detectedMime) {
          mimeType = detectedMime;
        }
      }

      console.debug(
        `[RedocFetchTool] Successfully downloaded image: ${actualSizeMB.toFixed(2)}MB, type: ${mimeType}`,
      );

      return {
        data: base64Data,
        mimeType,
      };
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          `[RedocFetchTool] Error downloading image from ${url}: ${error.message}`,
        );
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  override getDescription(): string {
    const displayPrompt =
      this.params.prompt.length > 100
        ? this.params.prompt.substring(0, 97) + '...'
        : this.params.prompt;
    return `获取 Redoc 文档并分析：${displayPrompt}`;
  }

  override async shouldConfirmExecute(): Promise<
    ToolCallConfirmationDetails | false
  > {
    const approvalMode = this.config.getApprovalMode();
    // 在 PLAN 和 AUTO_EDIT 模式下不需要确认
    if (
      approvalMode === ApprovalMode.AUTO_EDIT ||
      approvalMode === ApprovalMode.PLAN
    ) {
      return false;
    }

    const confirmationDetails: ToolCallConfirmationDetails = {
      type: 'info',
      title: `确认获取 Redoc 文档`,
      prompt: `从 ${this.params.url} 获取文档并分析：${this.params.prompt}`,
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

      // 构建包含文本和图片的内容（按原始顺序）
      const { parts, imageCount, successCount } =
        await this.buildContentWithImages(content, signal);

      console.debug(
        `[RedocFetchTool] Content parsed: ${imageCount} images found, ${successCount} downloaded successfully`,
      );

      const geminiClient = this.config.getGeminiClient();

      // 构建提示词
      const imageInfo =
        imageCount > 0
          ? `\n\n注意：文档中包含 ${imageCount} 张图片（成功加载 ${successCount} 张），图片已按原始位置插入到文档内容中，请结合上下文和图片内容进行分析。`
          : '';

      const promptPart: Part = {
        text: `请根据用户的问题分析以下文档内容：

用户问题：${this.params.prompt}

文档来源：${this.params.url}
${imageInfo}

文档内容如下（文本和图片按原始顺序排列）：
---`,
      };

      const endPart: Part = {
        text: `---

请根据上述文档内容（包括文本和图片）回答用户的问题。`,
      };

      // 组合所有 parts：开头提示 + 文档内容（文本+图片交替） + 结尾提示
      const allParts: Part[] = [promptPart, ...parts, endPart];

      const result = await geminiClient.generateContent(
        [{ role: 'user', parts: allParts }],
        {},
        signal,
        this.config.getModel() || DEFAULT_QWEN_MODEL,
      );
      const resultText = getResponseText(result) || '';

      console.debug(
        `[RedocFetchTool] Successfully processed Redoc content from ${this.params.url}`,
      );

      const displayMessage =
        imageCount > 0
          ? `Redoc document from ${this.params.url} processed successfully (${successCount}/${imageCount} images loaded).`
          : `Redoc document from ${this.params.url} processed successfully.`;

      return {
        llmContent: resultText,
        returnDisplay: displayMessage,
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
      '从小红书 Redoc 文档获取内容并使用 AI 模型处理\n- 接受 Redoc 文档 URL 和提示词作为输入\n- 从 URL 中提取文档 ID 并通过 Redoc API 获取内容\n- 自动提取文档中的图片并下载，支持图片理解\n- 使用 AI 模型处理文档内容（包含文本和图片）并回答用户问题\n- 返回模型对内容的响应\n- 适用于各种类型的小红书 Redoc 文档（技术文档、产品文档、设计文档等）\n\n使用说明:\n  - 此工具专门针对格式为 https://docs.xiaohongshu.com/doc/{doc_id} 的 URL\n  - URL 必须包含有效的文档 ID（32 位十六进制字符串）\n  - 提示词应该清晰描述用户想了解文档的哪些方面\n  - 此工具为只读工具，不会修改任何文件\n  - 如果文档包含图片，会自动下载并发送给模型进行理解\n  - 支持的图片格式：PNG、JPEG、GIF、WEBP 等\n  - 单张图片最大 20MB',
      Kind.Fetch,
      {
        properties: {
          url: {
            description:
              '要获取内容的 Redoc 文档 URL（必须匹配 https://docs.xiaohongshu.com/doc/{doc_id} 格式）',
            type: 'string',
          },
          prompt: {
            description:
              '描述用户想从文档中了解什么信息，例如：总结文档主要内容、解释某个概念、查找特定信息等。应该根据用户的原始问题直接转述，不要假设文档类型',
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
