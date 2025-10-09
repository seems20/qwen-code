/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  SlashCommand,
  CommandContext,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import { ApprovalMode, APPROVAL_MODES } from '@rdmind/rdmind-core';
import { SettingScope } from '../../config/settings.js';

const USAGE_MESSAGE =
  'Usage: /approval-mode <mode> [--session|--user|--project]';

const normalizeInputMode = (value: string): string =>
  value.trim().toLowerCase();

const tokenizeArgs = (args: string): string[] => {
  const matches = args.match(/(?:"[^"]*"|'[^']*'|[^\s"']+)/g);
  if (!matches) {
    return [];
  }

  return matches.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }
    return token;
  });
};

const parseApprovalMode = (value: string | null): ApprovalMode | null => {
  if (!value) {
    return null;
  }

  const normalized = normalizeInputMode(value).replace(/_/g, '-');
  const matchIndex = APPROVAL_MODES.findIndex(
    (candidate) => candidate === normalized,
  );

  return matchIndex === -1 ? null : APPROVAL_MODES[matchIndex];
};

const formatModeDescription = (mode: ApprovalMode): string => {
  switch (mode) {
    case ApprovalMode.PLAN:
      return '计划模式 - 仅分析，不修改文件或执行命令';
    case ApprovalMode.DEFAULT:
      return '默认模式 - 文件编辑或shell命令需要审批';
    case ApprovalMode.AUTO_EDIT:
      return '自动编辑模式 - 自动批准文件编辑';
    case ApprovalMode.YOLO:
      return 'YOLO模式 - 自动批准所有工具';
    default:
      return `${mode} mode`;
  }
};

const parseApprovalArgs = (
  args: string,
): {
  mode: string | null;
  scope: 'session' | 'user' | 'project';
  error?: string;
} => {
  const trimmedArgs = args.trim();
  if (!trimmedArgs) {
    return { mode: null, scope: 'session' };
  }

  const tokens = tokenizeArgs(trimmedArgs);
  let mode: string | null = null;
  let scope: 'session' | 'user' | 'project' = 'session';
  let scopeFlag: string | null = null;

  // Find scope flag and mode
  for (const token of tokens) {
    if (token === '--session' || token === '--user' || token === '--project') {
      if (scopeFlag) {
        return {
          mode: null,
          scope: 'session',
          error: 'Multiple scope flags provided',
        };
      }
      scopeFlag = token;
      scope = token.substring(2) as 'session' | 'user' | 'project';
    } else if (!mode) {
      mode = token;
    } else {
      return {
        mode: null,
        scope: 'session',
        error: 'Invalid arguments provided',
      };
    }
  }

  if (!mode) {
    return { mode: null, scope: 'session', error: 'Missing approval mode' };
  }

  return { mode, scope };
};

const setApprovalModeWithScope = async (
  context: CommandContext,
  mode: ApprovalMode,
  scope: 'session' | 'user' | 'project',
): Promise<MessageActionReturn> => {
  const { services } = context;
  const { config } = services;

  if (!config) {
    return {
      type: 'message',
      messageType: 'error',
      content: 'Configuration not available.',
    };
  }

  try {
    // Always set the mode in the current session
    config.setApprovalMode(mode);

    // If scope is not session, also persist to settings
    if (scope !== 'session') {
      const { settings } = context.services;
      if (!settings || typeof settings.setValue !== 'function') {
        return {
          type: 'message',
          messageType: 'error',
          content:
            'Settings service is not available; unable to persist the approval mode.',
        };
      }

      const settingScope =
        scope === 'user' ? SettingScope.User : SettingScope.Workspace;
      const scopeLabel = scope === 'user' ? 'user' : 'project';
      let settingsPath: string | undefined;

      try {
        if (typeof settings.forScope === 'function') {
          settingsPath = settings.forScope(settingScope)?.path;
        }
      } catch (_error) {
        settingsPath = undefined;
      }

      try {
        settings.setValue(settingScope, 'approvalMode', mode);
      } catch (error) {
        return {
          type: 'message',
          messageType: 'error',
          content: `Failed to save approval mode: ${(error as Error).message}`,
        };
      }

      const locationSuffix = settingsPath ? ` at ${settingsPath}` : '';

      const scopeSuffix = ` (saved to ${scopeLabel} settings${locationSuffix})`;

      return {
        type: 'message',
        messageType: 'info',
        content: `Approval mode changed to: ${mode}${scopeSuffix}`,
      };
    }

    return {
      type: 'message',
      messageType: 'info',
      content: `Approval mode changed to: ${mode}`,
    };
  } catch (error) {
    return {
      type: 'message',
      messageType: 'error',
      content: `Failed to change approval mode: ${(error as Error).message}`,
    };
  }
};

export const approvalModeCommand: SlashCommand = {
  name: 'approval-mode',
  description: '查看或切换工具使用的审批模式',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<MessageActionReturn> => {
    const { config } = context.services;
    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    // If no arguments provided, show current mode and available options
    if (!args || args.trim() === '') {
      const currentMode =
        typeof config.getApprovalMode === 'function'
          ? config.getApprovalMode()
          : null;

      const messageLines: string[] = [];

      if (currentMode) {
        messageLines.push(`Current approval mode: ${currentMode}`);
        messageLines.push('');
      }

      messageLines.push('Available approval modes:');
      for (const mode of APPROVAL_MODES) {
        messageLines.push(`  - ${mode}: ${formatModeDescription(mode)}`);
      }
      messageLines.push('');
      messageLines.push(USAGE_MESSAGE);

      return {
        type: 'message',
        messageType: 'info',
        content: messageLines.join('\n'),
      };
    }

    // Parse arguments flexibly
    const parsed = parseApprovalArgs(args);

    if (parsed.error) {
      return {
        type: 'message',
        messageType: 'error',
        content: `${parsed.error}. ${USAGE_MESSAGE}`,
      };
    }

    if (!parsed.mode) {
      return {
        type: 'message',
        messageType: 'info',
        content: USAGE_MESSAGE,
      };
    }

    const requestedMode = parseApprovalMode(parsed.mode);

    if (!requestedMode) {
      let message = `Invalid approval mode: ${parsed.mode}\n\n`;
      message += 'Available approval modes:\n';
      for (const mode of APPROVAL_MODES) {
        message += `  - ${mode}: ${formatModeDescription(mode)}\n`;
      }
      message += `\n${USAGE_MESSAGE}`;
      return {
        type: 'message',
        messageType: 'error',
        content: message,
      };
    }

    return setApprovalModeWithScope(context, requestedMode, parsed.scope);
  },
  subCommands: APPROVAL_MODES.map((mode) => ({
    name: mode,
    description: formatModeDescription(mode),
    kind: CommandKind.BUILT_IN,
    subCommands: [
      {
        name: '--session',
        description: '仅应用于当前会话（临时）',
        kind: CommandKind.BUILT_IN,
        action: async (
          context: CommandContext,
          args: string,
        ): Promise<MessageActionReturn> => {
          if (args.trim().length > 0) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Scope subcommands do not accept additional arguments.',
            };
          }
          return setApprovalModeWithScope(context, mode, 'session');
        },
      },
      {
        name: '--project',
        description: '为此项目/工作区保持设置',
        kind: CommandKind.BUILT_IN,
        action: async (
          context: CommandContext,
          args: string,
        ): Promise<MessageActionReturn> => {
          if (args.trim().length > 0) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Scope subcommands do not accept additional arguments.',
            };
          }
          return setApprovalModeWithScope(context, mode, 'project');
        },
      },
      {
        name: '--user',
        description: '为当前用户保持设置',
        kind: CommandKind.BUILT_IN,
        action: async (
          context: CommandContext,
          args: string,
        ): Promise<MessageActionReturn> => {
          if (args.trim().length > 0) {
            return {
              type: 'message',
              messageType: 'error',
              content: 'Scope subcommands do not accept additional arguments.',
            };
          }
          return setApprovalModeWithScope(context, mode, 'user');
        },
      },
    ],
    action: async (
      context: CommandContext,
      args: string,
    ): Promise<MessageActionReturn> => {
      if (args.trim().length > 0) {
        // Allow users who type `/approval-mode plan --user` via the subcommand path
        const parsed = parseApprovalArgs(`${mode} ${args}`);
        if (parsed.error) {
          return {
            type: 'message',
            messageType: 'error',
            content: `${parsed.error}. ${USAGE_MESSAGE}`,
          };
        }

        const normalizedMode = parseApprovalMode(parsed.mode);
        if (!normalizedMode) {
          return {
            type: 'message',
            messageType: 'error',
            content: `Invalid approval mode: ${parsed.mode}. ${USAGE_MESSAGE}`,
          };
        }

        return setApprovalModeWithScope(context, normalizedMode, parsed.scope);
      }

      return setApprovalModeWithScope(context, mode, 'session');
    },
  })),
  completion: async (_context: CommandContext, partialArg: string) => {
    const tokens = tokenizeArgs(partialArg);
    const hasTrailingSpace = /\s$/.test(partialArg);
    const currentSegment = hasTrailingSpace
      ? ''
      : tokens.length > 0
        ? tokens[tokens.length - 1]
        : '';

    const normalizedCurrent = normalizeInputMode(currentSegment).replace(
      /_/g,
      '-',
    );

    const scopeValues = ['--session', '--project', '--user'];

    const normalizeToken = (token: string) =>
      normalizeInputMode(token).replace(/_/g, '-');

    const normalizedTokens = tokens.map(normalizeToken);

    if (tokens.length === 0) {
      if (currentSegment.startsWith('-')) {
        return scopeValues.filter((scope) => scope.startsWith(currentSegment));
      }
      return APPROVAL_MODES;
    }

    if (tokens.length === 1 && !hasTrailingSpace) {
      const originalToken = tokens[0];
      if (originalToken.startsWith('-')) {
        return scopeValues.filter((scope) =>
          scope.startsWith(normalizedCurrent),
        );
      }
      return APPROVAL_MODES.filter((mode) =>
        mode.startsWith(normalizedCurrent),
      );
    }

    if (tokens.length === 1 && hasTrailingSpace) {
      const normalizedFirst = normalizedTokens[0];
      if (scopeValues.includes(tokens[0])) {
        return APPROVAL_MODES;
      }
      if (APPROVAL_MODES.includes(normalizedFirst as ApprovalMode)) {
        return scopeValues;
      }
      return APPROVAL_MODES;
    }

    if (tokens.length === 2 && !hasTrailingSpace) {
      const normalizedFirst = normalizedTokens[0];
      if (scopeValues.includes(tokens[0])) {
        return APPROVAL_MODES.filter((mode) =>
          mode.startsWith(normalizedCurrent),
        );
      }
      if (APPROVAL_MODES.includes(normalizedFirst as ApprovalMode)) {
        return scopeValues.filter((scope) =>
          scope.startsWith(normalizedCurrent),
        );
      }
      return [];
    }

    return [];
  },
};
