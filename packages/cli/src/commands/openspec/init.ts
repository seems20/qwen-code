/**
 * @license
 * Copyright 2025 RDMind
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { promises as fs } from 'node:fs';
import type {
  CommandContext,
  SlashCommandActionReturn,
} from '../../ui/commands/types.js';
import {
  RDMindConfigurator,
  RDMindSlashCommandConfigurator,
} from '@rdmind/rdmind-core';

/**
 * Initialize OpenSpec in a project with RDMind integration
 */
export class OpenSpecInitCommand {
  static async execute(
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn> {
    // 暂时未使用 context，但保留用于未来功能扩展
    void context;

    try {
      // Parse arguments
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const targetPath = parts[0] || '.';
      const options = this.parseOptions(parts.slice(1));

      const resolvedPath = path.resolve(targetPath);

      // Validate path
      await this.validatePath(resolvedPath);

      // Create OpenSpec directory structure
      const openspecDir = 'openspec';
      await this.createDirectoryStructure(resolvedPath, openspecDir);

      // Generate template files
      await this.generateTemplateFiles(resolvedPath, openspecDir);

      // Configure RDMind integration
      await this.configureRDMindIntegration(
        resolvedPath,
        openspecDir,
        options.tools,
      );

      // Reload commands to recognize newly generated slash commands
      context.ui.reloadCommands();

      const successMessage = `OpenSpec initialized successfully in ${targetPath}!

Created:
- ${openspecDir}/ directory structure
- RDMind.md configuration file
- .rdmind/commands/ slash commands
- Project templates and examples

Available commands:
- /openspec-proposal <description> - Create change proposals
- /openspec-apply <change-name> - Implement changes  
- /openspec-archive <change-name> - Archive completed changes

Try: "Create an OpenSpec proposal for adding user authentication"`;

      console.log(successMessage);

      return {
        type: 'submit_prompt',
        content: [
          {
            text: `OpenSpec has been initialized with RDMind support. You can now use the OpenSpec workflow for structured development. 

To get started:
1. Create a change proposal: "/openspec-proposal Add user authentication feature"
2. Review and refine the proposal
3. Implement with: "/openspec-apply user-auth" 
4. Archive when complete: "/openspec-archive user-auth"`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = `OpenSpec initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      throw error;
    }
  }

  private static parseOptions(args: string[]): { tools?: string } {
    const options: { tools?: string } = {};

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--tools' && i + 1 < args.length) {
        options.tools = args[i + 1];
        i++; // Skip the next argument as it's the value
      }
    }

    return options;
  }

  private static async validatePath(targetPath: string): Promise<void> {
    try {
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path "${targetPath}" is not a directory`);
      }
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'ENOENT') {
        // Directory doesn't exist, create it
        await fs.mkdir(targetPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  private static async createDirectoryStructure(
    projectPath: string,
    openspecDir: string,
  ): Promise<void> {
    const openspecPath = path.join(projectPath, openspecDir);

    const directories = [
      openspecPath,
      path.join(openspecPath, 'specs'),
      path.join(openspecPath, 'changes'),
      path.join(openspecPath, 'changes', 'archive'),
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private static async generateTemplateFiles(
    projectPath: string,
    openspecDir: string,
  ): Promise<void> {
    const openspecPath = path.join(projectPath, openspecDir);

    // Create Chinese project.md with basic project analysis
    const projectContent =
      await this.generateChineseProjectContent(projectPath);

    await fs.writeFile(path.join(openspecPath, 'project.md'), projectContent);

    // Create AGENTS.md
    const agentsTemplate = `# OpenSpec Workflow Instructions

This project uses OpenSpec for structured, spec-driven development.

## Core Workflow

1. **Create Change Proposals**
   - Use \`/openspec-proposal <description>\` to start new features
   - Proposals include motivation, scope, and specification changes
   - Review and iterate until requirements are clear

2. **Implement Changes**
   - Use \`/openspec-apply <change-name>\` to implement approved proposals
   - Follow the tasks defined in the change proposal
   - Update task completion as you progress

3. **Archive Completed Changes**
   - Use \`/openspec-archive <change-name>\` when implementation is done
   - Archives merge approved changes back into the main specifications
   - Maintains a clean, up-to-date source of truth

## File Structure

\`\`\`
${openspecDir}/
├── project.md              # Project context and conventions
├── specs/                  # Current specifications (source of truth)
│   └── [module]/
│       └── spec.md
├── changes/                # Active change proposals
│   ├── [change-name]/
│   │   ├── proposal.md     # Change description and motivation
│   │   ├── tasks.md        # Implementation tasks
│   │   └── specs/          # Specification deltas
│   └── archive/            # Completed changes
└── AGENTS.md               # This file
\`\`\`

## Best Practices

- Always create proposals before major changes
- Validate proposals before implementing: \`rdmind openspec validate <change-name>\`
- Keep tasks updated during implementation
- Only archive when changes are fully complete and tested
- Reference existing specs when creating new proposals

## Commands Reference

- \`rdmind openspec init\` - Initialize OpenSpec in a project
- \`rdmind openspec list\` - List active changes
- \`rdmind openspec show <change-name>\` - Show change details
- \`rdmind openspec validate <change-name>\` - Validate change structure
- \`rdmind openspec archive <change-name>\` - Archive completed change

For more information, visit: https://github.com/Fission-AI/OpenSpec
`;

    await fs.writeFile(path.join(openspecPath, 'AGENTS.md'), agentsTemplate);
  }

  private static async configureRDMindIntegration(
    projectPath: string,
    openspecDir: string,
    tools?: string,
  ): Promise<void> {
    // Always configure RDMind support
    const rdmindConfigurator = new RDMindConfigurator();
    await rdmindConfigurator.configure(projectPath, openspecDir);

    const rdmindSlashConfigurator = new RDMindSlashCommandConfigurator();
    await rdmindSlashConfigurator.generateAll(projectPath, openspecDir);

    // If additional tools are specified, handle them here
    if (tools && tools !== 'rdmind') {
      const toolList = tools
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t !== 'rdmind');
      // TODO: Add support for additional tools if needed
      console.log(
        `Note: Additional tools requested (${toolList.join(', ')}) but not yet implemented`,
      );
    }
  }

  /**
   * Generate Chinese project.md content with basic project analysis
   */
  private static async generateChineseProjectContent(
    projectPath: string,
  ): Promise<string> {
    try {
      // Basic project analysis
      const packageInfo = await this.readPackageJson(projectPath);
      const projectName = packageInfo?.['name'] as string || '项目';
      const description = packageInfo?.['description'] as string || '这是一个软件开发项目';

      // Simple tech detection
      const techs = await this.detectBasicTechnologies(
        projectPath,
        packageInfo,
      );

      return `# 项目概述

## 项目简介
**${projectName}** - ${description}

本项目采用现代化的开发技术栈，注重代码质量和开发效率。

## 技术栈
- **编程语言**: ${techs.languages.join(', ') || '待分析'}
- **框架/库**: ${techs.frameworks.join(', ') || '待补充'}
- **开发工具**: ${techs.tools.join(', ') || '标准工具链'}
- **包管理**: ${packageInfo ? 'npm/yarn' : '待确定'}

## 项目架构
本项目采用${techs.hasModularStructure ? '模块化' : '简洁'}的架构设计，通过清晰的目录结构组织代码，确保项目的可维护性和扩展性。

## 开发规范
- 遵循行业标准的代码规范和最佳实践
${techs.tools.includes('ESLint') ? '- 使用 ESLint 进行代码质量检查' : ''}
${techs.tools.includes('Prettier') ? '- 使用 Prettier 确保代码格式统一' : ''}
${techs.languages.includes('TypeScript') ? '- 使用 TypeScript 提供类型安全' : ''}
- 编写清晰的注释和文档
- 进行代码审查

## 快速开始

### 环境要求
${techs.languages.some((lang) => ['JavaScript', 'TypeScript'].includes(lang)) ? '- Node.js (推荐 LTS 版本)' : ''}
${techs.languages.some((lang) => ['JavaScript', 'TypeScript'].includes(lang)) ? '- npm 或 yarn 包管理器' : ''}

### 安装步骤
1. 克隆仓库到本地
2. 安装项目依赖：\`npm install\`
${packageInfo?.['scripts'] && (packageInfo['scripts'] as Record<string, string>)['build'] ? '3. 构建项目：`npm run build`' : ''}
${packageInfo?.['scripts'] && (packageInfo['scripts'] as Record<string, string>)['dev'] ? '4. 启动开发服务器：`npm run dev`' : ''}
${packageInfo?.['scripts'] && (packageInfo['scripts'] as Record<string, string>)['start'] ? '4. 启动项目：`npm start`' : ''}
${packageInfo?.['scripts'] && (packageInfo['scripts'] as Record<string, string>)['test'] ? '5. 运行测试：`npm test`' : ''}

## 项目结构
\`\`\`
项目根目录/
${techs.hasModularStructure ? '├── src/          # 源代码目录' : ''}
${techs.hasPackages ? '├── packages/      # 子包目录 (monorepo)' : ''}
${techs.hasTests ? '├── tests/         # 测试文件' : ''}
${techs.hasDocs ? '├── docs/          # 项目文档' : ''}
├── package.json    # 项目配置
└── README.md       # 项目说明
\`\`\`

---

*该文档由 OpenSpec 自动生成，请根据项目实际情况进行调整和完善。*`;
    } catch (_error) {
      // Fallback to basic Chinese template
      return `# 项目概述

## 项目简介
这是一个软件开发项目，采用现代化的开发技术栈，注重代码质量和开发效率。

## 技术栈
- **编程语言**: 待分析
- **框架/库**: 待补充
- **数据库**: 待配置
- **开发工具**: 标准工具链

## 项目架构
项目架构设计待补充，将根据具体需求进行规划和设计。

## 开发规范
- 遵循团队约定的编码规范
- 保持代码风格一致性
- 编写清晰的注释和文档
- 进行代码审查

## 快速开始

### 环境要求
请根据项目技术栈配置相应的开发环境。

### 安装步骤
1. 克隆项目到本地
2. 安装必要的依赖
3. 配置开发环境
4. 运行项目

## 项目结构
\`\`\`
项目结构待分析
\`\`\`

---

*该文档由 OpenSpec 自动生成，请根据项目实际情况进行调整和完善。*`;
    }
  }

  /**
   * Read package.json file
   */
  private static async readPackageJson(projectPath: string): Promise<{
    name?: string;
    description?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null> {
    try {
      const packagePath = path.join(projectPath, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Basic technology detection
   */
  private static async detectBasicTechnologies(
    projectPath: string,
    packageInfo: {
      name?: string;
      description?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    } | null,
  ) {
    const result = {
      languages: [] as string[],
      frameworks: [] as string[],
      tools: [] as string[],
      hasModularStructure: false,
      hasPackages: false,
      hasTests: false,
      hasDocs: false,
    };

    try {
      // Check directory structure
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      const directories = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name);

      result.hasModularStructure = directories.includes('src');
      result.hasPackages = directories.includes('packages');
      result.hasTests = directories.some((dir) =>
        ['test', 'tests', '__tests__'].includes(dir),
      );
      result.hasDocs = directories.some((dir) => ['docs', 'doc'].includes(dir));

      // Detect languages from files
      if (files.some((file) => file.endsWith('.ts') || file.endsWith('.tsx'))) {
        result.languages.push('TypeScript');
      }
      if (files.some((file) => file.endsWith('.js') || file.endsWith('.jsx'))) {
        result.languages.push('JavaScript');
      }

      // Detect from package.json
      if (packageInfo?.['dependencies'] || packageInfo?.['devDependencies']) {
        const deps = packageInfo['dependencies'] as Record<string, string> || {};
        const devDeps = packageInfo['devDependencies'] as Record<string, string> || {};
        const allDeps = {
          ...deps,
          ...devDeps,
        };

        // Frameworks
        if (allDeps['react']) result.frameworks.push('React');
        if (allDeps['vue']) result.frameworks.push('Vue.js');
        if (allDeps['angular']) result.frameworks.push('Angular');
        if (allDeps['next']) result.frameworks.push('Next.js');
        if (allDeps['express']) result.frameworks.push('Express.js');

        // Tools
        if (allDeps['typescript']) result.tools.push('TypeScript');
        if (allDeps['eslint']) result.tools.push('ESLint');
        if (allDeps['prettier']) result.tools.push('Prettier');
        if (allDeps['jest']) result.tools.push('Jest');
        if (allDeps['vite']) result.tools.push('Vite');
        if (allDeps['webpack']) result.tools.push('Webpack');
      }
    } catch (_error) {
      // Ignore errors and return basic structure
    }

    return result;
  }
}