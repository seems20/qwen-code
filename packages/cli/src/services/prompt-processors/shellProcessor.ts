/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ApprovalMode,
  checkCommandPermissions,
  doesToolInvocationMatch,
  escapeShellArg,
  getShellConfiguration,
  ShellExecutionService,
  flatMapTextParts,
} from '@rdmind/rdmind-core';
import type { AnyToolInvocation } from '@rdmind/rdmind-core';

import type { CommandContext } from '../../ui/commands/types.js';
import type { IPromptProcessor, PromptPipelineContent } from './types.js';
import {
  SHELL_INJECTION_TRIGGER,
  SHORTHAND_ARGS_PLACEHOLDER,
} from './types.js';
import { extractInjections, type Injection } from './injectionParser.js';
import { themeManager } from '../../ui/themes/theme-manager.js';

export class ConfirmationRequiredError extends Error {
  constructor(
    message: string,
    public commandsToConfirm: string[],
  ) {
    super(message);
    this.name = 'ConfirmationRequiredError';
  }
}

/**
 * 表示已解析的Shell注入点，包含解析后的命令
 */
interface ResolvedShellInjection extends Injection {
  /** 在 {{args}} 被转义和替换之后的命令。*/
  resolvedCommand?: string;
}

/**
 * 处理提示插值，包括 shell 命令执行（`!{...}`）
 * 和上下文感知的参数注入（`{{args}}`
 *
 * 此处理器确保:
 * 1. `!{...}` 外部的 `{{args}}` 被替换为原始输入
 * 2. `!{...}` 内部的 `{{args}}` 被替换为 shell 转义后的输入
 * 3. Shell 命令在参数替换后安全执行
 * 4. 解析正确处理嵌套的大括号
 */
export class ShellProcessor implements IPromptProcessor {
  constructor(private readonly commandName: string) {}

  async process(
    prompt: PromptPipelineContent,
    context: CommandContext,
  ): Promise<PromptPipelineContent> {
    return flatMapTextParts(prompt, (text) =>
      this.processString(text, context),
    );
  }

  private async processString(
    prompt: string,
    context: CommandContext,
  ): Promise<PromptPipelineContent> {
    const userArgsRaw = context.invocation?.args || '';

    if (!prompt.includes(SHELL_INJECTION_TRIGGER)) {
      return [
        { text: prompt.replaceAll(SHORTHAND_ARGS_PLACEHOLDER, userArgsRaw) },
      ];
    }

    const config = context.services.config;
    if (!config) {
      throw new Error(
        `Security configuration not loaded. Cannot verify shell command permissions for '${this.commandName}'. Aborting.`,
      );
    }
    const { sessionShellAllowlist } = context.session;

    const injections = extractInjections(
      prompt,
      SHELL_INJECTION_TRIGGER,
      this.commandName,
    );

    // If extractInjections found no closed blocks (and didn't throw), treat as raw.
    if (injections.length === 0) {
      return [
        { text: prompt.replaceAll(SHORTHAND_ARGS_PLACEHOLDER, userArgsRaw) },
      ];
    }

    const { shell } = getShellConfiguration();
    const userArgsEscaped = escapeShellArg(userArgsRaw, shell);

    const resolvedInjections: ResolvedShellInjection[] = injections.map(
      (injection) => {
        const command = injection.content;

        if (command === '') {
          return { ...injection, resolvedCommand: undefined };
        }

        const resolvedCommand = command.replaceAll(
          SHORTHAND_ARGS_PLACEHOLDER,
          userArgsEscaped,
        );
        return { ...injection, resolvedCommand };
      },
    );

    const commandsToConfirm = new Set<string>();
    for (const injection of resolvedInjections) {
      const command = injection.resolvedCommand;

      if (!command) continue;

      // Security check on the final, escaped command string.
      const { allAllowed, disallowedCommands, blockReason, isHardDenial } =
        checkCommandPermissions(command, config, sessionShellAllowlist);
      const allowedTools = config.getAllowedTools() || [];
      const invocation = {
        params: { command },
      } as AnyToolInvocation;
      const isAllowedBySettings = doesToolInvocationMatch(
        'run_shell_command',
        invocation,
        allowedTools,
      );

      if (!allAllowed) {
        if (isHardDenial) {
          throw new Error(
            `${this.commandName} cannot be run. Blocked command: "${command}". Reason: ${blockReason || 'Blocked by configuration.'}`,
          );
        }

        // If the command is allowed by settings, skip confirmation.
        if (isAllowedBySettings) {
          continue;
        }

        // If not a hard denial, respect YOLO mode and auto-approve.
        if (config.getApprovalMode() === ApprovalMode.YOLO) {
          continue;
        }

        disallowedCommands.forEach((uc) => commandsToConfirm.add(uc));
      }
    }

    // Handle confirmation requirements.
    if (commandsToConfirm.size > 0) {
      throw new ConfirmationRequiredError(
        'Shell command confirmation required',
        Array.from(commandsToConfirm),
      );
    }

    let processedPrompt = '';
    let lastIndex = 0;

    for (const injection of resolvedInjections) {
      // Append the text segment BEFORE the injection, substituting {{args}} with RAW input.
      const segment = prompt.substring(lastIndex, injection.startIndex);
      processedPrompt += segment.replaceAll(
        SHORTHAND_ARGS_PLACEHOLDER,
        userArgsRaw,
      );

      // Execute the resolved command (which already has ESCAPED input).
      if (injection.resolvedCommand) {
        const activeTheme = themeManager.getActiveTheme();
        const shellExecutionConfig = {
          ...config.getShellExecutionConfig(),
          defaultFg: activeTheme.colors.Foreground,
          defaultBg: activeTheme.colors.Background,
        };
        const { result } = await ShellExecutionService.execute(
          injection.resolvedCommand,
          config.getTargetDir(),
          () => {},
          new AbortController().signal,
          config.getShouldUseNodePtyShell(),
          shellExecutionConfig,
        );

        const executionResult = await result;

        // Handle Spawn Errors
        if (executionResult.error && !executionResult.aborted) {
          throw new Error(
            `Failed to start shell command in '${this.commandName}': ${executionResult.error.message}. Command: ${injection.resolvedCommand}`,
          );
        }

        // Append the output, making stderr explicit for the model.
        processedPrompt += executionResult.output;

        // Append a status message if the command did not succeed.
        if (executionResult.aborted) {
          processedPrompt += `\n[Shell command '${injection.resolvedCommand}' aborted]`;
        } else if (
          executionResult.exitCode !== 0 &&
          executionResult.exitCode !== null
        ) {
          processedPrompt += `\n[Shell command '${injection.resolvedCommand}' exited with code ${executionResult.exitCode}]`;
        } else if (executionResult.signal !== null) {
          processedPrompt += `\n[Shell command '${injection.resolvedCommand}' terminated by signal ${executionResult.signal}]`;
        }
      }

      lastIndex = injection.endIndex;
    }

    // Append the remaining text AFTER the last injection, substituting {{args}} with RAW input.
    const finalSegment = prompt.substring(lastIndex);
    processedPrompt += finalSegment.replaceAll(
      SHORTHAND_ARGS_PLACEHOLDER,
      userArgsRaw,
    );

    return [{ text: processedPrompt }];
  }
}
