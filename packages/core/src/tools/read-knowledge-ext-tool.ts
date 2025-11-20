/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolErrorType } from './tool-error.js';
import { readKnowledgeExt, listKnowledgeExt } from './read-knowledge-ext.js';

/**
 * 读取.knowledge/.ext目录中的文件内容的参数
 */
export interface ReadKnowledgeExtToolParams {
  /**
   * 相对于.knowledge/.ext/的路径
   */
  relativePath: string;
}

class ReadKnowledgeExtToolInvocation extends BaseToolInvocation<
  ReadKnowledgeExtToolParams,
  ToolResult
> {
  constructor(params: ReadKnowledgeExtToolParams) {
    super(params);
  }

  getDescription(): string {
    return `读取扩展知识库文件: ${this.params.relativePath}`;
  }

  async execute(): Promise<ToolResult> {
    try {
      const result = await readKnowledgeExt(this.params.relativePath, true);

      if (!result) {
        return {
          llmContent: `文件未找到: ${this.params.relativePath}`,
          returnDisplay: 'Error reading knowledge ext file',
          error: {
            type: ToolErrorType.FILE_NOT_FOUND,
            message: `文件未找到: ${this.params.relativePath}`,
          },
        };
      }

      return {
        llmContent: `# 扩展知识库文件: ${this.params.relativePath}\n\n${result.content}`,
        returnDisplay: `Read knowledge ext file: ${this.params.relativePath}`,
      };
    } catch (error) {
      return {
        llmContent: `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
        returnDisplay: 'Error reading knowledge ext file',
        error: {
          type: ToolErrorType.UNKNOWN,
          message: `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }
}

/**
 * 读取.knowledge/.ext目录中的文件内容的工具
 */
export class ReadKnowledgeExtTool extends BaseDeclarativeTool<
  ReadKnowledgeExtToolParams,
  ToolResult
> {
  static readonly Name = 'ReadKnowledgeExtTool';

  constructor() {
    super(
      'read_knowledge_ext',
      'ReadKnowledgeExt',
      '读取.knowledge/.ext目录中的文件内容。这个工具允许按需访问扩展知识库中的文件，如.bmad-core、.xmad-core等。',
      Kind.Read,
      {
        properties: {
          relativePath: {
            type: 'string',
            description:
              '相对于.knowledge/.ext/的路径，例如：".bmad-core/agents/dev.md" 或 ".bmad-core/core-config.yaml"',
          },
        },
        required: ['relativePath'],
        type: 'object',
      },
    );
  }

  protected createInvocation(
    params: ReadKnowledgeExtToolParams,
  ): ToolInvocation<ReadKnowledgeExtToolParams, ToolResult> {
    return new ReadKnowledgeExtToolInvocation(params);
  }
}

/**
 * 列出.knowledge/.ext目录中的可用文件的参数
 */
export interface ListKnowledgeExtToolParams {
  /**
   * 要列出的子路径，默认为空（列出根目录）
   */
  subPath?: string;
}

class ListKnowledgeExtToolInvocation extends BaseToolInvocation<
  ListKnowledgeExtToolParams,
  ToolResult
> {
  constructor(params: ListKnowledgeExtToolParams) {
    super(params);
  }

  getDescription(): string {
    return `列出扩展知识库目录: ${this.params.subPath || '.ext'}`;
  }

  async execute(): Promise<ToolResult> {
    try {
      const result = await listKnowledgeExt(this.params.subPath || '', true);

      if (!result) {
        return {
          llmContent: `目录未找到: ${this.params.subPath || '.ext'}`,
          returnDisplay: 'Error listing knowledge ext directory',
          error: {
            type: ToolErrorType.FILE_NOT_FOUND,
            message: `目录未找到: ${this.params.subPath || '.ext'}`,
          },
        };
      }

      const content = [
        `# 扩展知识库目录: ${this.params.subPath || '.ext'}\n`,
        `## 文件 (${result.files.length}个):\n`,
        ...result.files.map((file) => `- ${file}\n`),
        `\n## 目录 (${result.directories.length}个):\n`,
        ...result.directories.map((dir) => `- ${dir}/\n`),
      ].join('');

      return {
        llmContent: content,
        returnDisplay: `Listed knowledge ext directory: ${this.params.subPath || '.ext'}`,
      };
    } catch (error) {
      return {
        llmContent: `列出目录失败: ${error instanceof Error ? error.message : String(error)}`,
        returnDisplay: 'Error listing knowledge ext directory',
        error: {
          type: ToolErrorType.UNKNOWN,
          message: `列出目录失败: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }
}

/**
 * 列出.knowledge/.ext目录中的可用文件的工具
 */
export class ListKnowledgeExtTool extends BaseDeclarativeTool<
  ListKnowledgeExtToolParams,
  ToolResult
> {
  static readonly Name = 'ListKnowledgeExtTool';

  constructor() {
    super(
      'list_knowledge_ext',
      'ListKnowledgeExt',
      '列出.knowledge/.ext目录中的可用文件和目录。主要用于访问内置的 bmad（BMAD 方法扩展）与 coding（小红书编程规范）知识库，避免在其它场景误用。',
      Kind.Read,
      {
        properties: {
          subPath: {
            type: 'string',
            description:
              '要列出的子路径，默认为空（列出根目录）。例如：".bmad-core" 或 ".bmad-core/agents"',
            default: '',
          },
        },
        required: [],
        type: 'object',
      },
    );
  }

  protected createInvocation(
    params: ListKnowledgeExtToolParams,
  ): ToolInvocation<ListKnowledgeExtToolParams, ToolResult> {
    return new ListKnowledgeExtToolInvocation(params);
  }
}
