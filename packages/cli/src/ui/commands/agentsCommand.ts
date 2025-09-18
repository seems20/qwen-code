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
  description: '子代理',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'manage',
      description: '管理子代理',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'subagent_list',
      }),
    },
    {
      name: 'create',
      description: '创建子代理',
      kind: CommandKind.BUILT_IN,
      action: (): OpenDialogActionReturn => ({
        type: 'dialog',
        dialog: 'subagent_create',
      }),
    },
  ],
};
