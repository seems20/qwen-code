/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  CommandContext,
  OpenDialogActionReturn,
} from './types.js';
import { CommandKind } from './types.js';

export const approvalModeCommand: SlashCommand = {
  name: 'approval-mode',
  description: '查看或切换工具使用的审批模式',
  kind: CommandKind.BUILT_IN,
  action: async (
    _context: CommandContext,
    _args: string,
  ): Promise<OpenDialogActionReturn> => ({
    type: 'dialog',
    dialog: 'approval-mode',
  }),
};
