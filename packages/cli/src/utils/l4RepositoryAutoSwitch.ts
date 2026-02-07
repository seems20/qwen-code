/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '@rdmind/rdmind-core';
import {
  AuthType,
  isGitRepository,
  getGitRemoteUrl,
  createDebugLogger,
} from '@rdmind/rdmind-core';
import type { LoadedSettings } from '../config/settings.js';
import { applyXhsSsoConfig } from '../ui/auth/xhsSsoConfig.js';

const debugLogger = createDebugLogger('l4Repository');

/**
 * 检查当前目录是否是 L4 敏感仓库
 * 通过调用接口判断仓库风险等级
 */
export async function isL4Repository(workspaceRoot: string): Promise<boolean> {
  try {
    if (!isGitRepository(workspaceRoot)) {
      return false;
    }

    const remoteUrl = getGitRemoteUrl(workspaceRoot);
    if (!remoteUrl) {
      return false;
    }

    // 调用接口判断仓库风险等级
    const isL4 = await checkRepositoryRiskLevel(remoteUrl);

    // 调试日志（可以通过环境变量控制）
    if (process.env['DEBUG'] || process.env['RDMIND_DEBUG']) {
      debugLogger.debug('[L4Repository] Git remote URL:', remoteUrl);
      debugLogger.debug('[L4Repository] Is L4 repository:', isL4);
    }

    return isL4;
  } catch (error) {
    if (process.env['DEBUG'] || process.env['RDMIND_DEBUG']) {
      debugLogger.debug('[L4Repository] Error checking repository:', error);
    }
    // 接口调用失败时返回false，不认为是L4仓库
    return false;
  }
}

/**
 * 调用接口检查仓库风险等级
 */
async function checkRepositoryRiskLevel(gitRepoUrl: string): Promise<boolean> {
  const apiUrl =
    'http://pallas.devops.xiaohongshu.com/pallas/rdmind/cli/repo-risk-level';

  try {
    const response = await fetch(
      `${apiUrl}?gitRepoUrl=${encodeURIComponent(gitRepoUrl)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as {
      code: number;
      data: string;
      msg: string;
      success: boolean;
    };

    if (data.success && data.code === 0) {
      return data.data === 'l4';
    } else {
      throw new Error(`API error: ${data.msg || 'Unknown error'}`);
    }
  } catch (error) {
    if (process.env['DEBUG'] || process.env['RDMIND_DEBUG']) {
      debugLogger.debug('[L4Repository] API call failed:', error);
    }
    throw error;
  }
}

/**
 * 自动切换到 QS 平台模型
 * 如果当前认证类型是 xhs-sso，则只切换模型
 * 如果不是，则切换到 xhs-sso 并设置模型为 qwen3-coder-480b-a35b-instruct
 */
export async function autoSwitchToQSModel(
  config: Config,
  settings: LoadedSettings,
): Promise<void> {
  const currentAuthType = settings.merged.security?.auth?.selectedType;
  const targetModel = 'qwen3-coder-480b-a35b-instruct';
  const targetBaseUrl = 'https://maas.devops.xiaohongshu.com/v1';

  if (currentAuthType === AuthType.XHS_SSO) {
    // 如果已经是 xhs-sso，只需要切换模型
    // 总是获取新的 apiKey 以确保使用正确的模型
    const { fetchModelKey } = await import('@rdmind/rdmind-core');
    const newApiKey = await fetchModelKey(targetModel);
    await applyXhsSsoConfig(config, settings, {
      apiKey: newApiKey,
      baseUrl: targetBaseUrl,
      model: targetModel,
      refresh: true,
    });
  } else {
    // 如果不是 xhs-sso，需要切换到 xhs-sso 并设置模型
    // 首先需要获取 apiKey
    const { fetchModelKey } = await import('@rdmind/rdmind-core');
    const apiKey = await fetchModelKey(targetModel);

    await applyXhsSsoConfig(config, settings, {
      apiKey,
      baseUrl: targetBaseUrl,
      model: targetModel,
      refresh: true,
    });
  }
}
