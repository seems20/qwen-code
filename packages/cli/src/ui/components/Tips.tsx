/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
      <Text color={Colors.Foreground}>使用指南:</Text>
      <Text color={Colors.Foreground}>
        1. 直接提问、编辑文件，或者执行命令。
      </Text>
      <Text color={Colors.Foreground}>
        2. 尽量描述清楚需求，获得更准确的结果。
      </Text>
      {geminiMdFileCount === 0 && (
        <Text color={Colors.Foreground}>
          3. Create{' '}
          <Text bold color={Colors.AccentPurple}>
            RDMind.md
          </Text>{' '}
          来自定义你与 RDMind 的交互方式。
        </Text>
      )}
      <Text color={Colors.Foreground}>
        {geminiMdFileCount === 0 ? '4.' : '3.'}{' '}
        <Text bold color={Colors.AccentPurple}>
          输入 /help
        </Text>{' '}
        获取更多使用帮助。
      </Text>
    </Box>
  );
};
