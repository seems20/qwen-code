/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useMemo, useState, useContext } from 'react';
import { Box, Text } from 'ink';
import {
  XHS_SSO_MODELS,
  type XhsSsoModel,
} from '../../config/xhsSsoProviders.js';
import { fetchModelKey } from '@rdmind/rdmind-core';
import { theme } from '../semantic-colors.js';
import { Colors } from '../colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { ConfigContext } from '../contexts/ConfigContext.js';

interface XhsSsoModelConfigFlowProps {
  onComplete: (config: {
    apiKey: string;
    baseUrl: string;
    model: string;
  }) => void;
  onCancel: () => void;
  rdmindSsoId: string | null;
}

export function XhsSsoModelConfigFlow({
  onComplete,
  onCancel,
  rdmindSsoId,
}: XhsSsoModelConfigFlowProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useKeypress(
    (key) => {
      if (key.name === 'escape' && !isLoading) {
        onCancel();
      }
    },
    { isActive: true },
  );

  // 模型选择项
  const modelItems = useMemo(
    () =>
      XHS_SSO_MODELS.map((model) => ({
        key: model.id,
        value: model,
        title: model.displayName,
        description: `${model.description || ''} (${model.contextWindow || ''})`,
      })),
    [],
  );

  // 获取当前模型并计算初始索引
  const currentModel = config?.getModel();
  const initialIndex = useMemo(() => {
    if (!currentModel) {
      return 0; // 如果没有当前模型，默认选中第一个
    }
    const index = XHS_SSO_MODELS.findIndex(
      (model) => model.id === currentModel,
    );
    return index >= 0 ? index : 0; // 如果找不到，默认选中第一个
  }, [currentModel]);

  // 如果没有 rdmind_sso_id，提示用户先认证
  if (!rdmindSsoId) {
    return (
      <Box
        borderStyle="round"
        borderColor={theme.border.default}
        flexDirection="column"
        paddingX={2}
        paddingY={1}
      >
        <Box marginBottom={1}>
          <Text bold color={Colors.AccentRed}>
            ❌ 未找到小红书 SSO 认证凭证
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            请先执行{' '}
            <Text bold color={theme.text.primary}>
              /sso
            </Text>{' '}
            命令进行小红书 SSO 认证
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>按 ESC 关闭</Text>
        </Box>
      </Box>
    );
  }

  // 处理模型选择
  const handleModelSelect = async (model: XhsSsoModel): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // 如果模型配置中有 apiKey，直接使用；否则从 API 获取
      let apiKey: string;
      if (model.apiKey) {
        apiKey = model.apiKey;
      } else {
        // 从 API 动态获取 key
        apiKey = await fetchModelKey(model.id);
      }

      onComplete({
        apiKey,
        baseUrl: model.baseUrl,
        model: model.id,
      });
    } catch (err) {
      setIsLoading(false);
      const errorMessage =
        err instanceof Error ? err.message : '获取模型 API Key 失败';
      setError(errorMessage);
    }
  };

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text bold color={theme.text.primary}>
          选择模型
        </Text>
      </Box>

      {isLoading ? (
        <Box flexDirection="column" paddingY={1}>
          <Text color={Colors.AccentBlue}>loading...</Text>
        </Box>
      ) : (
        <>
          <DescriptiveRadioButtonSelect
            items={modelItems}
            onSelect={handleModelSelect}
            initialIndex={initialIndex}
            isFocused={true}
          />

          {error && (
            <Box marginTop={1}>
              <Text color={Colors.AccentRed}>❌ {error}</Text>
            </Box>
          )}

          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              提示: ↑↓ 选择, Enter 确认, ESC 取消
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
