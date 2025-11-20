/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * 小红书 SSO 凭证存储管理
 * 提供简单的文件锁机制，防止多窗口同时写入
 */

const XHS_DIR = '.rdmind';
const XHS_CREDENTIAL_FILENAME = 'xhs_sso_creds.json';
const XHS_LOCK_FILENAME = 'xhs_creds.lock';

// 锁配置（方案B：3次重试，每次100ms）
const LOCK_MAX_ATTEMPTS = 3;
const LOCK_RETRY_INTERVAL_MS = 100;

/**
 * 获取锁文件路径
 */
function getLockFilePath(): string {
  return path.join(os.homedir(), XHS_DIR, XHS_LOCK_FILENAME);
}

/**
 * Sleep 工具函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取文件锁（简单实现：3次重试）
 *
 * @param lockPath 锁文件路径
 * @param debug 是否输出调试日志
 * @throws Error 如果无法获取锁
 */
async function acquireLock(lockPath: string, debug = false): Promise<void> {
  for (let attempt = 1; attempt <= LOCK_MAX_ATTEMPTS; attempt++) {
    try {
      if (debug) {
        console.debug(
          `[XHS-SSO-Lock] 尝试获取锁 (第 ${attempt}/${LOCK_MAX_ATTEMPTS} 次)...`,
        );
      }

      // 原子操作：文件存在则失败
      await fs.writeFile(lockPath, process.pid.toString(), { flag: 'wx' });

      if (debug) {
        console.debug('[XHS-SSO-Lock] ✅ 成功获取锁');
      }
      return; // 成功获取锁
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        // 锁文件已存在
        if (attempt < LOCK_MAX_ATTEMPTS) {
          if (debug) {
            console.debug(
              `[XHS-SSO-Lock] 锁被占用，等待 ${LOCK_RETRY_INTERVAL_MS}ms 后重试...`,
            );
          }
          await sleep(LOCK_RETRY_INTERVAL_MS);
          continue;
        }

        // 3次都失败
        throw new Error(
          '启动失败：无法获取配置文件锁，可能有其他 rdmind 进程正在写入配置。\n' +
            '请稍后重新启动应用。',
        );
      }

      // 其他文件系统错误
      throw new Error(`无法创建锁文件: ${(error as Error).message}`);
    }
  }
}

/**
 * 释放文件锁
 *
 * @param lockPath 锁文件路径
 * @param debug 是否输出调试日志
 */
async function releaseLock(lockPath: string, debug = false): Promise<void> {
  try {
    await fs.unlink(lockPath);
    if (debug) {
      console.debug('[XHS-SSO-Lock] 🔓 释放锁成功');
    }
  } catch (error) {
    // 忽略 ENOENT 错误（文件不存在）
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (debug) {
        console.warn('[XHS-SSO-Lock] ⚠️ 释放锁失败:', (error as Error).message);
      }
    }
  }
}

/**
 * 使用文件锁执行操作
 *
 * @param operation 需要执行的操作
 * @param debug 是否输出调试日志
 */
export async function withFileLock<T>(
  operation: () => Promise<T>,
  debug = false,
): Promise<T> {
  const lockPath = getLockFilePath();

  try {
    await acquireLock(lockPath, debug);
    return await operation();
  } finally {
    await releaseLock(lockPath, debug);
  }
}

/**
 * 确保目录存在
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw new Error(`无法创建目录 ${dirPath}: ${(error as Error).message}`);
  }
}

/**
 * 写入数据到 settings.json（带文件锁）
 * 这是一个通用的 settings 更新函数
 *
 * @param settingsPath settings.json 路径
 * @param updates 要更新的字段
 * @param debug 是否输出调试日志
 */
export async function updateSettingsWithLock(
  settingsPath: string,
  updates: Record<string, unknown>,
  debug = false,
): Promise<void> {
  if (debug) {
    console.debug('[XHS-SSO-Storage] 准备更新 settings.json...');
    console.debug(
      '[XHS-SSO-Storage] 更新内容:',
      JSON.stringify(updates, null, 2),
    );
  }

  await withFileLock(async () => {
    // 确保目录存在
    const dirPath = path.dirname(settingsPath);
    await ensureDirectoryExists(dirPath);

    // 读取现有配置
    let existingSettings: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      existingSettings = JSON.parse(content);
      if (debug) {
        console.debug('[XHS-SSO-Storage] 读取现有配置成功');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(
          '[XHS-SSO-Storage] 读取现有配置失败，将创建新文件:',
          error,
        );
      } else if (debug) {
        console.debug('[XHS-SSO-Storage] 配置文件不存在，将创建新文件');
      }
    }

    // 深度合并配置
    const mergedSettings = deepMerge(existingSettings, updates);

    // 写入文件
    const content = JSON.stringify(mergedSettings, null, 2);
    await fs.writeFile(settingsPath, content, { mode: 0o600 });

    if (debug) {
      console.debug('[XHS-SSO-Storage] ✅ settings.json 更新成功');
    }
  }, debug);
}

/**
 * 深度合并两个对象
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      // 递归合并对象
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      );
    } else {
      // 直接覆盖
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * 获取 SSO 凭证文件路径
 */
function getSSOCredentialsPath(): string {
  return path.join(os.homedir(), XHS_DIR, XHS_CREDENTIAL_FILENAME);
}

/**
 * 从 xhs_sso_creds.json 读取 SSO 凭证（异步版本）
 *
 * @returns SSO 凭证，如果不存在返回 null
 */
export async function readSSOCredentials(): Promise<{
  rdmind_sso_id: string;
  sso_name: string;
} | null> {
  try {
    const credPath = getSSOCredentialsPath();
    const content = await fs.readFile(credPath, 'utf-8');
    const creds = JSON.parse(content);

    if (
      creds &&
      typeof creds.rdmind_sso_id === 'string' &&
      creds.rdmind_sso_id
    ) {
      return {
        rdmind_sso_id: creds.rdmind_sso_id,
        sso_name: creds.sso_name || 'Unknown',
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[XHS-SSO-Storage] 读取 SSO 凭证失败:', error);
    }
  }

  return null;
}

/**
 * 从 xhs_sso_creds.json 读取 SSO 凭证（同步版本）
 * 用于需要同步判断的场景
 *
 * @returns SSO 凭证，如果不存在返回 null
 */
export function readSSOCredentialsSync(): {
  rdmind_sso_id: string;
  sso_name: string;
} | null {
  try {
    const credPath = getSSOCredentialsPath();
    const content = fsSync.readFileSync(credPath, 'utf-8');
    const creds = JSON.parse(content);

    if (
      creds &&
      typeof creds.rdmind_sso_id === 'string' &&
      creds.rdmind_sso_id
    ) {
      return {
        rdmind_sso_id: creds.rdmind_sso_id,
        sso_name: creds.sso_name || 'Unknown',
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[XHS-SSO-Storage] 读取 SSO 凭证失败:', error);
    }
  }

  return null;
}

/**
 * 保存 SSO 凭证到独立文件
 *
 * @param credentials SSO 凭证
 * @param debug 是否输出调试日志
 */
export async function saveSSOCredentials(
  credentials: { rdmind_sso_id: string; sso_name: string },
  debug = false,
): Promise<void> {
  await withFileLock(async () => {
    const credPath = getSSOCredentialsPath();
    const xhsDir = path.dirname(credPath);

    // 确保目录存在
    await fs.mkdir(xhsDir, { recursive: true });

    // 写入凭证文件
    await fs.writeFile(credPath, JSON.stringify(credentials, null, 2), 'utf-8');

    if (debug) {
      console.debug(`[XHS-SSO-Storage] SSO 凭证已保存到 ${credPath}`);
    }
  }, debug);
}

/**
 * 判断是否需要自动 SSO 认证
 *
 * @param settings 配置对象
 * @returns 是否需要自动 SSO 认证
 */
export function shouldTriggerAutoSSOAuth(settings: {
  merged: {
    security?: {
      auth?: {
        selectedType?: string;
        apiKey?: string;
      };
    };
  };
}): boolean {
  const authType = settings.merged.security?.auth?.selectedType;
  const apiKey = settings.merged.security?.auth?.apiKey;

  // 情况1：没有任何认证配置 → 需要自动 SSO 认证
  if (!authType) {
    return true;
  }

  // 情况2：认证类型是 xhs-sso
  if (authType === 'xhs-sso') {
    // 2.1 检查是否有 rdmind_sso_id
    try {
      const credentials = readSSOCredentialsSync();
      if (!credentials || !credentials.rdmind_sso_id) {
        return true;
      }
    } catch {
      return true;
    }

    // 2.2 检查是否有 apiKey
    if (!apiKey || apiKey.trim() === '') {
      return true;
    }

    // 都有 → 不需要重新认证
    return false;
  }

  // 其他情况（qwen、openai 等）：不需要
  return false;
}
