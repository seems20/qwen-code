/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SlashCommand, CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { loadServerHierarchicalMemory } from '@rdmind/rdmind-core';
import { t } from '../../i18n/index.js';

export function expandHomeDir(p: string): string {
  if (!p) {
    return '';
  }
  let expandedPath = p;
  if (p.toLowerCase().startsWith('%userprofile%')) {
    expandedPath = os.homedir() + p.substring('%userprofile%'.length);
  } else if (p === '~' || p.startsWith('~/')) {
    expandedPath = os.homedir() + p.substring(1);
  }
  return path.normalize(expandedPath);
}

export const directoryCommand: SlashCommand = {
  name: 'directory',
  altNames: ['dir'],
  get description() {
    return t('Manage workspace directories');
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'add',
      get description() {
        return t(
          'Add directories to the workspace. Use comma to separate multiple paths',
        );
      },
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args: string) => {
        const {
          ui: { addItem },
          services: { config },
        } = context;
        const [...rest] = args.split(' ');

        if (!config) {
          addItem(
            {
              type: MessageType.ERROR,
              text: t('Configuration is not available.'),
            },
            Date.now(),
          );
          return;
        }

        const workspaceContext = config.getWorkspaceContext();

        const pathsToAdd = rest
          .join(' ')
          .split(',')
          .filter((p) => p);
        if (pathsToAdd.length === 0) {
          addItem(
            {
              type: MessageType.ERROR,
              text: t('Please provide at least one path to add.'),
            },
            Date.now(),
          );
          return;
        }

        if (config.isRestrictiveSandbox()) {
          return {
            type: 'message' as const,
            messageType: 'error' as const,
            content: t(
              'The /directory add command is not supported in restrictive sandbox profiles. Please use --include-directories when starting the session instead.',
            ),
          };
        }

        const added: string[] = [];
        const errors: string[] = [];

        for (const pathToAdd of pathsToAdd) {
          try {
            workspaceContext.addDirectory(expandHomeDir(pathToAdd.trim()));
            added.push(pathToAdd.trim());
          } catch (e) {
            const error = e as Error;
            errors.push(
              t("Error adding '{{path}}': {{error}}", {
                path: pathToAdd.trim(),
                error: error.message,
              }),
            );
          }
        }

        try {
          if (config.shouldLoadMemoryFromIncludeDirectories()) {
            const { memoryContent, fileCount } =
              await loadServerHierarchicalMemory(
                config.getWorkingDir(),
                [
                  ...config.getWorkspaceContext().getDirectories(),
                  ...pathsToAdd,
                ],
                config.getDebugMode(),
                config.getFileService(),
                config.getExtensionContextFilePaths(),
                config.getFolderTrust(),
                context.services.settings.merged.context?.importFormat ||
                  'tree', // Use setting or default to 'tree'
              );
            config.setUserMemory(memoryContent);
            config.setGeminiMdFileCount(fileCount);
            context.ui.setGeminiMdFileCount(fileCount);
          }
          addItem(
            {
              type: MessageType.INFO,
              text: t(
                'Successfully added RDMind.md files from the following directories if there are:\n- {{directories}}',
                {
                  directories: added.join('\n- '),
                },
              ),
            },
            Date.now(),
          );
        } catch (error) {
          errors.push(
            t('Error refreshing memory: {{error}}', {
              error: (error as Error).message,
            }),
          );
        }

        if (added.length > 0) {
          const gemini = config.getGeminiClient();
          if (gemini) {
            await gemini.addDirectoryContext();
          }
          addItem(
            {
              type: MessageType.INFO,
              text: t('Successfully added directories:\n- {{directories}}', {
                directories: added.join('\n- '),
              }),
            },
            Date.now(),
          );
        }

        if (errors.length > 0) {
          addItem(
            { type: MessageType.ERROR, text: errors.join('\n') },
            Date.now(),
          );
        }
        return;
      },

      completion: async (_context: CommandContext, partialArg: string) => {
        const partialPath = partialArg.split(',').pop()!.trim(); // 支持多路径，取最后一个做补全
        try {
          return await resolveCompletionPaths(partialPath, process.cwd());
        } catch {
          return [];
        }
      },
    },
    {
      name: 'remove',
      get description() {
        return t(
          'Remove directories from the workspace. Use comma to separate multiple paths',
        );
      },
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext, args: string) => {
        const {
          ui: { addItem },
          services: { config },
        } = context;
        const [...rest] = args.split(' ');

        if (!config) {
          addItem(
            {
              type: MessageType.ERROR,
              text: t('Configuration is not available.'),
            },
            Date.now(),
          );
          return;
        }

        const workspaceContext = config.getWorkspaceContext();

        const pathsToRemove = rest
          .join(' ')
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p);
        if (pathsToRemove.length === 0) {
          addItem(
            {
              type: MessageType.ERROR,
              text: t('Please provide at least one path to remove.'),
            },
            Date.now(),
          );
          return;
        }

        if (config.isRestrictiveSandbox()) {
          return {
            type: 'message' as const,
            messageType: 'error' as const,
            content: t(
              'The /directory remove command is not supported in restrictive sandbox profiles. Please use --include-directories when starting the session instead.',
            ),
          };
        }

        const removed: string[] = [];
        const errors: string[] = [];

        for (const pathToRemove of pathsToRemove) {
          const fullPath = expandHomeDir(pathToRemove);

          try {
            workspaceContext.removeDirectory(fullPath);
            removed.push(pathToRemove);
          } catch (e) {
            const error = e as Error;
            errors.push(
              t("Error removing '{{path}}': {{error}}", {
                path: pathToRemove,
                error: error.message,
              }),
            );
          }
        }

        try {
          if (config.shouldLoadMemoryFromIncludeDirectories()) {
            const { memoryContent, fileCount } =
              await loadServerHierarchicalMemory(
                config.getWorkingDir(),
                config.getWorkspaceContext().getDirectories(),
                config.getDebugMode(),
                config.getFileService(),
                config.getExtensionContextFilePaths(),
                config.getFolderTrust(),
                context.services.settings.merged.context?.importFormat ||
                  'tree',
                config.getFileFilteringOptions(),
              );
            config.setUserMemory(memoryContent);
            config.setGeminiMdFileCount(fileCount);
            context.ui.setGeminiMdFileCount(fileCount);
          }
        } catch (error) {
          errors.push(
            t('Error refreshing memory: {{error}}', {
              error: (error as Error).message,
            }),
          );
        }

        if (removed.length > 0) {
          const gemini = config.getGeminiClient();
          if (gemini) {
            await gemini.addDirectoryContext();
          }
          addItem(
            {
              type: MessageType.INFO,
              text: t('Successfully removed directories:\n- {{directories}}', {
                directories: removed.join('\n- '),
              }),
            },
            Date.now(),
          );
        }

        if (errors.length > 0) {
          addItem(
            { type: MessageType.ERROR, text: errors.join('\n') },
            Date.now(),
          );
        }
        return;
      },
      completion: async (context: CommandContext) => {
        const {
          services: { config },
        } = context;

        if (!config) {
          return [];
        }
        const workspaceContext = config.getWorkspaceContext();
        return workspaceContext.getRemovableDirectories();
      },
    },
    {
      name: 'show',
      get description() {
        return t('Show all directories in the workspace');
      },
      kind: CommandKind.BUILT_IN,
      action: async (context: CommandContext) => {
        const {
          ui: { addItem },
          services: { config },
        } = context;
        if (!config) {
          addItem(
            {
              type: MessageType.ERROR,
              text: t('Configuration is not available.'),
            },
            Date.now(),
          );
          return;
        }
        const workspaceContext = config.getWorkspaceContext();
        const directories = workspaceContext.getDirectories();
        const directoryList = directories.map((dir) => `- ${dir}`).join('\n');
        addItem(
          {
            type: MessageType.INFO,
            text: t('Current workspace directories:\n{{directories}}', {
              directories: directoryList,
            }),
          },
          Date.now(),
        );
      },
    },
  ],
};

export async function resolveCompletionPaths(
  partialPath: string,
  baseDir: string,
): Promise<string[]> {
  let resolvedPath: string;
  let displayPrefix = partialPath;
  if (!partialPath || partialPath.trim() === '') {
    resolvedPath = baseDir;
    displayPrefix = '';
  } else if (partialPath.startsWith('~')) {
    resolvedPath = path.join(os.homedir(), partialPath.slice(1));
  } else {
    resolvedPath = path.isAbsolute(partialPath)
      ? path.resolve(partialPath || '/')
      : path.resolve(baseDir, partialPath || '.');
  }

  let targetDir = resolvedPath;
  let filterPrefix = '';
  // 基于所给的部分目录名称进行过滤，例如输入/src/comp，则filterPrefix=comp, 需要去除/src/  ./  . 等场景
  if (
    partialPath &&
    !partialPath.endsWith('/') &&
    !/^\.\/?$/.test(partialPath)
  ) {
    targetDir = path.dirname(resolvedPath);
    filterPrefix = path.basename(resolvedPath);
  }

  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !filterPrefix || entry.name.startsWith(filterPrefix))
    .map((entry) => {
      // 构造补全路径，保持用户输入风格的前缀，避免直接给绝对路径
      let completionPath: string;
      if (partialPath.endsWith('/')) {
        completionPath = path.posix.join(displayPrefix, entry.name) + '/';
      } else {
        // 去掉可能重复的部分
        const prefixDir = displayPrefix.includes('/')
          ? path.posix.dirname(displayPrefix)
          : '';
        if (prefixDir && prefixDir !== '.') {
          completionPath = path.posix.join(prefixDir, entry.name) + '/';
        } else {
          completionPath = entry.name + '/';
          if (
            displayPrefix &&
            displayPrefix !== '.' &&
            !displayPrefix.includes('/')
          ) {
            completionPath =
              displayPrefix.replace(filterPrefix, entry.name) + '/';
          }
        }
      }
      // 规范化成 posix 格式，避免 Windows 下反斜线
      return completionPath.replace(/\\/g, '/');
    });
}
