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
import { t } from '../../i18n/index.js';

interface TipsProps {
  config: Config;
}

export const Tips: React.FC<TipsProps> = ({ config }) => {
  const geminiMdFileCount = config.getGeminiMdFileCount();
  return (
    <Box flexDirection="column">
      <Text color={theme.text.primary}> - {t('Inspired By REDer Mind')}</Text>
      <Text color={theme.text.primary}>
        {' '}
        {t('Official website:')}{' '}
        <Link url="https://rdmind.devops.xiaohongshu.com/apps/reddevmind-web">
          https://rdmind.devops.xiaohongshu.com/apps/reddevmind-web
        </Link>
      </Text>
      <Text color={theme.text.primary}> </Text>
      <Text color={theme.text.primary}>{t('Usage Guide:')}</Text>
      <Text color={theme.text.primary}>
        1.{' '}
        <Text bold color={theme.text.accent}>
          /
        </Text>{' '}
        {t('use commands,')}{' '}
        <Text bold color={theme.text.accent}>
          @
        </Text>{' '}
        {t('add files')}
      </Text>
      <Text color={theme.text.primary}>
        2. {t('Input')}{' '}
        <Text bold color={theme.text.accent}>
          /help
        </Text>{' '}
        {t('for help,')}{' '}
        <Text bold color={theme.text.accent}>
          /docs
        </Text>{' '}
        {t('open documentation')}
      </Text>
      {geminiMdFileCount === 0 && (
        <Text color={theme.text.primary}>
          3. {t('Create')}{' '}
          <Text bold color={theme.text.accent}>
            RDMind.md
          </Text>{' '}
          {t('to customize your interactions with RDMind')}
        </Text>
      )}
      <Text color={theme.text.primary}>
        {geminiMdFileCount === 0 ? '4.' : '3.'} {t('Press')}{' '}
        <Text bold color={theme.text.accent}>
          Esc
        </Text>{' '}
        {t('twice to clear input,')}{' '}
        <Text bold color={theme.text.accent}>
          Shift + Enter
        </Text>{' '}
        {t('for new line,')}{' '}
        <Text bold color={theme.text.accent}>
          Ctrl + C
        </Text>{' '}
        {t('to exit RDMind')}
      </Text>
    </Box>
  );
};
