/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CommandKind,
  type SlashCommand,
  type OpenDialogActionReturn,
} from './types.js';

export const agentsCommand: SlashCommand = {
  name: 'agents',
  description: '管理subagents完成特定任务',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'manage',
      description: '查看、编辑或删除现有subagents',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'subagent_list',
      }),
    },
    {
      name: 'create',
      description: '引导式创建新subagent',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'subagent_create',
      }),
    },
  ],
};
