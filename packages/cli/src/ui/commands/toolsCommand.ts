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
import { MessageType, type HistoryItemToolsList } from '../types.js';

export const toolsCommand: SlashCommand = {
  name: 'tools',
  description: '列出 RDMind 可用工具',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args?: string): Promise<void> => {
    const subCommand = args?.trim();

    // Default to NOT showing descriptions. The user must opt in with an argument.
    let useShowDescriptions = false;
    if (subCommand === 'desc' || subCommand === 'descriptions') {
      useShowDescriptions = true;
    }

    const toolRegistry = context.services.config?.getToolRegistry();
    if (!toolRegistry) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: 'Could not retrieve tool registry.',
        },
        Date.now(),
      );
      return;
    }

    const tools = toolRegistry.getAllTools();
    // 通过检查是否缺少 serverName 属性来过滤掉 MCP 工具
    const geminiTools = tools.filter((tool) => !('serverName' in tool));

    const toolsListItem: HistoryItemToolsList = {
      type: MessageType.TOOLS_LIST,
      tools: geminiTools.map((tool) => ({
        name: tool.name,
        displayName: tool.displayName,
        description: tool.description,
      })),
      showDescriptions: useShowDescriptions,
    };

    context.ui.addItem(toolsListItem, Date.now());
  },
};
