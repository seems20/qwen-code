/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { type Config } from '@qwen-code/qwen-code-core';

interface TipsProps {
  config: Config;
}

export const Tips: React.FC<TipsProps> = ({ config }) => {
  const geminiMdFileCount = config.getGeminiMdFileCount();
  return (
    <Box flexDirection="column">
      <Text color={Colors.Foreground}> - Inspired By REDer Mind</Text>
      <Text color={Colors.Foreground}> </Text>
      <Text color={Colors.Foreground}>使用指南:</Text>
      <Text color={Colors.Foreground}>1. / 使用命令，@ 提及文件</Text>
      <Text color={Colors.Foreground}>
        2. 两次 Esc 清空输入框，Shift + Enter 换行
      </Text>
      {geminiMdFileCount === 0 && (
        <Text color={Colors.Foreground}>
          3. 创建{' '}
          <Text bold color={Colors.LightBlue}>
            RDMind.md
          </Text>{' '}
          自定义你与 RDMind 的交互方式
        </Text>
      )}
      <Text color={Colors.Foreground}>
        {geminiMdFileCount === 0 ? '4.' : '3.'} 输入{' '}
        <Text bold color={Colors.LightBlue}>
          /help
        </Text>{' '}
        获取帮助，Ctrl + C 退出RDMind
      </Text>
    </Box>
  );
};
