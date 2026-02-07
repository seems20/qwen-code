/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Config,
  ContentGeneratorConfig,
  ModelProvidersConfig,
} from '@rdmind/rdmind-core';
import {
  AuthEvent,
  AuthType,
  getErrorMessage,
  logAuth,
  shouldTriggerAutoSSOAuth,
  readSSOCredentialsSync,
  clearCachedCredentialFile,
} from '@rdmind/rdmind-core';
import { useCallback, useEffect, useState } from 'react';
import type { LoadedSettings } from '../../config/settings.js';
import { getPersistScopeForModelSelection } from '../../config/modelProvidersScope.js';
import type { OpenAICredentials } from '../components/OpenAIKeyPrompt.js';
import {
  applyXhsSsoConfig,
  resolveXhsSsoRuntimeConfig,
} from './xhsSsoConfig.js';
import { performSsoAuthFlow } from './performSsoAuthFlow.js';
import { useQwenAuth } from '../hooks/useQwenAuth.js';
import { AuthState, MessageType } from '../types.js';
import type { HistoryItem } from '../types.js';
import { t } from '../../i18n/index.js';

export type { QwenAuthState } from '../hooks/useQwenAuth.js';

export const useAuthCommand = (
  settings: LoadedSettings,
  config: Config,
  addItem: (item: Omit<HistoryItem, 'id'>, timestamp: number) => void,
  onAuthChange?: () => void,
) => {
  const unAuthenticated = config.getAuthType() === undefined;

  // 如果正在进行 SSO 自动认证，不要显示认证窗口
  const isSSOAutoAuthInProgress = shouldTriggerAutoSSOAuth(settings);

  const [authState, setAuthState] = useState<AuthState>(
    unAuthenticated ? AuthState.Updating : AuthState.Unauthenticated,
  );

  const [authError, setAuthError] = useState<string | null>(null);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(
    unAuthenticated && !isSSOAutoAuthInProgress,
  );
  const [pendingAuthType, setPendingAuthType] = useState<AuthType | undefined>(
    undefined,
  );

  const { qwenAuthState, cancelQwenAuth } = useQwenAuth(
    pendingAuthType,
    isAuthenticating,
  );

  const onAuthError = useCallback(
    (error: string | null) => {
      setAuthError(error);
      if (error) {
        setAuthState(AuthState.Updating);
        setIsAuthDialogOpen(true);
      }
    },
    [setAuthError, setAuthState],
  );

  const handleAuthFailure = useCallback(
    (error: unknown) => {
      setIsAuthenticating(false);
      setPendingAuthType(undefined);
      const errorMessage = t('Failed to authenticate. Message: {{message}}', {
        message: getErrorMessage(error),
      });
      onAuthError(errorMessage);

      // Log authentication failure
      if (pendingAuthType) {
        const authEvent = new AuthEvent(
          pendingAuthType,
          'manual',
          'error',
          errorMessage,
        );
        logAuth(config, authEvent);
      }
    },
    [onAuthError, pendingAuthType, config],
  );

  const handleAuthSuccess = useCallback(
    async (authType: AuthType, credentials?: OpenAICredentials) => {
      try {
        const authTypeScope = getPersistScopeForModelSelection(settings);

        // Persist authType
        settings.setValue(
          authTypeScope,
          'security.auth.selectedType',
          authType,
        );

        // Persist model from ContentGenerator config (handles fallback cases)
        // This ensures that when syncAfterAuthRefresh falls back to default model,
        // it gets persisted to settings.json
        const contentGeneratorConfig = config.getContentGeneratorConfig();
        if (contentGeneratorConfig?.model) {
          settings.setValue(
            authTypeScope,
            'model.name',
            contentGeneratorConfig.model,
          );
        }

        // Only update credentials if not switching to QWEN_OAUTH,
        // so that OpenAI credentials are preserved when switching to QWEN_OAUTH.
        if (authType !== AuthType.QWEN_OAUTH && credentials) {
          if (credentials?.apiKey != null) {
            settings.setValue(
              authTypeScope,
              'security.auth.apiKey',
              credentials.apiKey,
            );
          }
          if (credentials?.baseUrl != null) {
            settings.setValue(
              authTypeScope,
              'security.auth.baseUrl',
              credentials.baseUrl,
            );
          }
        }
      } catch (error) {
        handleAuthFailure(error);
        return;
      }

      setAuthError(null);
      setAuthState(AuthState.Authenticated);
      setPendingAuthType(undefined);
      setIsAuthDialogOpen(false);
      setIsAuthenticating(false);

      // Trigger UI refresh to update header information
      onAuthChange?.();

      // Add success message to history
      addItem(
        {
          type: MessageType.INFO,
          text: t('Authenticated successfully with {{authType}} credentials.', {
            authType,
          }),
        },
        Date.now(),
      );

      // Log authentication success
      const authEvent = new AuthEvent(authType, 'manual', 'success');
      logAuth(config, authEvent);
    },
    [settings, handleAuthFailure, config, addItem, onAuthChange],
  );

  const performAuth = useCallback(
    async (authType: AuthType, credentials?: OpenAICredentials) => {
      try {
        await config.refreshAuth(authType);
        handleAuthSuccess(authType, credentials);
      } catch (e) {
        handleAuthFailure(e);
      }
    },
    [config, handleAuthSuccess, handleAuthFailure],
  );

  const isProviderManagedModel = useCallback(
    (authType: AuthType, modelId: string | undefined) => {
      if (!modelId) {
        return false;
      }

      const modelProviders = settings.merged.modelProviders as
        | ModelProvidersConfig
        | undefined;
      if (!modelProviders) {
        return false;
      }
      const providerModels = modelProviders[authType];
      if (!Array.isArray(providerModels)) {
        return false;
      }
      return providerModels.some(
        (providerModel) => providerModel.id === modelId,
      );
    },
    [settings],
  );

  const handleAuthSelect = useCallback(
    async (authType: AuthType | undefined, credentials?: OpenAICredentials) => {
      if (!authType) {
        setIsAuthDialogOpen(false);
        setAuthError(null);
        return;
      }

      const scope = getPersistScopeForModelSelection(settings);

      await clearCachedCredentialFile();

      const previousAuthType = settings.merged.security?.auth?.selectedType;

      // 如果从 XHS_SSO 切换到其他认证方式，清除 XHS_SSO 相关配置
      if (
        previousAuthType === AuthType.XHS_SSO &&
        authType !== AuthType.XHS_SSO
      ) {
        // 清除 apiKey、baseUrl 和 model.name
        settings.setValue(scope, 'security.auth.apiKey', undefined);
        settings.setValue(scope, 'security.auth.baseUrl', undefined);
        settings.setValue(scope, 'model.name', undefined);
      }

      // 如果从其他认证方式切换到 XHS_SSO，清除旧配置以使用 XHS_SSO 默认配置
      if (
        previousAuthType &&
        previousAuthType !== AuthType.XHS_SSO &&
        authType === AuthType.XHS_SSO
      ) {
        // 清除 apiKey、baseUrl 和 model.name，让 XHS_SSO 使用默认配置
        settings.setValue(scope, 'security.auth.apiKey', undefined);
        settings.setValue(scope, 'security.auth.baseUrl', undefined);
        settings.setValue(scope, 'model.name', undefined);
      }

      // Special handling for XHS_SSO
      if (authType === AuthType.XHS_SSO) {
        // Check if SSO credentials exist
        const creds = readSSOCredentialsSync();
        if (!creds || !creds.rdmind_sso_id) {
          // No SSO credentials, need to perform full SSO auth flow
          setIsAuthDialogOpen(false);
          setAuthError(null);
          setPendingAuthType(authType);
          setIsAuthenticating(true);

          try {
            // Trigger full SSO authentication flow
            await performSsoAuthFlow({
              config,
              setAuthState,
              onAuthError,
              onSuccess: () => {
                setPendingAuthType(undefined);
                setIsAuthenticating(false);

                // Log authentication success
                const authEvent = new AuthEvent(authType, 'manual', 'success');
                logAuth(config, authEvent);

                // Show success message
                addItem(
                  {
                    type: MessageType.INFO,
                    text: t(
                      'Authenticated successfully with {{authType}} credentials.',
                      {
                        authType,
                      },
                    ),
                  },
                  Date.now(),
                );

                // Trigger UI refresh to update header with new auth type
                onAuthChange?.();
              },
            });
          } catch (error) {
            handleAuthFailure(error);
          }
          return;
        }

        let resolvedConfig;
        try {
          resolvedConfig = await resolveXhsSsoRuntimeConfig(config, settings);
        } catch (error) {
          onAuthError(error instanceof Error ? error.message : String(error));
          return;
        }

        setPendingAuthType(authType);
        setAuthError(null);
        setIsAuthDialogOpen(false);
        setIsAuthenticating(true);

        try {
          await applyXhsSsoConfig(config, settings, {
            scope,
            ...resolvedConfig,
            refresh: true,
          });

          // Success handling
          setAuthError(null);
          setAuthState(AuthState.Authenticated);
          setPendingAuthType(undefined);
          setIsAuthenticating(false);

          // Log authentication success
          const authEvent = new AuthEvent(authType, 'manual', 'success');
          logAuth(config, authEvent);

          // Show success message
          addItem(
            {
              type: MessageType.INFO,
              text: t(
                'Authenticated successfully with {{authType}} credentials.',
                {
                  authType,
                },
              ),
            },
            Date.now(),
          );

          // Trigger UI refresh to update header with new auth type
          onAuthChange?.();
        } catch (error) {
          handleAuthFailure(error);
        }
        return;
      }

      // Check if model is managed by modelProviders for OpenAI
      if (
        authType === AuthType.USE_OPENAI &&
        credentials?.model &&
        isProviderManagedModel(authType, credentials.model)
      ) {
        onAuthError(
          t(
            'Model "{{modelName}}" is managed via settings.modelProviders. Please complete the fields in settings, or use another model id.',
            { modelName: credentials.model },
          ),
        );
        return;
      }

      // Standard auth flow for other types
      setPendingAuthType(authType);
      setAuthError(null);
      setIsAuthDialogOpen(false);
      setIsAuthenticating(true);

      if (authType === AuthType.USE_OPENAI) {
        if (credentials) {
          // 用户输入了新的 credentials
          // Pass settings.model.generationConfig to updateCredentials so it can be merged
          // after clearing provider-sourced config. This ensures settings.json generationConfig
          // fields (e.g., samplingParams, timeout) are preserved.
          const settingsGenerationConfig = settings.merged.model
            ?.generationConfig as Partial<ContentGeneratorConfig> | undefined;
          config.updateCredentials(
            {
              apiKey: credentials.apiKey,
              baseUrl: credentials.baseUrl,
              model: credentials.model,
            },
            settingsGenerationConfig,
          );
          await performAuth(authType, credentials);
        } else {
          // 没有新 credentials，从环境变量或 settings 中读取
          const apiKey =
            process.env['OPENAI_API_KEY'] ||
            settings.merged.security?.auth?.apiKey ||
            '';
          const baseUrl =
            process.env['OPENAI_BASE_URL'] ||
            settings.merged.security?.auth?.baseUrl ||
            '';
          const model =
            process.env['OPENAI_MODEL'] || settings.merged.model?.name || '';

          if (apiKey) {
            const settingsGenerationConfig = settings.merged.model
              ?.generationConfig as Partial<ContentGeneratorConfig> | undefined;
            config.updateCredentials(
              {
                apiKey,
                baseUrl,
                model,
              },
              settingsGenerationConfig,
            );
          }
          await performAuth(authType, { apiKey, baseUrl, model });
        }
        return;
      }

      await performAuth(authType);
    },
    [
      config,
      performAuth,
      isProviderManagedModel,
      onAuthError,
      onAuthChange,
      addItem,
      settings,
      handleAuthFailure,
    ],
  );

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const cancelAuthentication = useCallback(() => {
    if (isAuthenticating && pendingAuthType === AuthType.QWEN_OAUTH) {
      cancelQwenAuth();
    }

    // Log authentication cancellation
    if (isAuthenticating && pendingAuthType) {
      const authEvent = new AuthEvent(pendingAuthType, 'manual', 'cancelled');
      logAuth(config, authEvent);
    }

    // Do not reset pendingAuthType here, persist the previously selected type.
    setIsAuthenticating(false);
    setIsAuthDialogOpen(true);
    setAuthError(null);
  }, [isAuthenticating, pendingAuthType, cancelQwenAuth, config]);

  /**
   * We previously used a useEffect to trigger authentication automatically when
   * settings.security.auth.selectedType changed. This caused problems: if authentication failed,
   * the UI could get stuck, since settings.json would update before success. Now, we
   * update selectedType in settings only when authentication fully succeeds.
   * Authentication is triggered explicitly—either during initial app startup or when the
   * user switches methods—not reactively through settings changes. This avoids repeated
   * or broken authentication cycles.
   */
  useEffect(() => {
    const defaultAuthType = process.env['QWEN_DEFAULT_AUTH_TYPE'];
    if (
      defaultAuthType &&
      ![
        AuthType.QWEN_OAUTH,
        AuthType.USE_OPENAI,
        AuthType.XHS_SSO,
        AuthType.USE_ANTHROPIC,
        AuthType.USE_GEMINI,
        AuthType.USE_VERTEX_AI,
      ].includes(defaultAuthType as AuthType)
    ) {
      onAuthError(
        t(
          'Invalid RDMind_DEFAULT_AUTH_TYPE value: "{{value}}". Valid values are: {{validValues}}',
          {
            value: defaultAuthType,
            validValues: [
              AuthType.QWEN_OAUTH,
              AuthType.USE_OPENAI,
              AuthType.XHS_SSO,
              AuthType.USE_ANTHROPIC,
              AuthType.USE_GEMINI,
              AuthType.USE_VERTEX_AI,
            ].join(', '),
          },
        ),
      );
    }
  }, [onAuthError]);

  return {
    authState,
    setAuthState,
    authError,
    onAuthError,
    isAuthDialogOpen,
    isAuthenticating,
    pendingAuthType,
    qwenAuthState,
    handleAuthSelect,
    openAuthDialog,
    cancelAuthentication,
  };
};
