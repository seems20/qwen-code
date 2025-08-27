/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { uiTelemetryService } from '@qwen-code/qwen-code-core';
import { CommandKind, SlashCommand } from './types.js';

export const clearCommand: SlashCommand = {
  name: 'clear',
  description: '清空屏幕和对话历史记录',
  kind: CommandKind.BUILT_IN,
  action: async (context, _args) => {
    const geminiClient = context.services.config?.getGeminiClient();

    if (geminiClient) {
      context.ui.setDebugMessage('Clearing terminal and resetting chat.');
      // If resetChat fails, the exception will propagate and halt the command,
      // which is the correct behavior to signal a failure to the user.
      await geminiClient.resetChat();
    } else {
      context.ui.setDebugMessage('Clearing terminal.');
    }

    uiTelemetryService.resetLastPromptTokenCount();
    context.session.resetSession();
    context.ui.clear();
  },
};
