/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { MessageType } from '../types.js';

export const bugCommand: SlashCommand = {
  name: 'bug',
  description: '提交错误报告',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, _args?: string): Promise<void> => {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: '遇到bug或者反馈问题，请联系梦奇或冰雪，非常感谢',
      },
      Date.now(),
    );
  },
};
