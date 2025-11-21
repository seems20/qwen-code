/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo } from 'react';
import { Box, Text } from 'ink';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';
import {
  getAvailableModelsForAuthType,
  MAINLINE_CODER,
} from '../models/availableModels.js';
import { OpenAIKeyPrompt } from './OpenAIKeyPrompt.js';
import { XhsSsoModelConfigFlow } from './XhsSsoModelConfigFlow.js';
import { SettingsContext } from '../contexts/SettingsContext.js';
import { SettingScope } from '../../config/settings.js';
import {
  AuthType,
  ModelSlashCommandEvent,
  logModelSlashCommand,
  readSSOCredentialsSync,
  encryptApiKey,
} from '@rdmind/rdmind-core';

interface ModelDialogProps {
  onClose: () => void;
}

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);
  const settings = useContext(SettingsContext);

  // Get auth type from config, default to QWEN_OAUTH if not available
  const authType = config?.getAuthType() ?? AuthType.QWEN_OAUTH;

  // For other auth types, show the original model selection
  // Calculate these hooks BEFORE any early returns to satisfy React Hooks rules
  const availableModels = useMemo(
    () => getAvailableModelsForAuthType(authType),
    [authType],
  );

  const MODEL_OPTIONS = useMemo(
    () =>
      availableModels.map((model) => ({
        value: model.id,
        title: model.label,
        description: model.description || '',
        key: model.id,
      })),
    [availableModels],
  );

  // Determine the Preferred Model (read once when the dialog opens).
  const preferredModel = config?.getModel() || MAINLINE_CODER;

  // Calculate the initial index based on the preferred model.
  const initialIndex = useMemo(
    () => MODEL_OPTIONS.findIndex((option) => option.value === preferredModel),
    [MODEL_OPTIONS, preferredModel],
  );

  // Handle selection internally (Autonomous Dialog).
  const handleSelect = useCallback(
    (model: string) => {
      if (config) {
        config.setModel(model);
        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, onClose],
  );

  // Set up keypress handler (must be called before any early returns)
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true },
  );

  // Handle OpenAI model configuration
  const handleOpenAIConfigSubmit = useCallback(
    async (apiKey: string, baseUrl: string, model: string) => {
      if (config && settings) {
        // Update Config's internal generationConfig FIRST
        config.updateCredentials({
          apiKey,
          baseUrl,
          model,
        });

        // Save to settings file (encrypt before saving)
        const encryptedApiKey = encryptApiKey(apiKey);
        settings.setValue(
          SettingScope.User,
          'security.auth.apiKey',
          encryptedApiKey,
        );
        settings.setValue(SettingScope.User, 'security.auth.baseUrl', baseUrl);
        settings.setValue(SettingScope.User, 'model.name', model);

        // Refresh auth to recreate contentGenerator with new credentials
        // This ensures the new API Key and Base URL take effect immediately
        await config.refreshAuth(AuthType.USE_OPENAI);

        // Set the model
        await config.setModel(model);
        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, settings, onClose],
  );

  // Handle XHS SSO model configuration with multi-level menu
  const handleXhsSsoConfigComplete = useCallback(
    async (xhsSsoConfig: {
      apiKey: string;
      baseUrl: string;
      model: string;
    }) => {
      if (config && settings) {
        // Update Config's internal generationConfig FIRST
        config.updateCredentials({
          apiKey: xhsSsoConfig.apiKey,
          baseUrl: xhsSsoConfig.baseUrl,
          model: xhsSsoConfig.model,
        });

        // Save to settings file (encrypt before saving)
        const encryptedApiKey = encryptApiKey(xhsSsoConfig.apiKey);
        settings.setValue(
          SettingScope.User,
          'security.auth.apiKey',
          encryptedApiKey,
        );
        settings.setValue(
          SettingScope.User,
          'security.auth.baseUrl',
          xhsSsoConfig.baseUrl,
        );
        settings.setValue(SettingScope.User, 'model.name', xhsSsoConfig.model);

        // Refresh auth to recreate contentGenerator with new credentials
        // This ensures the new API Key and Base URL take effect immediately
        await config.refreshAuth(AuthType.XHS_SSO);

        // Set the model
        await config.setModel(xhsSsoConfig.model);
        const event = new ModelSlashCommandEvent(xhsSsoConfig.model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, settings, onClose],
  );

  // For OpenAI auth type, show configuration prompt
  if (authType === AuthType.USE_OPENAI) {
    return (
      <OpenAIKeyPrompt onSubmit={handleOpenAIConfigSubmit} onCancel={onClose} />
    );
  }

  // For XHS SSO auth type, show multi-level configuration menu
  if (authType === AuthType.XHS_SSO) {
    const credentials = readSSOCredentialsSync();
    const rdmindSsoId = credentials?.rdmind_sso_id || null;

    return (
      <XhsSsoModelConfigFlow
        onComplete={handleXhsSsoConfigComplete}
        onCancel={onClose}
        rdmindSsoId={rdmindSsoId}
      />
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Model</Text>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={MODEL_OPTIONS}
          onSelect={handleSelect}
          initialIndex={initialIndex}
          showNumbers={true}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}
