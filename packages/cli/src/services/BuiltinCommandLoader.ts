/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICommandLoader } from './types.js';
import type { SlashCommand } from '../ui/commands/types.js';
import type { Config } from '@rdmind/rdmind-core';
import { aboutCommand } from '../ui/commands/aboutCommand.js';
import { agentsCommand } from '../ui/commands/agentsCommand.js';
import { approvalModeCommand } from '../ui/commands/approvalModeCommand.js';
import { authCommand } from '../ui/commands/authCommand.js';
import { bugCommand } from '../ui/commands/bugCommand.js';
import { bmadCommand } from '../ui/commands/bmadCommand.js';
import { clearCommand } from '../ui/commands/clearCommand.js';
import { compressCommand } from '../ui/commands/compressCommand.js';
import { copyCommand } from '../ui/commands/copyCommand.js';
import { createCommand } from '../ui/commands/createCommand.js';
import { docsCommand } from '../ui/commands/docsCommand.js';
import { directoryCommand } from '../ui/commands/directoryCommand.js';
import { editorCommand } from '../ui/commands/editorCommand.js';
import { extensionsCommand } from '../ui/commands/extensionsCommand.js';
import { helpCommand } from '../ui/commands/helpCommand.js';
import { ideCommand } from '../ui/commands/ideCommand.js';
import { importCommand } from '../ui/commands/importCommand.js';
import { initCommand } from '../ui/commands/initCommand.js';
import { languageCommand } from '../ui/commands/languageCommand.js';
import { mcpCommand } from '../ui/commands/mcpCommand.js';
import { memoryCommand } from '../ui/commands/memoryCommand.js';
import { modelCommand } from '../ui/commands/modelCommand.js';
import { quitCommand } from '../ui/commands/quitCommand.js';
import { rdconfigCommand } from '../ui/commands/rdconfigCommand.js';
import { rdflowCommand } from '../ui/commands/rdflowCommand.js';
import { restoreCommand } from '../ui/commands/restoreCommand.js';
import { resumeCommand } from '../ui/commands/resumeCommand.js';
import { settingsCommand } from '../ui/commands/settingsCommand.js';
import { ssoCommand } from '../ui/commands/ssoCommand.js';
import { statsCommand } from '../ui/commands/statsCommand.js';
import { summaryCommand } from '../ui/commands/summaryCommand.js';
import { techDesignCommand } from '../ui/commands/techDesignCommand.js';
import { terminalSetupCommand } from '../ui/commands/terminalSetupCommand.js';
import { themeCommand } from '../ui/commands/themeCommand.js';
import { toolsCommand } from '../ui/commands/toolsCommand.js';
import { vimCommand } from '../ui/commands/vimCommand.js';
import { openspecCommand } from '../ui/commands/openspecCommand.js';

/**
 * Loads the core, hard-coded slash commands that are an integral part
 * of the Gemini CLI application.
 */
export class BuiltinCommandLoader implements ICommandLoader {
  constructor(private config: Config | null) {}

  /**
   * Gathers all raw built-in command definitions, injects dependencies where
   * needed (e.g., config) and filters out any that are not available.
   *
   * @param _signal An AbortSignal (unused for this synchronous loader).
   * @returns A promise that resolves to an array of `SlashCommand` objects.
   */
  async loadCommands(_signal: AbortSignal): Promise<SlashCommand[]> {
    const allDefinitions: Array<SlashCommand | null> = [
      aboutCommand,
      agentsCommand,
      approvalModeCommand,
      authCommand,
      bugCommand,
      bmadCommand,
      clearCommand,
      compressCommand,
      copyCommand,
      createCommand,
      docsCommand,
      directoryCommand,
      editorCommand,
      extensionsCommand,
      helpCommand,
      await ideCommand(),
      importCommand,
      initCommand,
      openspecCommand,
      rdflowCommand,
      rdconfigCommand,
      languageCommand,
      mcpCommand,
      memoryCommand,
      modelCommand,
      quitCommand,
      restoreCommand(this.config),
      resumeCommand,
      statsCommand,
      summaryCommand,
      techDesignCommand,
      themeCommand,
      toolsCommand,
      settingsCommand,
      ssoCommand,
      vimCommand,
      terminalSetupCommand,
    ];

    return allDefinitions.filter((cmd): cmd is SlashCommand => cmd !== null);
  }
}
