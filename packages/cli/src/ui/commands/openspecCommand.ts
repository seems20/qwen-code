/**
 * @license
 * Copyright 2025 RDMind
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import { OpenSpecInitCommand } from '../../commands/openspec/init.js';
import { t } from '../../i18n/index.js';

export const openspecCommand: SlashCommand = {
  name: 'openspec',
  get description() {
    return t('Initialize OpenSpec in a project with RDMind integration');
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'init',
      get description() {
        return t('Initialize OpenSpec in the current directory');
      },
      kind: CommandKind.BUILT_IN,
      action: async (
        context: CommandContext,
        args: string,
      ): Promise<SlashCommandActionReturn> =>
        await OpenSpecInitCommand.execute(context, args),
    },
  ],
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn> => {
    // Default action for base command - show help
    const trimmedArgs = args.trim();

    if (!trimmedArgs) {
      return {
        type: 'message',
        messageType: 'info',
        content: `OpenSpec Commands:

/openspec init [path] [--tools rdmind] - Initialize OpenSpec in a project

OpenSpec enables structured, spec-driven development with:
- Change proposals and implementation tracking
- RDMind integration for AI-assisted development
- Structured file organization and templates

Usage Examples:
- /openspec init                    # Initialize in current directory
- /openspec init ./my-project      # Initialize in specific directory
- /openspec init --tools rdmind      # Initialize with RDMind support

For more help, see: https://github.com/Fission-AI/OpenSpec`,
      };
    }

    // If args are provided but no subcommand matched, treat as init with args
    return await OpenSpecInitCommand.execute(context, args);
  },
};
