/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PALLAS_HTTP_BASE, createDebugLogger } from '@rdmind/rdmind-core';

const debugLogger = createDebugLogger('plugin-sync');
const debugLog = (...args: unknown[]) => debugLogger.debug(...args);

/**
 * 插件同步请求数据结构
 */
interface PluginSyncRequest {
  rdmindSsoId: string;
  clientPlugins: ClientPluginInfo[];
}

const PluginTypes = new Map([
  ['commands', 'command'],
  ['agents', 'subagent'],
  ['orion_subagent', 'orion_subagent'],
  ['rules', 'rules'],
  ['flow', 'flow'],
  ['all', 'all'],
]);

/**
 * 客户端插件信息
 */
interface ClientPluginInfo {
  id: number;
  name: string;
  type: string;
}

/**
 * SSO凭证信息
 */
interface SsoCredentials {
  rdmind_sso_id: string;
  sso_name: string;
}

/**
 * 是否启用调试日志
 */
export function setDebugMode(_enabled: boolean): void {
  // 调试模式设置保留供将来使用
}

/**
 * 读取 xhs_sso_creds.json 中的 rdmind_sso_id 和 sso_name
 */
function getSsoCredentials(): SsoCredentials | null {
  try {
    const credsPath = path.join(os.homedir(), '.rdmind', 'xhs_sso_creds.json');
    if (fs.existsSync(credsPath)) {
      const content = fs.readFileSync(credsPath, 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const rdmindSsoId = parsed?.['rdmind_sso_id'];
      const ssoName = parsed?.['sso_name'];

      if (
        typeof rdmindSsoId === 'string' &&
        rdmindSsoId &&
        typeof ssoName === 'string' &&
        ssoName
      ) {
        return {
          rdmind_sso_id: rdmindSsoId,
          sso_name: ssoName,
        };
      } else {
        debugLog('文件中未找到有效的rdmind_sso_id或sso_name');
      }
    } else {
      debugLog('SSO凭证文件不存在');
    }
  } catch (error) {
    debugLog('读取 xhs_sso_creds.json 中的凭证信息失败:', error);
  }
  return null;
}

/**
 * 获取客户端插件列表
 */
function getClientPlugins(): ClientPluginInfo[] {
  const plugins: ClientPluginInfo[] = [];

  try {
    const rdmindDir = path.join(os.homedir(), '.rdmind');
    const pluginTypes = ['agents', 'commands', 'rules'];

    for (const pluginType of pluginTypes) {
      const pluginTypeDir = path.join(rdmindDir, pluginType);

      if (!fs.existsSync(pluginTypeDir)) {
        continue;
      }

      // 读取插件ID目录
      const idDirs = fs.readdirSync(pluginTypeDir);

      for (const idDir of idDirs) {
        const idPath = path.join(pluginTypeDir, idDir);

        // 确保这是一个目录且目录名是一个数字
        if (!fs.statSync(idPath).isDirectory()) {
          continue;
        }

        const id = parseInt(idDir, 10);
        if (isNaN(id)) {
          continue;
        }

        // 读取插件文件
        const files = fs.readdirSync(idPath);
        for (const file of files) {
          if (file.endsWith('.md') || file.endsWith('.toml')) {
            // 从文件名提取插件名称（去掉扩展名）
            const pluginName = path.basename(file, path.extname(file));

            // 添加新插件
            plugins.push({
              id,
              name: pluginName,
              type: PluginTypes.get(pluginType) || 'unknown',
            });
            break; // 每个ID目录只取第一个有效文件
          }
        }
      }
    }
  } catch (error) {
    debugLog('读取客户端插件列表失败:', error);
  }
  return plugins;
}

/**
 * 同步插件信息到服务端
 */
export async function syncPlugins(): Promise<void> {
  try {
    const credentials = getSsoCredentials();
    if (!credentials) {
      debugLog('未找到有效的SSO凭证，跳过插件同步');
      return;
    }

    const clientPlugins = getClientPlugins();

    const request: PluginSyncRequest = {
      rdmindSsoId: credentials.rdmind_sso_id,
      clientPlugins,
    };

    const apiBaseUrl =
      process.env['RDMIND_API_BASE_URL']?.trim() || PALLAS_HTTP_BASE;
    const url = `${apiBaseUrl}/pallas/rdmind/cli/sync`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sso-name': credentials.sso_name, // 将sso_name放入HTTP请求头
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      debugLog(`插件同步失败，HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const result = await response.json();
    debugLog('插件同步成功，服务器响应:', result);
  } catch (error) {
    debugLog('插件同步异常:', error);
  }
}
