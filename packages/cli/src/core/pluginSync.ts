/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PALLAS_HTTP_BASE } from '@rdmind/rdmind-core';

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
  ['all', 'all']
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
let globalDebugMode = false;

export function setDebugMode(enabled: boolean): void {
  globalDebugMode = enabled;
}

function isDebugEnabled(): boolean {
  return (
    globalDebugMode ||
    process.env['DEBUG'] === '1' ||
    process.env['DEBUG'] === 'true' ||
    process.env['DEBUG_MODE'] === '1' ||
    process.env['DEBUG_MODE'] === 'true' ||
    process.env['RDMIND_DEBUG_PLUGIN_SYNC'] === '1'
  );
}

/**
 * 调试日志输出
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(`[plugin-sync] ${message}`, ...args);
  }
}

/**
 * 读取 xhs_sso_creds.json 中的 rdmind_sso_id 和 sso_name
 */
function getSsoCredentials(): SsoCredentials | null {
  try {
    const credsPath = path.join(os.homedir(), '.rdmind', 'xhs_sso_creds.json');
    debugLog(`尝试从路径读取SSO凭证: ${credsPath}`);
    if (fs.existsSync(credsPath)) {
      const content = fs.readFileSync(credsPath, 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const rdmindSsoId = parsed?.['rdmind_sso_id'];
      const ssoName = parsed?.['sso_name'];
      
      if (typeof rdmindSsoId === 'string' && rdmindSsoId && typeof ssoName === 'string' && ssoName) {
        debugLog('成功读取rdmind_sso_id和sso_name');
        return {
          rdmind_sso_id: rdmindSsoId,
          sso_name: ssoName
        };
      } else {
        debugLog('文件中未找到有效的rdmind_sso_id或sso_name');
      }
    } else {
      debugLog('SSO凭证文件不存在');
    }
  } catch (error) {
    console.error('读取 xhs_sso_creds.json 中的凭证信息失败:', error);
  }
  return null;
}

/**
 * 获取客户端插件列表
 */
function getClientPlugins(): ClientPluginInfo[] {
  debugLog('获取客户端插件列表');
  const plugins: ClientPluginInfo[] = [];
  
  try {
    const rdmindDir = path.join(os.homedir(), '.rdmind');
    const pluginTypes = ['agents', 'commands', 'rules'];
    
    for (const pluginType of pluginTypes) {
      const pluginTypeDir = path.join(rdmindDir, pluginType);
      
      if (!fs.existsSync(pluginTypeDir)) {
        debugLog(`插件类型目录不存在: ${pluginTypeDir}`);
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
              type: PluginTypes.get(pluginType) || 'unknown'
            });
            break; // 每个ID目录只取第一个有效文件
          }
        }
      }
    }
  } catch (error) {
    console.error('读取客户端插件列表失败:', error);
  }
  
  debugLog(`找到 ${plugins.length} 个插件`);
  return plugins;
}

/**
 * 同步插件信息到服务端
 */
export async function syncPlugins(): Promise<void> {
  try {
    debugLog('开始插件同步流程');
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

    debugLog('构建同步请求', request);

    const apiBaseUrl = process.env['RDMIND_API_BASE_URL']?.trim() || PALLAS_HTTP_BASE;
    const url = `${apiBaseUrl}/pallas/rdmind/cli/sync`;
    debugLog(`准备发送POST请求到: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sso-name': credentials.sso_name,  // 将sso_name放入HTTP请求头
      },
      body: JSON.stringify(request),
    });

    debugLog(`收到响应状态: ${response.status}`);

    if (!response.ok) {
      console.error(`插件同步失败，HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const result = await response.json();
    debugLog('插件同步成功，服务器响应:', result);
  } catch (error) {
    console.error('插件同步异常:', error);
  }
}