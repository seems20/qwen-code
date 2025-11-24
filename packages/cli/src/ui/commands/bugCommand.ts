/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import open from 'open';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { MessageType } from '../types.js';
import { t } from '../../i18n/index.js';

export const bugCommand: SlashCommand = {
  name: 'bug',
  get description() {
    return t('submit a bug report');
  },
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, _args?: string): Promise<void> => {
    const issueUrl =
      'https://code.devops.xiaohongshu.com/aikit/rdmind/-/issues';

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `正在打开 RDMind 问题报告页面:\n${issueUrl}`,
      },
      Date.now(),
    );

    try {
      await open(issueUrl);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `无法在浏览器中打开 URL: ${errorMessage}\n请手动访问: ${issueUrl}`,
        },
        Date.now(),
      );
    }
  },
};
