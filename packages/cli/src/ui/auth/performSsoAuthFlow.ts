/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '@rdmind/rdmind-core';
import { USER_SETTINGS_PATH } from '../../config/settings.js';
import {
  triggerSSOAuth,
  readSSOCredentialsSync,
  saveSSOCredentialsAndAuthType,
} from '@rdmind/rdmind-core';
import { getSocketId } from '../../services/websocketSocketId.js';
import { AuthState } from '../types.js';

export interface PerformSsoAuthFlowOptions {
  config: Config;
  setAuthState: (state: AuthState) => void;
  onAuthError: (error: string) => void;
  onSuccess?: () => void;
}

/**
 * 执行完整的小红书 SSO 认证流程（可复用于启动和 /auth 切换）
 *
 * 流程：
 * 1. 等待 WebSocket socketId
 * 2. 触发 SSO 认证（调用 API + 打开浏览器）
 * 3. 轮询等待凭证文件（rdmind_sso_id）
 * 4. 保存 SSO 凭证和认证类型
 *
 * 注意：不再自动保存 apiKey、baseUrl 和 model，用户需要在认证后手动选择模型
 */
export async function performSsoAuthFlow(
  options: PerformSsoAuthFlowOptions,
): Promise<void> {
  const { config, setAuthState, onAuthError, onSuccess } = options;
  const debug = config.getDebugMode();

  // 步骤1：等待 socketId 可用（最多等待 5 秒）
  let socketId: string | null = null;
  let waitAttempts = 0;
  const maxWaitAttempts = 50; // 5秒，每100ms检查一次

  if (debug) {
    console.debug('[PerformSsoAuthFlow] 步骤1：等待 WebSocket socketId');
  }

  while (waitAttempts < maxWaitAttempts) {
    socketId = getSocketId();
    if (socketId) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    waitAttempts++;
  }

  if (!socketId) {
    if (debug) {
      console.debug('[PerformSsoAuthFlow] ⏰ 等待 socketId 超时');
    }
    onAuthError('WebSocket 建联超时，请检查网络后重试');
    return;
  }

  if (debug) {
    console.debug(
      '[PerformSsoAuthFlow] ✅ WebSocket 已建联，socketId:',
      socketId,
    );
  }

  // 步骤2：触发 SSO 认证（调用 API + 打开浏览器）
  if (debug) {
    console.debug('[PerformSsoAuthFlow] 步骤2：触发 SSO 认证');
  }

  try {
    await triggerSSOAuth(socketId, debug);

    if (debug) {
      console.debug('[PerformSsoAuthFlow] ✅ SSO 认证已触发，开始轮询等待凭证');
    }
  } catch (error) {
    if (debug) {
      console.error('[PerformSsoAuthFlow] ❌ 触发 SSO 认证失败:', error);
    }
    onAuthError(
      `触发 SSO 认证失败: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  // 步骤3：轮询等待凭证文件（5秒超时）
  if (debug) {
    console.debug('[PerformSsoAuthFlow] 步骤3：轮询等待凭证文件');
  }

  let pollAttempts = 0;
  const maxPollAttempts = 500; // 50秒，每100ms检查一次

  const pollForCredentials = async (): Promise<{
    rdmind_sso_id: string;
    sso_name: string;
  } | null> =>
    new Promise((resolve) => {
      const pollTimer = setInterval(() => {
        pollAttempts++;

        const creds = readSSOCredentialsSync();

        if (creds && creds.rdmind_sso_id) {
          clearInterval(pollTimer);
          if (debug) {
            console.debug(
              '[PerformSsoAuthFlow] ✅ 检测到 rdmind_sso_id:',
              creds.rdmind_sso_id,
            );
          }
          resolve(creds);
        } else if (pollAttempts >= maxPollAttempts) {
          clearInterval(pollTimer);
          if (debug) {
            console.debug(
              '[PerformSsoAuthFlow] ⏰ 5秒内未检测到 rdmind_sso_id，认证超时',
            );
          }
          resolve(null);
        }
      }, 100);
    });

  const creds = await pollForCredentials();

  if (!creds) {
    onAuthError('SSO 认证超时，可选择其他认证方式，或选择小红书 SSO 重试');
    return;
  }

  // 步骤4：保存 SSO 凭证和认证类型
  try {
    if (debug) {
      console.debug('[PerformSsoAuthFlow] 步骤4：保存 SSO 凭证和认证类型');
    }

    await saveSSOCredentialsAndAuthType(
      creds.rdmind_sso_id,
      creds.sso_name,
      USER_SETTINGS_PATH,
      debug,
    );

    if (debug) {
      console.debug('[PerformSsoAuthFlow] ✅ SSO 凭证和认证类型已保存');
      console.debug(
        '[PerformSsoAuthFlow] 🎉 SSO 认证流程完成！用户需要选择模型后才能使用',
      );
    }

    // 设置为已认证状态
    setAuthState(AuthState.Authenticated);

    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    if (debug) {
      console.error('[PerformSsoAuthFlow] ❌ SSO 认证流程失败:', error);
    }
    onAuthError(
      `SSO 认证失败: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
