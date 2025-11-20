/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CommandKind,
  type SlashCommand,
  type CommandContext,
  type SlashCommandActionReturn,
} from './types.js';
import { MessageType } from '../types.js';
import { readKnowledgeExt } from '@rdmind/rdmind-core';

interface BmadProfile {
  key: string;
  label: string;
  knowledgePath: string;
  description: string;
}

const BMAD_CORE_CONFIG_PATH = '.bmad-core/core-config.yaml';

const BMAD_PROFILES: Record<string, BmadProfile> = {
  architect: {
    key: 'architect',
    label: 'BMAD 架构师',
    knowledgePath: '.bmad-core/agents/architect.md',
    description:
      '系统架构、技术选型、跨端协作等需要严谨产出的场景。命令示例：/bmad architect 设计直播电商系统。',
  },
  dev: {
    key: 'dev',
    label: 'BMAD 全栈开发',
    knowledgePath: '.bmad-core/agents/dev.md',
    description:
      '负责全栈交付与编码实现，适合编写高质量代码、代码评审、实现方案细化等。',
  },
  pm: {
    key: 'pm',
    label: 'BMAD 产品经理',
    knowledgePath: '.bmad-core/agents/pm.md',
    description:
      '面向产品规划、需求拆解、路线图制定，可用于撰写 PRD 或评估产品策略。',
  },
  po: {
    key: 'po',
    label: 'BMAD 产品负责人',
    knowledgePath: '.bmad-core/agents/po.md',
    description:
      '聚焦业务目标、价值验证与交付优先级排序，适合产品决策与价值论证任务。',
  },
  qa: {
    key: 'qa',
    label: 'BMAD 质量专家',
    knowledgePath: '.bmad-core/agents/qa.md',
    description:
      '负责测试策略、用例设计、质量评估与缺陷治理，适合制定测试方案与验收标准。',
  },
  sm: {
    key: 'sm',
    label: 'BMAD 敏捷教练',
    knowledgePath: '.bmad-core/agents/sm.md',
    description:
      '承担流程改进、节奏管控与敏捷教练职责，适合敏捷仪式规划、风险排查。',
  },
};

const formatUsageMessage = (): string => {
  // 计算最大名称长度以对齐
  const maxNameLength = Math.max(
    ...Object.values(BMAD_PROFILES).map((p) => p.key.length),
  );
  const entries = Object.values(BMAD_PROFILES)
    .map((profile) => {
      const paddedName = profile.key.padEnd(maxNameLength, ' ');
      return `${paddedName}   ${profile.label}`;
    })
    .join('\n');
  return `可选 persona：\n${entries}\n\n示例：\n/bmad architect 设计跨境直播系统\n/bmad qa 编写验收测试计划`;
};

const buildPrompt = (params: {
  profile: BmadProfile;
  profileContent: string;
  coreConfigContent?: string;
  userRequest: string;
}): string => {
  const { profile, profileContent, coreConfigContent, userRequest } = params;
  const sections: string[] = [
    `你正在通过 "/bmad ${profile.key}" 命令激活 ${profile.label}。严格遵循以下 BMAD 定义与工作流：`,
    '### 🔐 BMAD 角色定义（只读，禁止篡改）',
    '```markdown',
    profileContent.trim(),
    '```',
  ];

  if (coreConfigContent) {
    sections.push(
      '### 🗂️ 项目 core-config（供 activation 步骤引用）',
      '```yaml',
      coreConfigContent.trim(),
      '```',
    );
  }

  sections.push(
    '### ✅ 执行要求',
    '- 视上述 YAML 为唯一权威指令，按 activation-instructions 先完成自检流程，再处理任务。',
    '- 只有在指令要求时才加载其他 BMAD 依赖文件，保持对话中严格的编号交互规范。',
    '- 输出需结构化、可执行，写清假设与决策理由；遇到不确定信息必须向用户澄清。',
    '- 如果任务不属于该角色职责，礼貌说明并建议更合适的处理方式。',
    '### 🈯️ 输出与菜单覆盖',
    '- 覆盖 YAML 中“激活后自动运行 *help”的要求：完成自检并问候用户后，直接用中文澄清需求，不要自动展示 `*help` 或任何英文命令清单，除非用户明确请求帮助或命令列表。',
    '- 当确有需要提及可用操作时，请只用中文描述（例如“创建后端架构文档”、“执行架构检查清单”），并省略 `*create-backend-architecture` 等英文命令名称，除非用户要求精确语法。',
    '### 🧑‍💻 当前任务',
    userRequest.trim(),
  );

  return sections.join('\n\n');
};

const addMessageItem = (
  context: CommandContext,
  text: string,
  type: 'info' | 'error' = 'info',
) => {
  context.ui.addItem(
    {
      type: type === 'info' ? MessageType.INFO : MessageType.ERROR,
      text,
    },
    Date.now(),
  );
};

const executeBmadPersona = async (
  context: CommandContext,
  profile: BmadProfile,
  rawArgs: string,
): Promise<SlashCommandActionReturn | void> => {
  const request = rawArgs.trim();
  const normalizedRequest =
    request ||
    `【系统提示】用户仅输入 "/bmad ${profile.key}"，尚未提供具体任务。请按照 activation-instructions 完成自检后，先向用户确认需求，再继续。`;

  if (!request) {
    addMessageItem(
      context,
      `未检测到任务描述，已自动提示 ${profile.label} 先询问需求。`,
      'info',
    );
  }

  const profileResult = await readKnowledgeExt(profile.knowledgePath, true);
  if (!profileResult) {
    return {
      type: 'message',
      messageType: 'error',
      content: `未找到 ${profile.label} 定义文件：${profile.knowledgePath}`,
    };
  }

  const coreConfigResult = await readKnowledgeExt(BMAD_CORE_CONFIG_PATH, true);

  const prompt = buildPrompt({
    profile,
    profileContent: profileResult.content,
    coreConfigContent: coreConfigResult?.content,
    userRequest: normalizedRequest,
  });

  return {
    type: 'submit_prompt',
    content: prompt,
  };
};

const personaSubCommands: SlashCommand[] = Object.values(BMAD_PROFILES).map(
  (profile) => ({
    name: profile.key,
    description: profile.label, // 使用简洁的标签作为描述，用于系统自动提示
    kind: CommandKind.BUILT_IN,
    action: async (context, args) => executeBmadPersona(context, profile, args),
  }),
);

export const bmadCommand: SlashCommand = {
  name: 'bmad',
  description: '激活内置 BMAD 角色，目前支持 architect/dev/pm/po/qa/sm。',
  kind: CommandKind.BUILT_IN,
  subCommands: personaSubCommands,
  action: async (
    context,
    rawArgs,
  ): Promise<SlashCommandActionReturn | void> => {
    const trimmed = rawArgs.trim();

    if (!trimmed) {
      // 返回明确的 message 类型，避免系统自动显示 subCommands 列表
      return {
        type: 'message',
        messageType: 'info',
        content: formatUsageMessage(),
      };
    }

    const [persona, ...restParts] = trimmed.split(/\s+/);
    const profile = BMAD_PROFILES[persona?.toLowerCase() || ''];

    if (!profile) {
      // 返回明确的 message 类型，避免系统自动显示 subCommands 列表
      return {
        type: 'message',
        messageType: 'error',
        content: `不支持的 persona：${persona}\n\n${formatUsageMessage()}`,
      };
    }

    const remainingArgs = restParts.join(' ');
    return await executeBmadPersona(context, profile, remainingArgs);
  },
  completion: async (_context, partial: string): Promise<string[]> => {
    const personas = Object.keys(BMAD_PROFILES);
    if (!partial) {
      return personas;
    }
    return personas.filter((key) =>
      key.toLowerCase().startsWith(partial.toLowerCase()),
    );
  },
};
