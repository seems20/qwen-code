/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
  type SlashCommandActionReturn,
} from './types.js';
import { MessageType } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 检查当前工作目录是否是 git 仓库
 */
function isGitRepository(cwd: string): boolean {
  try {
    const gitDir = path.join(cwd, '.git');
    return fs.existsSync(gitDir);
  } catch (error) {
    return false;
  }
}

/**
 * 读取技术方案模板
 */
function readTemplate(): string {
  const possiblePaths = [
    // 开发环境
    path.join(__dirname, '..', '..', '..', 'templates', 'tech-design-template.md'),
    // npm 安装后
    path.join(__dirname, '..', '..', '..', '..', 'templates', 'tech-design-template.md'),
  ];

  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf-8');
    }
  }

  throw new Error('技术方案模板文件未找到');
}

/**
 * 生成技术方案子命令
 */
const solutionCommand: SlashCommand = {
  name: 'solution',
  description: '根据 PRD 文档生成技术方案',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const { config } = context.services;

    if (!config) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 配置未加载',
        },
        Date.now(),
      );
      return;
    }

    const cwd = process.cwd();

    // 检查是否在 git 仓库中
    if (!isGitRepository(cwd)) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 当前目录不是 git 仓库，请在代码仓库目录下使用此命令。',
        },
        Date.now(),
      );
      return;
    }

    // 解析参数
    const prdUrl = args.trim();
    if (!prdUrl) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 请提供 PRD 文档的 URL\n\n使用方法：\n/tech-design solution <prd-url>\n\n示例：\n/tech-design solution https://docs.xiaohongshu.com/doc/abc123',
        },
        Date.now(),
      );
      return;
    }

    // 读取模板
    let template: string;
    try {
      template = readTemplate();
    } catch (error) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `❌ 读取模板失败: ${error}`,
        },
        Date.now(),
      );
      return;
    }

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `📂 工作目录: ${cwd}\n📋 PRD URL: ${prdUrl}\n\n🤖 正在调用 AI 生成技术方案...\n\n💡 AI 将会：\n1. 使用 redoc_fetch 工具获取 PRD 文档内容\n2. 分析 PRD 需求和当前代码仓库\n3. 按照模板格式生成完整的技术方案文档\n4. 将文档保存到工作目录\n\n请耐心等待，这可能需要几分钟时间...`,
      },
      Date.now(),
    );

    // 构造给 AI 的提示词
    const prompt = `你是一个技术方案专家，请帮我完成以下任务：

**任务目标：生成技术方案文档**

**第一步：获取 PRD 文档**
请使用 redoc_fetch 工具获取 PRD 文档内容：
- URL: ${prdUrl}
- 提示词：请详细提取 PRD 文档的所有内容，包括需求描述、功能点、交互设计、业务流程等所有信息

**第二步：分析代码仓库**
当前工作目录：${cwd}
请分析当前代码仓库的技术栈、架构、代码结构等信息。

**第三步：生成技术方案**
根据 PRD 内容和代码仓库情况，按照以下模板格式生成完整的技术方案文档：

\`\`\`markdown
${template}
\`\`\`

**生成要求：**
1. 仔细阅读 PRD 内容，深入理解需求
2. 评审信息部分保留空白表格即可
3. 背景部分：填写 PRD 链接和项目背景
4. 需求分析部分：对应 PRD 的功能点，详细分析每个页面/模块的逻辑
5. 详细设计部分必须包含：
   - 技术实现方案（前端/后端）
   - 数据库表设计（如有数据变更）
   - 接口设计（API 路径、参数、返回值）
   - 关键技术点说明
   - 架构图/流程图（用 Mermaid 语法）
6. 工作量评估要合理，按模块拆分
7. 上线步骤要具体、可执行

**第四步：保存文档**
生成文档后，请使用 write 工具将内容保存到：
\`${cwd}/tech-solution-${new Date().toISOString().split('T')[0]}.md\`

**重要提示：**
- 请直接开始执行任务，调用工具完成
- 不要只给我方案说明，要实际调用工具执行
- 文档要完整、详细、可直接使用
- 使用 Markdown 格式，确保格式正确

现在请开始执行任务。`;

    // 将提示词发送给 AI（通过返回类型让 UI 处理）
    return {
      type: 'submit_prompt',
      content: prompt,
    };
  },
};

/**
 * 生成执行计划子命令
 */
const planCommand: SlashCommand = {
  name: 'plan',
  description: '根据技术文档生成执行计划',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const { config } = context.services;

    if (!config) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 配置未加载',
        },
        Date.now(),
      );
      return;
    }

    const cwd = process.cwd();

    // 检查是否在 git 仓库中
    if (!isGitRepository(cwd)) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 当前目录不是 git 仓库，请在代码仓库目录下使用此命令。',
        },
        Date.now(),
      );
      return;
    }

    // 解析参数
    const techDocUrl = args.trim();
    if (!techDocUrl) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 请提供技术文档的 URL\n\n使用方法：\n/tech-design plan <tech-doc-url>\n\n示例：\n/tech-design plan https://docs.xiaohongshu.com/doc/abc123',
        },
        Date.now(),
      );
      return;
    }

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `📂 工作目录: ${cwd}\n📋 技术文档 URL: ${techDocUrl}\n\n🤖 正在调用 AI 生成执行计划...\n\n💡 AI 将会：\n1. 使用 redoc_fetch 工具获取技术文档内容\n2. 分析代码仓库结构和技术栈\n3. 生成详细的任务分解和执行计划\n4. 提供 AI Coding 使用指导\n5. 将文档保存到工作目录\n\n请耐心等待，这可能需要几分钟时间...`,
      },
      Date.now(),
    );

    // 构造给 AI 的提示词
    const prompt = `你是一个软件开发项目管理专家，请帮我完成以下任务：

**任务目标：生成执行计划文档**

**第一步：获取技术文档**
请使用 redoc_fetch 工具获取技术文档内容：
- URL: ${techDocUrl}
- 提示词：请详细提取技术文档的所有内容，包括技术方案、架构设计、接口设计、数据库设计、实现细节等

**第二步：分析代码仓库**
当前工作目录：${cwd}
请分析：
1. 代码仓库的目录结构
2. 使用的技术栈和框架
3. 现有的代码规范和风格
4. 关键模块和依赖关系

**第三步：生成执行计划**
生成一份详细的执行计划文档，包括以下章节：

## 一、项目概述
- 根据技术文档总结项目背景和目标
- 列出使用的技术栈

## 二、代码结构分析
- 分析当前代码仓库的结构
- 识别需要修改或新增的关键模块
- 说明模块间的依赖关系

## 三、开发任务分解
将功能分解为具体的、可执行的任务，包括：
- **前置任务**：环境准备、依赖安装等
- **核心任务**：主要功能开发，每个任务要具体、可衡量
- **后续任务**：测试、优化、文档等
- **任务依赖关系**：说明任务之间的依赖

## 四、编码规范
基于当前代码仓库，明确：
- 代码风格规范
- 命名约定（变量、函数、类、文件等）
- 注释规范
- 测试要求
- Git commit 规范

## 五、AI Coding 指导
提供使用 AI Coding 工具（如 RDMind）的具体指导：
- 如何提供上下文
- 如何描述需求
- 分阶段开发建议
- 代码审查要点
- 常见问题和注意事项

## 六、质量保证
- 单元测试策略
- 集成测试策略
- 代码审查流程

## 七、部署和发布
- 部署环境说明
- 发布流程
- 回滚预案

## 八、项目排期
用表格形式列出各阶段任务、预估工作量和时间安排

## 九、风险评估
识别潜在风险和应对措施

## 十、附录
- 相关文档链接
- 使用说明

**第四步：保存文档**
生成文档后，请使用 write 工具将内容保存到：
\`${cwd}/execution-plan-${new Date().toISOString().split('T')[0]}.md\`

**重要要求：**
1. 任务分解要足够细致，每个任务都是可执行的小任务
2. 编码规范要明确、实用，基于实际代码分析
3. AI Coding 指导要具体、可操作
4. 包含完整的质量保证和风险控制措施
5. 文档要详细、完整、实用，可直接作为开发指导
6. 使用 Markdown 格式，确保格式正确

**执行提示：**
- 请直接开始执行任务，调用工具完成
- 不要只给我方案说明，要实际调用工具执行
- 先用 redoc_fetch 获取文档，再分析代码，最后生成并保存文档

现在请开始执行任务。`;

    // 将提示词发送给 AI
    return {
      type: 'submit_prompt',
      content: prompt,
    };
  },
};

/**
 * 主 tech-design 命令
 */
export const techDesignCommand: SlashCommand = {
  name: 'tech-design',
  altNames: ['td'],
  description: '技术方案和执行计划生成工具',
  kind: CommandKind.BUILT_IN,
  subCommands: [solutionCommand, planCommand],
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const parts = args.trim().split(/\s+/);

    if (parts.length === 0 || !parts[0]) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: `📋 技术方案和执行计划生成工具

**可用子命令：**

1. **/tech-design solution <prd-url>**
   根据 PRD 文档生成技术方案
   - 自动从 Redoc URL 获取 PRD 内容
   - 分析代码仓库技术栈和架构
   - 生成完整的技术方案文档
   
2. **/tech-design plan <tech-doc-url>**
   根据技术文档生成执行计划
   - 自动从 Redoc URL 获取技术文档内容
   - 分析代码仓库结构
   - 生成详细的任务分解和执行计划
   - 提供 AI Coding 使用指导

**使用示例：**
\`\`\`
/tech-design solution https://docs.xiaohongshu.com/doc/abc123
/tech-design plan https://docs.xiaohongshu.com/doc/xyz789
\`\`\`

**注意事项：**
- 必须在 git 仓库目录下使用
- 支持 Redoc 文档 URL
- 生成的文档会保存到当前工作目录
- AI 会自动调用 redoc_fetch 工具获取文档内容

**快捷方式：**
可以使用 \`/td\` 作为 \`/tech-design\` 的简写`,
        },
        Date.now(),
      );
      return;
    }

    const subcommand = parts[0].toLowerCase();
    const remainingArgs = parts.slice(1).join(' ');

    switch (subcommand) {
      case 'solution':
      case 's':
        return await solutionCommand.action!(context, remainingArgs);
      case 'plan':
      case 'p':
        return await planCommand.action!(context, remainingArgs);
      default:
        context.ui.addItem(
          {
            type: MessageType.ERROR,
            text: `❌ 未知的子命令：${subcommand}\n\n可用的子命令：\n• solution (s) - 生成技术方案\n• plan (p) - 生成执行计划\n\n使用 /tech-design 查看帮助`,
          },
          Date.now(),
        );
        return;
    }
  },
};

