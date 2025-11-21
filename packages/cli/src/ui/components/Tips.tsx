/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import Link from 'ink-link';
import { theme } from '../semantic-colors.js';
import { type Config } from '@rdmind/rdmind-core';

interface TipsProps {
  config: Config;
}

export const Tips: React.FC<TipsProps> = ({ config }) => {
  const geminiMdFileCount = config.getGeminiMdFileCount();
  return (
    <Box flexDirection="column">
      <Text color={theme.text.primary}> - Inspired By REDer Mind</Text>
      <Text color={theme.text.primary}>
        {' '}
        - 官网地址:{' '}
        <Link url="https://fe.xiaohongshu.com/apps/reddevmind-web">
          https://fe.xiaohongshu.com/apps/reddevmind-web
        </Link>
      </Text>
      <Text color={theme.text.primary}> </Text>
      <Text color={theme.text.primary}>使用指南:</Text>
      <Text color={theme.text.primary}>
        1.{' '}
        <Text bold color={theme.text.accent}>
          /
        </Text>{' '}
        使用命令，
        <Text bold color={theme.text.accent}>
          @
        </Text>{' '}
        添加文件
      </Text>
      <Text color={theme.text.primary}>
        2. 输入{' '}
        <Text bold color={theme.text.accent}>
          /help
        </Text>{' '}
        获取帮助，
        <Text bold color={theme.text.accent}>
          /docs
        </Text>{' '}
        打开文档
      </Text>
      {geminiMdFileCount === 0 && (
        <Text color={theme.text.primary}>
          3. 创建{' '}
          <Text bold color={theme.text.accent}>
            RDMind.md
          </Text>{' '}
          自定义你与 RDMind 的交互方式
        </Text>
      )}
      <Text color={theme.text.primary}>
        {geminiMdFileCount === 0 ? '4.' : '3.'} 两次{' '}
        <Text bold color={theme.text.accent}>
          Esc
        </Text>{' '}
        清空输入框，
        <Text bold color={theme.text.accent}>
          Shift + Enter
        </Text>{' '}
        换行，
        <Text bold color={theme.text.accent}>
          Ctrl + C
        </Text>{' '}
        退出RDMind
      </Text>
    </Box>
  );
};
