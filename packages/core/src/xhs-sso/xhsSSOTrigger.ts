/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchWithTimeout } from '../utils/fetch.js';
import { openBrowserSecurely } from '../utils/secure-browser-launcher.js';
import {
  PALLAS_HTTP_BASE,
  RDMIND_SSO_WEB_URL,
} from '../config/xhsApiConfig.js';

/**
 * 触发 SSO 认证流程
 * 1. 调用 API 获取 request_sso_id
 * 2. 打开浏览器让用户完成绑定
 *
 * @param socketId WebSocket socketId
 * @param debug 是否输出调试日志
 */
export async function triggerSSOAuth(
  socketId: string,
  debug = false,
): Promise<void> {
  const SSO_API_TIMEOUT_MS = 10000; // 10秒超时
  const apiUrl = `${PALLAS_HTTP_BASE}/pallas/rdmind/cli/rdmind-sso-id?socketId=${encodeURIComponent(socketId)}`;

  if (debug) {
    console.debug('[XHS-SSO-Trigger] 步骤1：调用 API 获取 request_sso_id');
    console.debug('[XHS-SSO-Trigger] API URL:', apiUrl);
  }

  // 调用 API 获取 request_sso_id
  let response: Response;
  try {
    response = await fetchWithTimeout(apiUrl, SSO_API_TIMEOUT_MS);
  } catch (fetchError) {
    const errorMessage =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
    throw new Error(`获取 SSO ID 失败: ${errorMessage}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '无法读取错误信息');
    throw new Error(
      `HTTP 错误! 状态码: ${response.status} ${response.statusText}\n响应内容: ${errorText}`,
    );
  }

  const responseData = (await response.json()) as {
    code?: number;
    message?: string;
    success?: boolean;
    data?: { rdmind_sso_id?: string; socket_id?: string };
    rdmind_sso_id?: string;
    error?: string;
    socket_id?: string;
  };

  // 提取 rdmind_sso_id
  let requestSsoId: string | undefined;

  if (responseData.data) {
    requestSsoId = responseData.data.rdmind_sso_id;
  } else if (responseData.rdmind_sso_id) {
    requestSsoId = responseData.rdmind_sso_id;
  }

  if (!requestSsoId) {
    const errorMsg =
      responseData.message ||
      responseData.error ||
      '响应格式错误或未包含 rdmind_sso_id';
    throw new Error(`获取 SSO ID 失败: ${errorMsg}`);
  }

  if (debug) {
    console.debug('[XHS-SSO-Trigger] ✅ 获取到 request_sso_id:', requestSsoId);
    console.debug('[XHS-SSO-Trigger] 步骤2：打开浏览器');
  }

  // 构建绑定 URL
  const bindUrl = `${RDMIND_SSO_WEB_URL}?rdmind_sso_id=${encodeURIComponent(requestSsoId)}`;

  // 打开浏览器
  try {
    await openBrowserSecurely(bindUrl);
    if (debug) {
      console.debug('[XHS-SSO-Trigger] ✅ 浏览器已打开:', bindUrl);
    }
  } catch (browserError) {
    // 非致命错误，用户可以手动打开
    console.warn(
      '[XHS-SSO-Trigger] ⚠️ 无法自动打开浏览器，请手动访问:',
      bindUrl,
    );
    console.warn(
      '[XHS-SSO-Trigger] 错误:',
      browserError instanceof Error
        ? browserError.message
        : String(browserError),
    );
  }
}
