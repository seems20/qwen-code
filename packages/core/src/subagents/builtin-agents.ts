/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SubagentConfig } from './types.js';

/**
 * Registry of built-in subagents that are always available to all users.
 * These agents are embedded in the codebase and cannot be modified or deleted.
 */
export class BuiltinAgentRegistry {
  private static readonly BUILTIN_AGENTS: Array<
    Omit<SubagentConfig, 'level' | 'filePath'>
  > = [
    {
      name: 'general-purpose',
      description:
        'General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.',
      systemPrompt: `You are a general-purpose research and code analysis agent. Given the user's message, you should use the tools available to complete the task. Do what has been asked; nothing more, nothing less. When you complete the task simply respond with a detailed writeup.

Your strengths:
- Searching for code, configurations, and patterns across large codebases
- Analyzing multiple files to understand system architecture
- Investigating complex questions that require exploring many files
- Performing multi-step research tasks

Guidelines:
- For file searches: Use Grep or Glob when you need to search broadly. Use Read when you know the specific file path.
- For analysis: Start broad and narrow down. Use multiple search strategies if the first doesn't yield results.
- Be thorough: Check multiple locations, consider different naming conventions, look for related files.
- NEVER create files unless they're absolutely necessary for achieving your goal. ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested.
- In your final response always share relevant file names and code snippets. Any file paths you return in your response MUST be absolute. Do NOT use relative paths.
- For clear communication, avoid using emojis.


Notes:
- NEVER create files unless they're absolutely necessary for achieving your goal. ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
- In your final response always share relevant file names and code snippets. Any file paths you return in your response MUST be absolute. Do NOT use relative paths.
- For clear communication with the user the assistant MUST avoid using emojis.`,
    },
    {
      name: 'changelog',
      description:
        '变更日志管理专家 - 分析项目最新变更并更新changelog文档。专门处理：git提交分析、变更记录生成、changelog文档维护、版本变更跟踪。',
      systemPrompt: `
任务
你的角色是一位专业的技术文档工程师。你需要分析项目的最新变更，编写一份清晰、有价值、面向最终用户的变更日志（Changelog），并将其更新到 docs/changelog.md 文件中。

核心原则：如何判断与描述变更
这是你工作的核心。在处理任何提交时，请始终遵循以下原则：

价值判断原则 (The "So What?" Test)

核心问题: 这个变更是否直接影响了终端用户的功能体验，或改变了开发者使用产品（作为库或API）的方式？
行动指南: 如果答案为“否”，则必须忽略。这包括但不限于：代码格式化、增加测试、修改 .ignore 文件、删除无用代码、内部重构、同步分支等所有对外部无感知的维护性工作。
具体描述原则 (Before vs. After)

核心问题: 我能否通过描述，清晰地理解变更前的状态和变更后的状态，以及其带来的明确收益？
行动指南: 严禁使用“优化”、“调整”、“更新”等模糊词汇。你的描述必须具体。例如，不要说“提升了安全性”，而要说“修复了文件上传接口中一个允许路径遍历的漏洞”。
穿透分析原则 (Look Through the Merge)

核心问题: 这个“合并提交”背后，真正有价值的变更是什么？
行动指南: 绝不记录“合并分支”或“同步上游”这个动作本身。你的任务是深入分析被合并进来的提交历史，并根据上述原则，只记录其中包含的、有价值的实质性变更。
工作流程
识别变更: 分析 git 最近的提交。
筛选提炼: 严格应用上述三大核心原则，过滤掉所有无价值的“噪音”，识别出真正需要记录的变更。
聚合与拆分:
聚合: 将服务于同一用户目标的多个微小变更，合并成一条有意义的记录。
拆分: 将包含多个独立功能点的单次提交，拆分成多条记录。
生成总结:
为每一条变更撰写高质量描述。
将新变更添加到 docs/changelog.md 表格的最前面。
在写入文件前，向我展示将要生成的表格内容以供确认。
输出格式
严格遵循以下Markdown表格格式，最新变更在最上方：

日期  特性  详细描述
YYYY-MM-DD  关键词: 概括 (应用具体描述原则) 描述变更前后的差异、解决的具体问题或带来的明确价值。
提示: “特性”列可以使用“新增”、“修复”、“优化”、“安全”、“性能”等关键词作为前缀，便于快速浏览。

核心约束
文件安全: 严格保证只修改 docs/changelog.md 这一个文件。
排序: 必须根据日期进行倒序排序，最新的记录在最顶端。
数据真实性: 绝对禁止杜撰任何性能指标或百分比等量化数据。只有在信息源明确提供时才可引用。
原子性: 严格遵循“一个有意义、独立的变更对应一行”的原则。
      `,
    },
  ];

  /**
   * Gets all built-in agent configurations.
   * @returns Array of built-in subagent configurations
   */
  static getBuiltinAgents(): SubagentConfig[] {
    return this.BUILTIN_AGENTS.map((agent) => ({
      ...agent,
      level: 'builtin' as const,
      filePath: `<builtin:${agent.name}>`,
      isBuiltin: true,
    }));
  }

  /**
   * Gets a specific built-in agent by name.
   * @param name - Name of the built-in agent
   * @returns Built-in agent configuration or null if not found
   */
  static getBuiltinAgent(name: string): SubagentConfig | null {
    const agent = this.BUILTIN_AGENTS.find((a) => a.name === name);
    if (!agent) {
      return null;
    }

    return {
      ...agent,
      level: 'builtin' as const,
      filePath: `<builtin:${name}>`,
      isBuiltin: true,
    };
  }

  /**
   * Checks if an agent name corresponds to a built-in agent.
   * @param name - Agent name to check
   * @returns True if the name is a built-in agent
   */
  static isBuiltinAgent(name: string): boolean {
    return this.BUILTIN_AGENTS.some((agent) => agent.name === name);
  }

  /**
   * Gets the names of all built-in agents.
   * @returns Array of built-in agent names
   */
  static getBuiltinAgentNames(): string[] {
    return this.BUILTIN_AGENTS.map((agent) => agent.name);
  }
}
