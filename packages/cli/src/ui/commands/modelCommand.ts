/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  CommandContext,
  OpenDialogActionReturn,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import { getAvailableModelsForAuthType } from '../models/availableModels.js';
import { AuthType } from '@rdmind/rdmind-core';

export const modelCommand: SlashCommand = {
  name: 'model',
  description: '切换本次对话模型',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
  ): Promise<OpenDialogActionReturn | MessageActionReturn> => {
    const { services } = context;
    const { config } = services;

    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    const contentGeneratorConfig = config.getContentGeneratorConfig();
    if (!contentGeneratorConfig) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Content generator configuration not available.',
      };
    }

    const authType = contentGeneratorConfig.authType;
    if (!authType) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Authentication type not available.',
      };
    }

    // For auth types with multi-level configuration flow (OpenAI, XHS_SSO),
    // directly open the dialog without checking available models
    // The actual model configuration is handled in ModelDialog
    if (authType === AuthType.USE_OPENAI || authType === AuthType.XHS_SSO) {
      return {
        type: 'dialog',
        dialog: 'model',
      };
    }

    // For other auth types, check if models are available
    const availableModels = getAvailableModelsForAuthType(authType);

    if (availableModels.length === 0) {
      return {
        type: 'message',
        messageType: 'error',
        content: `No models available for the current authentication type (${authType}).`,
      };
    }

    // Trigger model selection dialog
    return {
      type: 'dialog',
      dialog: 'model',
    };
  },
};
