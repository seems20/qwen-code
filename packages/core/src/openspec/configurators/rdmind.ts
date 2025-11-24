/**
 * @license
 * Copyright 2025 RDMind
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { promises as fs } from 'node:fs';
import type {
  ToolConfigurator,
  SlashCommandConfigurator,
  SlashCommandTarget,
  SlashCommandId,
} from './base.js';

const OPENSPEC_MARKERS = {
  start: '<!-- OPENSPEC:START -->',
  end: '<!-- OPENSPEC:END -->',
};

/**
 * RDMind configurator for OpenSpec integration
 */
export class RDMindConfigurator implements ToolConfigurator {
  name = 'RDMind';
  configFileName = 'RDMind.md';
  isAvailable = true;

  async configure(projectPath: string, _openspecDir: string): Promise<void> {
    const filePath = path.join(projectPath, this.configFileName);
    const content = this.getAgentsTemplate();

    await this.updateFileWithMarkers(filePath, content);
  }

  private getAgentsTemplate(): string {
    return `# OpenSpec Workflow for AI Development

## Available Commands
- \`/openspec-proposal [description]\` - Create a new change proposal
- \`/openspec-apply <change-name>\` - Implement an approved change  
- \`/openspec-archive <change-name>\` - Archive a completed change

## Workflow
1. **Propose**: Create structured change proposals with specs and tasks
2. **Review**: Collaborate on requirements until aligned
3. **Implement**: Code against the agreed specifications
4. **Archive**: Merge completed changes back to specs

## Best Practices
- Always create proposals before major changes
- Validate proposals with \`rdmind openspec validate <change-name>\`
- Keep tasks updated during implementation
- Archive only when changes are fully complete

For more information, see \`openspec/AGENTS.md\`.`;
  }

  private async updateFileWithMarkers(
    filePath: string,
    content: string,
  ): Promise<void> {
    let existingContent = '';

    try {
      existingContent = await fs.readFile(filePath, 'utf-8');
    } catch (_error) {
      // File doesn't exist, create it
    }

    const startMarker = OPENSPEC_MARKERS.start;
    const endMarker = OPENSPEC_MARKERS.end;
    const newContent = `${startMarker}\n${content}\n${endMarker}`;

    if (
      existingContent.includes(startMarker) &&
      existingContent.includes(endMarker)
    ) {
      // Replace existing marked section
      const startIndex = existingContent.indexOf(startMarker);
      const endIndex = existingContent.indexOf(endMarker) + endMarker.length;
      const updatedContent =
        existingContent.slice(0, startIndex) +
        newContent +
        existingContent.slice(endIndex);
      await fs.writeFile(filePath, updatedContent);
    } else {
      // Append to existing content or create new file
      const finalContent = existingContent
        ? `${existingContent}\n\n${newContent}`
        : newContent;
      await fs.writeFile(filePath, finalContent);
    }
  }
}

/**
 * File paths for RDMind slash commands
 */
const FILE_PATHS: Record<SlashCommandId, string> = {
  proposal: '.rdmind/commands/openspec-proposal.md',
  apply: '.rdmind/commands/openspec-apply.md',
  archive: '.rdmind/commands/openspec-archive.md',
};

/**
 * YAML frontmatter for RDMind command files
 */
const FRONTMATTER: Record<SlashCommandId, string> = {
  proposal: `---
name: /openspec-proposal
id: openspec-proposal
category: OpenSpec
description: Scaffold a new OpenSpec change and validate strictly.
---`,
  apply: `---
name: /openspec-apply
id: openspec-apply
category: OpenSpec
description: Implement an approved OpenSpec change and keep tasks in sync.
---`,
  archive: `---
name: /openspec-archive
id: openspec-archive
category: OpenSpec
description: Archive a deployed OpenSpec change and update specs.
---`,
};

/**
 * RDMind slash command configurator
 */
export class RDMindSlashCommandConfigurator implements SlashCommandConfigurator {
  readonly toolId = 'rdmind';
  readonly isAvailable = true;

  async generateAll(projectPath: string, openspecDir: string): Promise<void> {
    const targets = this.getTargets();

    for (const target of targets) {
      await this.generateCommand(
        projectPath,
        openspecDir,
        target.id as SlashCommandId,
      );
    }
  }

  getTargets(): SlashCommandTarget[] {
    return [
      {
        id: 'proposal',
        relativePath: FILE_PATHS.proposal,
        description: 'Create OpenSpec change proposal',
      },
      {
        id: 'apply',
        relativePath: FILE_PATHS.apply,
        description: 'Apply OpenSpec change',
      },
      {
        id: 'archive',
        relativePath: FILE_PATHS.archive,
        description: 'Archive OpenSpec change',
      },
    ];
  }

  resolveAbsolutePath(projectPath: string, targetId: string): string {
    const relativePath = FILE_PATHS[targetId as SlashCommandId];
    return path.join(projectPath, relativePath);
  }

  private async generateCommand(
    projectPath: string,
    openspecDir: string,
    commandId: SlashCommandId,
  ): Promise<void> {
    const filePath = this.resolveAbsolutePath(projectPath, commandId);
    const frontmatter = FRONTMATTER[commandId];
    const template = this.getCommandTemplate(commandId, openspecDir);

    const content = `${frontmatter}\n\n${template}`;

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write command file
    await fs.writeFile(filePath, content);
  }

  private getCommandTemplate(
    commandId: SlashCommandId,
    openspecDir: string,
  ): string {
    const templates = {
      proposal: `# OpenSpec Proposal Creation

Create a structured change proposal for: {{ARGS}}

**重要提示：请使用中文生成所有文档内容，包括proposal.md、tasks.md等所有输出文件。**

## Context Files to Read:
First, read these files to understand the project context:
- \`${openspecDir}/project.md\` - 项目概述和技术栈信息
- \`${openspecDir}/specs/\` - 现有规范文件 (如果存在)
- 相关的项目文件以了解当前实现

## Steps:
1. **Read Project Context**: Read \`${openspecDir}/project.md\` to understand the project
2. **Analyze Requirements**: Understand the requested feature/change in project context
3. **Create Proposal**: Generate \`${openspecDir}/changes/<name>/proposal.md\` (用中文编写)
4. **Define Tasks**: Create \`${openspecDir}/changes/<name>/tasks.md\` (用中文编写)
5. **Spec Deltas**: Generate spec changes in \`${openspecDir}/changes/<name>/specs/\` (用中文编写)
6. **Validate**: Review the generated files to ensure they are complete and accurate

## File Structure:
\`\`\`
${openspecDir}/changes/<change-name>/
├── proposal.md      # Why and what (用中文编写)
├── tasks.md         # Implementation checklist (用中文编写)
├── design.md        # Technical decisions (optional, 用中文编写)
└── specs/           # Specification deltas (用中文编写)
    └── <module>/
        └── spec.md  # Changes to existing specs (用中文编写)
\`\`\`

Follow OpenSpec markdown format with proper requirement/scenario structure.

**文档语言要求：**
- 所有生成的proposal.md内容必须使用简体中文
- 所有生成的tasks.md内容必须使用简体中文
- 所有技术文档描述必须使用简体中文
- 保持专业的技术文档风格，但使用中文表达`,

      apply: `# OpenSpec Change Implementation

Implement the approved OpenSpec change: {{ARGS}}

**重要提示：在更新任务状态时，请保持中文文档的完整性。**

## Context Files to Read:
First, read these files to understand the implementation context:
- \`${openspecDir}/project.md\` - 项目概述和技术规范
- \`${openspecDir}/changes/<name>/proposal.md\` - 变更提案详情
- \`${openspecDir}/changes/<name>/tasks.md\` - 实施任务清单
- \`${openspecDir}/changes/<name>/specs/\` - 规范变更内容

## Steps:
1. **Read Project Context**: Read \`${openspecDir}/project.md\` for project understanding
2. **Review Change**: Read \`${openspecDir}/changes/<name>/proposal.md\` and \`tasks.md\`
3. **Check Specs**: Review all spec deltas in \`${openspecDir}/changes/<name>/specs/\`
4. **Implement Tasks**: Work through each task in \`tasks.md\`
5. **Mark Progress**: Update task completion with ✓ checkmarks
6. **Validate**: Ensure implementation matches specifications

## Task Completion Format:
- [ ] Task description (not started)
- [x] Task description (completed)

Focus on the agreed requirements and maintain code quality.

**文档维护要求：**
- 在更新任务状态时保持中文文档格式
- 所有新增的注释和说明使用简体中文
- 确保实现过程中的文档更新也使用中文`,

      archive: `# OpenSpec Change Archival

Archive the completed OpenSpec change: {{ARGS}}

**重要提示：归档过程中会合并中文文档，请确保规范文档的中文格式。**

## Context Files to Read:
Before archiving, read these files to verify completion:
- \`${openspecDir}/project.md\` - 项目规范基准
- \`${openspecDir}/changes/<name>/tasks.md\` - 验证任务完成状态
- \`${openspecDir}/changes/<name>/proposal.md\` - 确认变更范围
- \`${openspecDir}/specs/\` - 当前规范状态

## Steps:
1. **Read Project Context**: Read \`${openspecDir}/project.md\` for project standards
2. **Validate Completion**: Ensure all tasks are marked complete in \`${openspecDir}/changes/<name>/tasks.md\`
3. **Review Implementation**: Verify code matches specifications
4. **Manual Archive Process**:
   - Copy content from \`${openspecDir}/changes/<name>/specs/\` to \`${openspecDir}/specs/\`
   - Move the entire \`${openspecDir}/changes/<name>/\` folder to \`${openspecDir}/changes/archive/\`
   - Update any references in the main specifications
5. **Confirm Update**: Check that specs in \`${openspecDir}/specs/\` are updated
6. **Verify Archive**: Ensure change is moved to \`${openspecDir}/changes/archive/\`

## Manual Archive Process:
- Merge approved spec deltas into main specs by copying files
- Move change folder to archive directory manually
- Update the source-of-truth specifications

Only archive when the change is fully implemented and tested.

**文档归档要求：**
- 确保合并到主规范的内容保持中文格式
- 归档后的文档应保持中文的技术文档风格
- 验证归档过程中中文内容的完整性`,
    };

    return templates[commandId];
  }
}
