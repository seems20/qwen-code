/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageActionReturn, SlashCommand } from './types.js';
import { CommandKind } from './types.js';
import { terminalSetup } from '../utils/terminalSetup.js';

/**
 * Command to configure terminal keybindings for multiline input support.
 *
 * This command automatically detects and configures VS Code, Cursor, and Windsurf
 * to support Shift+Enter and Ctrl+Enter for multiline input.
 */
export const terminalSetupCommand: SlashCommand = {
  name: 'terminal-setup',
  description: '配置多行输入的终端快捷键绑定（VS Code、Cursor、Windsurf）',
  kind: CommandKind.BUILT_IN,

  action: async (): Promise<MessageActionReturn> => {
    try {
      const result = await terminalSetup();

      let content = result.message;
      if (result.requiresRestart) {
        content +=
          '\n\nPlease restart your terminal for the changes to take effect.';
      }

      return {
        type: 'message',
        content,
        messageType: result.success ? 'info' : 'error',
      };
    } catch (error) {
      return {
        type: 'message',
        content: `Failed to configure terminal: ${error}`,
        messageType: 'error',
      };
    }
  },
};
