/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  type Config,
  decryptApiKey,
  encryptApiKey,
} from '@rdmind/rdmind-core';
import { type LoadedSettings, SettingScope } from '../../config/settings.js';
import { COMPANY_DEFAULT_CONFIG } from '@rdmind/rdmind-core';

interface ApplyXhsSsoConfigOptions {
  scope?: SettingScope;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  refresh?: boolean;
}

export interface ResolvedXhsSsoConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * 计算需要写入 settings/config 的 baseUrl、model、apiKey。
 * 如果缺少 apiKey，会自动调用 fetchModelKey。
 */
export async function resolveXhsSsoRuntimeConfig(
  config: Config,
  settings: LoadedSettings,
): Promise<ResolvedXhsSsoConfig> {
  const baseUrlCandidate = settings.merged.security?.auth?.baseUrl;
  const baseUrl =
    baseUrlCandidate && baseUrlCandidate.includes('xiaohongshu.com')
      ? baseUrlCandidate
      : COMPANY_DEFAULT_CONFIG.baseUrl;

  const modelCandidate = settings.merged.model?.name;
  const model =
    modelCandidate && modelCandidate !== '' && modelCandidate !== 'coder-model'
      ? modelCandidate
      : COMPANY_DEFAULT_CONFIG.model;

  let apiKey = settings.merged.security?.auth?.apiKey;
  if (!apiKey || apiKey.trim() === '') {
    try {
      const { fetchModelKey } = await import('@rdmind/rdmind-core');
      apiKey = await fetchModelKey(model, config.getDebugMode());
    } catch (error) {
      throw new Error(
        `无法获取默认模型 ${model} 的 API Key: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // 解密 API Key（如果已加密）
  const decryptedApiKey = decryptApiKey(apiKey);

  return {
    apiKey: decryptedApiKey,
    baseUrl,
    model,
  };
}

/**
 * 同步小红书 SSO 认证相关的设置与运行时 Config。
 *
 * @throws 当缺少 API Key 时抛出错误，提示用户重新完成 SSO 认证。
 */
export async function applyXhsSsoConfig(
  config: Config,
  settings: LoadedSettings,
  options: ApplyXhsSsoConfigOptions = {},
): Promise<void> {
  const scope = options.scope ?? SettingScope.User;
  const baseUrl =
    options.baseUrl ??
    settings.merged.security?.auth?.baseUrl ??
    COMPANY_DEFAULT_CONFIG.baseUrl;
  const model =
    options.model ??
    settings.merged.model?.name ??
    COMPANY_DEFAULT_CONFIG.model;
  const apiKey = options.apiKey ?? settings.merged.security?.auth?.apiKey;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('缺少小红书 SSO API Key，请先完成 SSO 认证。');
  }

  // 解密 API Key（如果已加密），得到明文用于运行时使用
  const decryptedApiKey = decryptApiKey(apiKey);

  // 加密明文 API Key 后保存到配置文件
  // 注意：如果 apiKey 已经是加密格式，decryptApiKey 会先解密，然后 encryptApiKey 会重新加密
  const encryptedApiKey = encryptApiKey(decryptedApiKey);

  settings.setValue(scope, 'security.auth.selectedType', AuthType.XHS_SSO);
  settings.setValue(scope, 'security.auth.baseUrl', baseUrl);
  settings.setValue(scope, 'security.auth.apiKey', encryptedApiKey);
  settings.setValue(scope, 'model.name', model);

  config.updateCredentials({
    apiKey: decryptedApiKey,
    baseUrl,
    model,
  });

  if (options.refresh) {
    await config.refreshAuth(AuthType.XHS_SSO);
    await config.setModel(model);
  }
}
