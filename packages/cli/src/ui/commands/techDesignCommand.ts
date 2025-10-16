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
  } catch (_error) {
    return false;
  }
}

/**
 * 读取技术方案模板
 */
function readTemplate(): string {
  // npm 安装后：
  // 代码在 node_modules/@rdmind/rdmind/dist/src/ui/commands/
  // 模板在 node_modules/@rdmind/rdmind/templates/
  const templatePath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'templates',
    'tech-design-template.md',
  );

  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf-8');
  }

  throw new Error(
    `技术方案模板文件未找到\n\n期望路径：${templatePath}\n当前 __dirname: ${__dirname}`,
  );
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

    // 验证 Redoc URL 格式
    const redocUrlPattern =
      /^https:\/\/docs\.xiaohongshu\.com\/doc\/[a-f0-9]+$/;
    if (!redocUrlPattern.test(prdUrl)) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `❌ 提供的 URL 不是有效的 Redoc 文档地址\n\nURL: ${prdUrl}\n\n✅ 正确的格式：\nhttps://docs.xiaohongshu.com/doc/{doc_id}\n\n说明：\n• doc_id 必须是 32 位十六进制字符串\n• 只支持小红书 Redoc 文档\n\n示例：\nhttps://docs.xiaohongshu.com/doc/abc123def456789012345678901234ab`,
        },
        Date.now(),
      );
      return;
    }

    // 读取模板
    let template: string;
    try {
      template = readTemplate();
    } catch (_error) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `❌ 读取模板失败: ${_error}`,
        },
        Date.now(),
      );
      return;
    }

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `工作目录: ${cwd}\nPRD URL: ${prdUrl}\n\n正在生成技术方案...\n\nRDMind将会：\n1. 使用 redoc_fetch 工具获取 PRD 文档内容\n2. 分析 PRD 需求和当前代码仓库\n3. 按照模板格式生成完整的技术方案文档\n4. 将文档保存到工作目录\n\n请耐心等待，这可能需要几分钟时间...`,
      },
      Date.now(),
    );

    // 构造给 AI 的提示词
    const prompt = `你是一个Java软件开发专家，完成以下任务：

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
4. 需求分析部分：对应 PRD 的功能点，详细分析每个页面/模块的逻辑，重点关注服务端逻辑
5. 详细设计部分须包含：
   - 技术实现方案（后端）
   - 数据库表设计（如有数据变更）
   - 接口设计（API 路径、参数、返回值）
   - 关键技术点说明
   - 架构图/流程图（用 Mermaid 语法）
6. 模板中的工作量与排期、上线计划不用填写，保持原状即可

**第四步：保存文档**
不需要展示文档生成过程，生成文档后，使用 write 工具将内容保存到：
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

    // 验证 Redoc URL 格式
    const redocUrlPattern =
      /^https:\/\/docs\.xiaohongshu\.com\/doc\/[a-f0-9]+$/;
    if (!redocUrlPattern.test(techDocUrl)) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `❌ 提供的 URL 不是有效的 Redoc 文档地址\n\nURL: ${techDocUrl}\n\n✅ 正确的格式：\nhttps://docs.xiaohongshu.com/doc/{doc_id}\n\n说明：\n• doc_id 必须是 32 位十六进制字符串\n• 只支持小红书 Redoc 文档\n\n示例：\nhttps://docs.xiaohongshu.com/doc/abc123def456789012345678901234ab`,
        },
        Date.now(),
      );
      return;
    }

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `工作目录: ${cwd}\n技术文档 URL: ${techDocUrl}\n\n正在生成执行计划...\n\nRDMind 将会：\n1. 使用 redoc_fetch 工具获取技术文档内容\n2. 分析代码仓库结构和技术栈\n3. 生成详细的任务分解和执行计划\n4. 提供 AI Coding 使用指导\n5. 将文档保存到工作目录\n\n请耐心等待，这可能需要几分钟时间...`,
      },
      Date.now(),
    );

    // 构造给 AI 的提示词
    const prompt = `你是一个Java软件开发专家，请帮我完成以下任务：

**任务目标：生成执行计划文档**

**第一步：获取技术文档**
请使用 redoc_fetch 工具获取技术文档内容：
- URL: ${techDocUrl}
- 提示词：请详细提取技术文档的所有内容，包括技术方案、架构设计、接口设计、数据库设计、数据结构、实现细节等。特别关注：
  * 数据库表结构（表名、字段、类型、索引、约束）
  * 数据格式（JSON 结构、字段说明）
  * 接口定义（路径、参数、返回值）
  * 业务逻辑细节
  * 技术实现要点

**第二步：分析代码仓库**
当前工作目录：${cwd}
请分析：
1. 代码仓库的目录结构和文件组织
2. 使用的技术栈、框架和库
3. 现有的代码规范和编码风格
4. 关键模块、组件和它们的职责
5. 数据库操作方式（ORM、SQL 等）
6. API 调用方式和数据处理流程

**第三步：生成执行计划**
生成一份详细的执行计划文档，**特别注意**：必须将技术文档中的具体实现细节转化为可执行的开发任务。

包括以下章节：

## 一、项目概述
- 根据技术文档总结项目背景和目标
- 列出使用的技术栈

## 二、代码结构分析
- 分析当前代码仓库的结构
- 识别需要修改或新增的关键模块
- 说明模块间的依赖关系

## 三、开发任务分解

**重要**：以下内容只是参考，必须根据技术文档中的具体实现细节来分解任务！

### 3.1 数据层任务

**如果涉及数据库**，根据技术文档中的数据库设计列出具体任务：
- [ ] 创建数据库表（列出每个表名）
  - 示例：创建 \`activity_target_review\` 表
  - 字段：id, activity_id, data_type, metrics_data, dtm, update_time
  - 索引：PRIMARY KEY (id), UNIQUE KEY uk_activity_type_dtm, KEY idx_activity_id, KEY idx_dtm
- [ ] 定义数据模型和实体类
- [ ] 实现数据访问层（DAO/Repository）

**如果需要但文档未提供**：⚠️ 信息不足：需求涉及数据持久化，但缺少数据库表结构设计

**如果不涉及数据库**：可跳过此部分或说明"本需求无需数据库操作"

### 3.2 业务逻辑任务
根据技术文档的业务逻辑，列出具体任务：
- [ ] 实现核心业务方法（列出方法名和功能）
- [ ] 数据校验和转换
- [ ] 业务规则实现

**如果业务逻辑描述不清晰或缺失关键细节**：⚠️ 信息不足：业务逻辑细节不明确，需要补充 XXX

### 3.3 接口开发任务
**如果需要接口**，根据技术文档的接口设计列出具体任务：
- [ ] 实现 API 接口（列出每个接口的完整路径、方法）
- [ ] 请求参数校验
- [ ] 响应数据封装

**如果需要但文档未提供**：⚠️ 信息不足：需求需要提供接口，但缺少接口定义（路径、参数、响应格式）

**如果不需要接口**：可跳过此部分或说明"本需求无需对外接口"

### 3.4 数据处理任务
根据技术文档列出具体任务

### 3.5 测试任务
- [ ] 单元测试（针对关键业务逻辑）
- [ ] 接口测试（使用实际数据格式）

## 四、技术实现要点

以下内容只是参考，需要根据技术文档中的具体实现细节来填写。

### 4.1 数据库
基于技术文档的数据库设计：
- 表结构创建语句（完整的 CREATE TABLE）
- 索引使用建议
- 查询优化建议
- 数据类型说明（如 bigint(20), varchar(8), json 等）

### 4.2 数据结构定义
基于技术文档的数据格式：
- JSON 字段结构（列出完整的字段列表和类型）
- 枚举值定义（如 data_type: 1-系统数据, 2-自定义数据）
- 数据校验规则

### 4.3 接口实现要点
- 请求/响应格式
- 错误处理
- 数据转换逻辑

## 五、编码规范
基于当前代码仓库，明确：
- 代码风格规范
- 命名约定（变量、函数、类、文件等）
- 注释规范
- 测试要求

## 六、质量保证
- 单元测试策略（针对核心业务逻辑）
- 接口测试（使用实际数据格式）

## 七、风险评估
识别潜在风险和应对措施

## 八、附录
- 相关文档链接
- 技术文档 URL: ${techDocUrl}
- 使用说明

**第四步：保存文档**
不需要创建todo展示生成过程，生成文档后，使用 write 工具将内容保存到：
\`${cwd}/execution-plan-${new Date().toISOString().split('T')[0]}.md\`

**重要要求：**
1. **必须体现技术文档的具体细节**：
   - 如果文档中有数据库表结构，必须在"数据层任务"中列出每个表的创建任务
   - 如果文档中有 JSON 数据格式，必须在"数据处理任务"中说明字段结构
   - 如果文档中有接口定义，必须在"接口开发任务"中列出每个接口
   - 如果文档中有业务规则，必须在"业务逻辑任务"中说明

2. **任务要具体可执行**：
   - 不要写"实现数据库操作"，要写"创建 activity_target_review 表"
   - 每个任务都要能直接指导 AI 编码工具

3. **技术实现要点要详细**：

4. **⚠️ 信息不足时要明确指出**：
   - **先判断需求是否需要该部分**（如：是否需要数据库、是否需要接口等）
   - **只有当需要但文档未提供时**，才标注 "⚠️ 信息不足"
   - 说明缺少哪些信息，需要补充什么
   - 不要凭空猜测或编造信息

5. **编码规范基于实际代码**：
   - 分析现有代码的风格
   - 保持一致性

6. **文档格式**：
   - 使用 Markdown 格式
   - 使用代码块展示 SQL、JSON 等
   - 使用任务清单（- [ ]）
   - 对信息不足的部分使用 ⚠️ 标记

**执行提示：**
- 请直接开始执行任务，调用工具完成
- 不要只给我方案说明，要实际调用工具执行
- 先用 redoc_fetch 获取文档，仔细阅读所有技术细节
- 分析代码仓库结构
- 生成包含所有技术细节的执行计划文档
- 使用 write 工具保存文档

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
