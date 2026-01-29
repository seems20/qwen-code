/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { z } from 'zod';
import type { Config } from '@rdmind/rdmind-core';
import type { ICommandLoader } from './types.js';
import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
} from '../ui/commands/types.js';
import { CommandKind } from '../ui/commands/types.js';
import { t } from '../i18n/index.js';

/**
 * Schema for validating YAML front matter in OpenSpec markdown command files.
 * OpenSpec commands always have a name field in their frontmatter.
 */
const MarkdownCommandDefSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Loads slash commands from OpenSpec-generated markdown files with YAML front matter.
 * These files are typically generated in .rdmind/commands/ directory by OpenSpec configurators.
 */
export class MarkdownCommandLoader implements ICommandLoader {
  private readonly projectRoot: string;
  private readonly folderTrustEnabled: boolean;
  private readonly folderTrust: boolean;

  constructor(config: Config | null) {
    this.folderTrustEnabled = !!config?.getFolderTrustFeature();
    this.folderTrust = !!config?.getFolderTrust();
    this.projectRoot = config?.getProjectRoot() || process.cwd();
  }

  /**
   * Loads all markdown commands from OpenSpec directories.
   * Only loads commands that are specifically marked as OpenSpec commands
   * (either by category: OpenSpec in frontmatter or filename starting with 'openspec-').
   */
  async loadCommands(signal: AbortSignal): Promise<SlashCommand[]> {
    if (this.folderTrustEnabled && !this.folderTrust) {
      return [];
    }

    const allCommands: SlashCommand[] = [];
    const globOptions = {
      nodir: true,
      dot: true,
      signal,
      follow: true,
    };

    // Load commands from OpenSpec command directories
    const commandDirs = this.getOpenSpecCommandDirectories();
    for (const dirPath of commandDirs) {
      try {
        // Only load files that start with 'openspec-' (OpenSpec command naming convention)
        const files = await glob('**/openspec-*.md', {
          ...globOptions,
          cwd: dirPath,
        });

        const commandPromises = files.map((file) =>
          this.parseAndAdaptFile(path.join(dirPath, file)),
        );

        const commands = (await Promise.all(commandPromises)).filter(
          (cmd): cmd is SlashCommand => cmd !== null,
        );

        allCommands.push(...commands);
      } catch (error) {
        // Ignore ENOENT (directory doesn't exist) and AbortError
        const isEnoent = (error as NodeJS.ErrnoException).code === 'ENOENT';
        const isAbortError =
          error instanceof Error && error.name === 'AbortError';
        if (!isEnoent && !isAbortError) {
          console.error(
            `[MarkdownCommandLoader] Error loading commands from ${dirPath}:`,
            error,
          );
        }
      }
    }

    return allCommands;
  }

  /**
   * Get directories containing OpenSpec markdown command files.
   */
  private getOpenSpecCommandDirectories(): string[] {
    // OpenSpec generates commands in .rdmind/commands/
    const rdmindCommandsDir = path.join(
      this.projectRoot,
      '.rdmind',
      'commands',
    );
    return [rdmindCommandsDir];
  }

  /**
   * Parses a markdown file with YAML front matter and converts it to a SlashCommand.
   */
  private async parseAndAdaptFile(
    filePath: string,
  ): Promise<SlashCommand | null> {
    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (error: unknown) {
      console.error(
        `[MarkdownCommandLoader] Failed to read file ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }

    // Parse YAML front matter
    const frontMatterResult = this.parseFrontMatter(fileContent);
    if (!frontMatterResult) {
      return null;
    }

    const { frontMatter, content } = frontMatterResult;

    // Validate front matter
    const validationResult = MarkdownCommandDefSchema.safeParse(frontMatter);
    if (!validationResult.success) {
      console.error(
        `[MarkdownCommandLoader] Invalid front matter in ${filePath}:`,
        validationResult.error.flatten(),
      );
      return null;
    }

    const validDef = validationResult.data;

    // Only process OpenSpec commands: check if category is 'OpenSpec' or id starts with 'openspec-'
    const isOpenSpecCommand =
      validDef.category === 'OpenSpec' ||
      (typeof validDef.id === 'string' &&
        validDef.id.startsWith('openspec-')) ||
      path.basename(filePath, '.md').startsWith('openspec-');

    if (!isOpenSpecCommand) {
      // Skip non-OpenSpec commands - they should be handled by FileCommandLoader
      return null;
    }

    // Extract command name from front matter (OpenSpec commands always have name)
    const commandName = validDef.name.startsWith('/')
      ? validDef.name.substring(1)
      : validDef.name;

    // Translate OpenSpec command descriptions
    let description = validDef.description || '';
    if (commandName === 'openspec-proposal') {
      description = t('Scaffold a new OpenSpec change and validate strictly.');
    } else if (commandName === 'openspec-apply') {
      description = t(
        'Implement an approved OpenSpec change and keep tasks in sync.',
      );
    } else if (commandName === 'openspec-archive') {
      description = t('Archive a deployed OpenSpec change and update specs.');
    }

    return {
      name: commandName,
      description,
      kind: CommandKind.FILE,
      action: async (
        context: CommandContext,
        args: string,
      ): Promise<SlashCommandActionReturn> => {
        // For OpenSpec commands, we submit the content as a prompt
        const prompt = content.trim() + (args ? `\n\n${args}` : '');

        return {
          type: 'submit_prompt',
          content: [{ text: prompt }],
        };
      },
    };
  }

  /**
   * Parses YAML front matter from markdown content.
   */
  private parseFrontMatter(content: string): {
    frontMatter: Record<string, unknown>;
    content: string;
  } | null {
    const lines = content.split('\n');

    if (lines[0]?.trim() !== '---') {
      return null;
    }

    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return null;
    }

    const frontMatterLines = lines.slice(1, endIndex);
    const contentLines = lines.slice(endIndex + 1);

    try {
      const frontMatter: Record<string, string> = {};
      for (const line of frontMatterLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex > 0) {
            const key = trimmed.substring(0, colonIndex).trim();
            const value = trimmed.substring(colonIndex + 1).trim();
            frontMatter[key] = value;
          }
        }
      }

      return {
        frontMatter,
        content: contentLines.join('\n'),
      };
    } catch (error) {
      console.error('Failed to parse front matter:', error);
      return null;
    }
  }
}
