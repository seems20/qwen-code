/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../contexts/AppContext.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { theme } from '../semantic-colors.js';
import { StreamingState } from '../types.js';
import { UpdateNotification } from './UpdateNotification.js';

// L4 仓库提示自动消失的时间（毫秒）
const L4_WARNING_AUTO_HIDE_DELAY = 3000; // 3秒

export const Notifications = () => {
  const { startupWarnings } = useAppContext();
  const { initError, streamingState, updateInfo } = useUIState();
  const [hiddenWarnings, setHiddenWarnings] = useState<Set<string>>(
    new Set(),
  );

  // 过滤掉已隐藏的警告
  const visibleWarnings = startupWarnings.filter(
    (warning) => !hiddenWarnings.has(warning),
  );

  // 自动隐藏 L4 仓库提示
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    startupWarnings.forEach((warning) => {
      if (
        warning.includes('L4等级仓库') ||
        warning.includes('切换到QS平台模型')
      ) {
        const timer = setTimeout(() => {
          setHiddenWarnings((prev) => new Set(prev).add(warning));
        }, L4_WARNING_AUTO_HIDE_DELAY);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [startupWarnings]);

  const showStartupWarnings = visibleWarnings.length > 0;
  const showInitError =
    initError && streamingState !== StreamingState.Responding;

  if (!showStartupWarnings && !showInitError && !updateInfo) {
    return null;
  }

  return (
    <>
      {updateInfo && <UpdateNotification message={updateInfo.message} />}
      {showStartupWarnings && (
        <Box
          borderStyle="round"
          borderColor={theme.status.warning}
          paddingX={1}
          marginY={1}
          flexDirection="column"
        >
          {visibleWarnings.map((warning, index) => (
            <Text key={index} color={theme.status.warning}>
              {warning}
            </Text>
          ))}
        </Box>
      )}
      {showInitError && (
        <Box
          borderStyle="round"
          borderColor={theme.status.error}
          paddingX={1}
          marginBottom={1}
        >
          <Text color={theme.status.error}>
            Initialization Error: {initError}
          </Text>
          <Text color={theme.status.error}>
            {' '}
            Please check API key and configuration.
          </Text>
        </Box>
      )}
    </>
  );
};
