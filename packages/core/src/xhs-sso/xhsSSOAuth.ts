/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'node:events';
import { fetchWithTimeout } from '../utils/fetch.js';
import { openBrowserSecurely } from '../utils/secure-browser-launcher.js';
import { updateSettingsWithLock, saveSSOCredentials } from './xhsSSOStorage.js';
import type {
  SSOAuthConfig,
  SSOAuthResult,
  RequestSSOIdResponse,
  SSOBindSuccessMessage,
} from './xhsSSOTypes.js';
import {
  PALLAS_HTTP_BASE,
  RDMIND_SSO_WEB_URL,
} from '../config/xhsApiConfig.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const debugLogger = createDebugLogger('xhsSSOAuth');

/**
 * 小红书 SSO 自动认证核心逻辑
 */

// API 端点
const SSO_API_BASE = PALLAS_HTTP_BASE;
const REQUEST_SSO_ID_API = `${SSO_API_BASE}/pallas/rdmind/cli/rdmind-sso-id`;
const SSO_BIND_URL = RDMIND_SSO_WEB_URL;

// 默认配置
const DEFAULT_TIMEOUT_MS = 10000; // 10秒
const DEFAULT_API_TIMEOUT_MS = 5000; // 5秒

// 注意：SSO 登录不再自动设置默认模型
// 用户需要在登录后选择模型，模型配置在 xhsSsoProviders.ts 中

// 向后兼容：保留 COMPANY_DEFAULT_CONFIG 导出但不再使用
// 使用第一个模型作为默认值（仅用于兼容性）
export const COMPANY_DEFAULT_CONFIG = {
  baseUrl: 'https://runway.devops.rednote.life/openai/google/v1',
  model: 'gemini-3-flash-preview(low)',
};

/**
 * 全局事件总线，用于接收 WebSocket 的 sso_bind_success 消息
 */
export const ssoAuthEvents = new EventEmitter();

/**
 * 步骤1：调用 API 获取 request_sso_id
 */
async function getRequestSSOId(
  socketId: string,
  apiTimeout: number,
  debug: boolean,
): Promise<string> {
  const apiUrl = `${REQUEST_SSO_ID_API}?socketId=${encodeURIComponent(socketId)}`;

  if (debug) {
    debugLogger.debug('[XHS-SSO-Auth] 步骤1：请求 request_sso_id');
    debugLogger.debug('[XHS-SSO-Auth] API URL:', apiUrl);
  }

  try {
    const response = await fetchWithTimeout(apiUrl, apiTimeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '无法读取响应');
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${errorText}`,
      );
    }

    const data = (await response.json()) as RequestSSOIdResponse;

    if (debug) {
      debugLogger.debug(
        '[XHS-SSO-Auth] API 响应:',
        JSON.stringify(data, null, 2),
      );
    }

    // 提取 request_sso_id
    let requestSsoId: string | undefined;
    if (data.data?.rdmind_sso_id) {
      requestSsoId = data.data.rdmind_sso_id;
    } else if (data.rdmind_sso_id) {
      requestSsoId = data.rdmind_sso_id;
    }

    if (!requestSsoId) {
      throw new Error(`响应中未包含 rdmind_sso_id: ${JSON.stringify(data)}`);
    }

    if (debug) {
      debugLogger.debug(
        '[XHS-SSO-Auth] ✅ 获取 request_sso_id 成功:',
        requestSsoId,
      );
    }

    return requestSsoId;
  } catch (error) {
    if (debug) {
      debugLogger.error('[XHS-SSO-Auth] ❌ 获取 request_sso_id 失败:', error);
    }
    throw new Error(`获取 SSO 请求 ID 失败: ${(error as Error).message}`);
  }
}

/**
 * 步骤2：保存 request_sso_id 到 settings.json
 */
async function saveRequestSSOId(
  requestSsoId: string,
  settingsPath: string,
  debug: boolean,
): Promise<void> {
  if (debug) {
    debugLogger.debug(
      '[XHS-SSO-Auth] 步骤2：保存 request_sso_id 到 settings.json',
    );
  }

  try {
    await updateSettingsWithLock(
      settingsPath,
      {
        sso: {
          request_sso_id: requestSsoId,
        },
      },
      debug,
    );

    if (debug) {
      debugLogger.debug('[XHS-SSO-Auth] ✅ request_sso_id 保存成功');
    }
  } catch (error) {
    if (debug) {
      debugLogger.error('[XHS-SSO-Auth] ❌ 保存 request_sso_id 失败:', error);
    }
    throw error;
  }
}

/**
 * 步骤3：打开浏览器进行 SSO 绑定
 */
async function openSSOBindPage(
  requestSsoId: string,
  debug: boolean,
): Promise<void> {
  const bindUrl = `${SSO_BIND_URL}?rdmind_sso_id=${encodeURIComponent(requestSsoId)}`;

  if (debug) {
    debugLogger.debug('[XHS-SSO-Auth] 步骤3：打开浏览器进行 SSO 绑定');
    debugLogger.debug('[XHS-SSO-Auth] 绑定 URL:', bindUrl);
  }

  try {
    await openBrowserSecurely(bindUrl);
    if (debug) {
      debugLogger.debug('[XHS-SSO-Auth] ✅ 浏览器已打开');
    }
  } catch (error) {
    // 非致命错误，用户可以手动打开
    debugLogger.warn(
      '[XHS-SSO-Auth] ⚠️ 无法自动打开浏览器:',
      (error as Error).message,
    );
    debugLogger.warn('[XHS-SSO-Auth] 请手动访问:', bindUrl);
  }
}

/**
 * 步骤4：等待 WebSocket sso_bind_success 消息
 */
async function waitForSSOBindSuccess(
  timeout: number,
  debug: boolean,
): Promise<{ rdmind_sso_id: string; sso_name: string }> {
  if (debug) {
    debugLogger.debug(
      `[XHS-SSO-Auth] 步骤4：等待 WebSocket sso_bind_success 消息 (超时: ${timeout}ms)`,
    );
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      ssoAuthEvents.removeAllListeners('sso_bind_success');
      if (debug) {
        debugLogger.debug('[XHS-SSO-Auth] ⏰ 等待超时');
      }
      reject(new Error('SSO_TIMEOUT'));
    }, timeout);

    ssoAuthEvents.once('sso_bind_success', (message: SSOBindSuccessMessage) => {
      clearTimeout(timeoutId);

      if (debug) {
        debugLogger.debug('[XHS-SSO-Auth] ✅ 收到 sso_bind_success 消息');
        debugLogger.debug(
          '[XHS-SSO-Auth] rdmind_sso_id:',
          message.rdmind_sso_id,
        );
        debugLogger.debug('[XHS-SSO-Auth] sso_name:', message.sso_name);
      }

      resolve({
        rdmind_sso_id: message.rdmind_sso_id,
        sso_name: message.sso_name,
      });
    });
  });
}

/**
 * 步骤5：保存 SSO 凭证到独立文件，保存认证类型到 settings.json（第一部分）
 */
export async function saveSSOCredentialsAndAuthType(
  rdmindSsoId: string,
  ssoName: string,
  settingsPath: string,
  debug: boolean,
): Promise<void> {
  if (debug) {
    debugLogger.debug(
      '[XHS-SSO-Auth] 步骤5：保存 SSO 凭证和认证类型（第一部分）',
    );
  }

  try {
    // 5.1 保存 SSO 凭证到独立文件 ~/.rdmind/xhs_sso_creds.json
    await saveSSOCredentials(
      {
        rdmind_sso_id: rdmindSsoId,
        sso_name: ssoName,
      },
      debug,
    );

    if (debug) {
      debugLogger.debug('[XHS-SSO-Auth] ✅ SSO 凭证已保存到独立文件');
    }

    // 5.2 只保存认证类型到 settings.json（不保存 baseUrl 和 model）
    await updateSettingsWithLock(
      settingsPath,
      {
        security: {
          auth: {
            selectedType: 'xhs-sso',
          },
        },
      },
      debug,
    );

    if (debug) {
      debugLogger.debug('[XHS-SSO-Auth] ✅ 认证类型已保存到 settings.json');
    }
  } catch (error) {
    if (debug) {
      debugLogger.error('[XHS-SSO-Auth] ❌ 保存配置失败:', error);
    }
    throw error;
  }
}

/**
 * 步骤7：保存 API Key 到 settings.json（第二部分）
 */
export async function saveAPIKey(
  apiKey: string,
  settingsPath: string,
  debug: boolean,
): Promise<void> {
  if (debug) {
    debugLogger.debug('[XHS-SSO-Auth] 步骤7：保存 API Key（第二部分）');
  }

  try {
    // 加密 API Key 后保存
    const { encryptApiKey } = await import('../utils/apiKeyEncryption.js');
    const encryptedApiKey = encryptApiKey(apiKey);

    await updateSettingsWithLock(
      settingsPath,
      {
        security: {
          auth: {
            apiKey: encryptedApiKey,
          },
        },
      },
      debug,
    );

    if (debug) {
      debugLogger.debug('[XHS-SSO-Auth] ✅ API Key 保存成功（已加密）');
    }
  } catch (error) {
    if (debug) {
      debugLogger.error('[XHS-SSO-Auth] ❌ 保存 API Key 失败:', error);
    }
    throw error;
  }
}

/**
 * 执行完整的自动 SSO 认证流程
 *
 * @param config 认证配置
 * @param settingsPath settings.json 文件路径
 * @returns 认证结果
 */
export async function performAutoSSOAuth(
  config: SSOAuthConfig,
  settingsPath: string,
): Promise<SSOAuthResult> {
  const {
    socketId,
    timeout = DEFAULT_TIMEOUT_MS,
    apiTimeout = DEFAULT_API_TIMEOUT_MS,
    debug = false,
  } = config;

  if (debug) {
    debugLogger.debug(
      '[XHS-SSO-Auth] ========================================',
    );
    debugLogger.debug('[XHS-SSO-Auth] 开始自动 SSO 认证流程');
    debugLogger.debug('[XHS-SSO-Auth] socketId:', socketId);
    debugLogger.debug('[XHS-SSO-Auth] 超时设置:', timeout, 'ms');
    debugLogger.debug('[XHS-SSO-Auth] API 超时:', apiTimeout, 'ms');
    debugLogger.debug(
      '[XHS-SSO-Auth] ========================================',
    );
  }

  try {
    // 步骤1-3：获取 request_sso_id 并打开浏览器
    const requestSsoId = await getRequestSSOId(socketId, apiTimeout, debug);
    await saveRequestSSOId(requestSsoId, settingsPath, debug);
    await openSSOBindPage(requestSsoId, debug);

    // 步骤4：等待 WebSocket 消息
    let bindResult;
    try {
      bindResult = await waitForSSOBindSuccess(timeout, debug);
    } catch (error) {
      if ((error as Error).message === 'SSO_TIMEOUT') {
        if (debug) {
          debugLogger.debug(
            '[XHS-SSO-Auth] ========================================',
          );
          debugLogger.debug('[XHS-SSO-Auth] 认证流程超时');
          debugLogger.debug(
            '[XHS-SSO-Auth] ========================================',
          );
        }
        return {
          success: false,
          timeout: true,
          error: '认证超时，请重试或选择其他认证方式',
        };
      }
      throw error;
    }

    const { rdmind_sso_id, sso_name } = bindResult;

    // 步骤5：保存 SSO 凭证和认证类型（不再保存模型配置）
    await saveSSOCredentialsAndAuthType(
      rdmind_sso_id,
      sso_name,
      settingsPath,
      debug,
    );

    // 注意：不再自动保存 API Key、baseUrl 和 model
    // 用户需要在登录后选择模型，模型配置会在选择时保存

    if (debug) {
      debugLogger.debug(
        '[XHS-SSO-Auth] ========================================',
      );
      debugLogger.debug('[XHS-SSO-Auth] ✅ 自动 SSO 认证流程完成');
      debugLogger.debug('[XHS-SSO-Auth] rdmind_sso_id:', rdmind_sso_id);
      debugLogger.debug('[XHS-SSO-Auth] sso_name:', sso_name);
      debugLogger.debug(
        '[XHS-SSO-Auth] ========================================',
      );
    }

    return {
      success: true,
      credentials: {
        rdmind_sso_id,
        sso_name,
      },
      // 不再返回 apiKey，由用户选择模型后设置
    };
  } catch (error) {
    if (debug) {
      debugLogger.error(
        '[XHS-SSO-Auth] ========================================',
      );
      debugLogger.error('[XHS-SSO-Auth] ❌ 自动 SSO 认证流程失败');
      debugLogger.error('[XHS-SSO-Auth] 错误:', error);
      debugLogger.error(
        '[XHS-SSO-Auth] ========================================',
      );
    }

    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
