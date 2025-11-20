/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config } from '@rdmind/rdmind-core';
import { AuthType } from '@rdmind/rdmind-core';
import { isGitRepository, getGitRemoteUrl } from '@rdmind/rdmind-core';
import type { LoadedSettings } from '../config/settings.js';
import { applyXhsSsoConfig } from '../ui/auth/xhsSsoConfig.js';
import { L4_SENSITIVE_REPOSITORIES } from './l4SensitiveRepositories.js';

/**
 * 检查当前目录是否是 L4 敏感仓库
 */
export function isL4Repository(workspaceRoot: string): boolean {
  try {
    if (!isGitRepository(workspaceRoot)) {
      return false;
    }

    const remoteUrl = getGitRemoteUrl(workspaceRoot);
    if (!remoteUrl) {
      return false;
    }

    // 检查远程地址是否匹配敏感仓库列表
    const isMatch = L4_SENSITIVE_REPOSITORIES.some(
      (repo) => remoteUrl.includes(repo) || repo.includes(remoteUrl),
    );

    // 调试日志（可以通过环境变量控制）
    if (process.env['DEBUG'] || process.env['RDMIND_DEBUG']) {
      console.debug('[L4Repository] Git remote URL:', remoteUrl);
      console.debug('[L4Repository] Is L4 repository:', isMatch);
    }

    return isMatch;
  } catch (error) {
    if (process.env['DEBUG'] || process.env['RDMIND_DEBUG']) {
      console.debug('[L4Repository] Error checking repository:', error);
    }
    return false;
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
    // 需要获取当前的 apiKey（可能是加密的）
    const apiKey = settings.merged.security?.auth?.apiKey;
    if (!apiKey) {
      // 如果没有 apiKey，需要重新获取
      const { fetchModelKey } = await import('@rdmind/rdmind-core');
      const newApiKey = await fetchModelKey(targetModel, config.getDebugMode());
      await applyXhsSsoConfig(config, settings, {
        apiKey: newApiKey,
        baseUrl: targetBaseUrl,
        model: targetModel,
        refresh: true,
      });
    } else {
      // 使用现有的 apiKey，只更新模型和 baseUrl
      await applyXhsSsoConfig(config, settings, {
        apiKey,
        baseUrl: targetBaseUrl,
        model: targetModel,
        refresh: true,
      });
    }
  } else {
    // 如果不是 xhs-sso，需要切换到 xhs-sso 并设置模型
    // 首先需要获取 apiKey
    const { fetchModelKey } = await import('@rdmind/rdmind-core');
    const apiKey = await fetchModelKey(targetModel, config.getDebugMode());

    await applyXhsSsoConfig(config, settings, {
      apiKey,
      baseUrl: targetBaseUrl,
      model: targetModel,
      refresh: true,
    });
  }
}

