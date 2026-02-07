/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import {
  performAutoSSOAuth,
  type SSOAuthResult,
  readSSOCredentialsSync,
  createDebugLogger,
} from '@rdmind/rdmind-core';
import { USER_SETTINGS_PATH } from '../../config/settings.js';
import type { LoadedSettings } from '../../config/settings.js';
import { AuthType } from '@rdmind/rdmind-core';

const debugLogger = createDebugLogger('useAutoSSOAuth');

/**
 * 自动 SSO 认证状态
 */
export enum AutoSSOAuthState {
  IDLE = 'idle', // 空闲
  WAITING_SOCKET_ID = 'waiting', // 等待 socketId
  AUTHENTICATING = 'authenticating', // 认证中
  SUCCESS = 'success', // 成功
  FAILED = 'failed', // 失败
  TIMEOUT = 'timeout', // 超时
}

/**
 * 判断是否需要自动 SSO 认证
 */
export function shouldTriggerAutoSSOAuth(settings: LoadedSettings): boolean {
  const authType = settings.merged.security?.auth?.selectedType;

  // 情况1：没有任何认证配置 → 需要自动 SSO 认证
  if (!authType) {
    return true;
  }

  // 情况2：认证类型是 xhs-sso 但没有 rdmind_sso_id → 需要自动 SSO 认证
  if (authType === AuthType.XHS_SSO) {
    try {
      const credentials = readSSOCredentialsSync();
      if (!credentials || !credentials.rdmind_sso_id) {
        return true;
      }
    } catch {
      return true;
    }
  }

  // 其他情况：不需要
  return false;
}

/**
 * 自动 SSO 认证 Hook
 */
export function useAutoSSOAuth(debug: boolean) {
  const [state, setState] = useState<AutoSSOAuthState>(AutoSSOAuthState.IDLE);
  const [error, setError] = useState<string | null>(null);

  /**
   * 触发自动认证（在收到 socketId 后调用）
   */
  const triggerAuth = useCallback(
    async (socketId: string) => {
      if (debug) {
        debugLogger.debug(
          '[AutoSSOAuth] 触发自动 SSO 认证, socketId:',
          socketId,
        );
      }

      setState(AutoSSOAuthState.AUTHENTICATING);
      setError(null);

      try {
        const result: SSOAuthResult = await performAutoSSOAuth(
          {
            socketId,
            timeout: 10000, // 10秒超时
            apiTimeout: 5000, // 5秒 API 超时
            debug,
          },
          USER_SETTINGS_PATH,
        );

        if (result.success) {
          if (debug) {
            debugLogger.debug('[AutoSSOAuth] ✅ 认证成功');
            debugLogger.debug('[AutoSSOAuth] 凭证:', result.credentials);
          }
          setState(AutoSSOAuthState.SUCCESS);
          setError(null);
        } else if (result.timeout) {
          if (debug) {
            debugLogger.debug('[AutoSSOAuth] ⏰ 认证超时');
          }
          setState(AutoSSOAuthState.TIMEOUT);
          setError(result.error || '认证超时');
        } else {
          if (debug) {
            debugLogger.debug('[AutoSSOAuth] ❌ 认证失败:', result.error);
          }
          setState(AutoSSOAuthState.FAILED);
          setError(result.error || '认证失败');
        }
      } catch (err) {
        if (debug) {
          debugLogger.error('[AutoSSOAuth] ❌ 认证过程异常:', err);
        }
        setState(AutoSSOAuthState.FAILED);
        setError((err as Error).message);
      }
    },
    [debug],
  );

  /**
   * 重置状态（用于重试）
   */
  const reset = useCallback(() => {
    setState(AutoSSOAuthState.IDLE);
    setError(null);
  }, []);

  return {
    state,
    error,
    triggerAuth,
    reset,
  };
}
