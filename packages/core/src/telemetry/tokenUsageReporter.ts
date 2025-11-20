/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { sessionId } from '../utils/session.js';
import { PALLAS_HTTP_BASE } from '../config/xhsApiConfig.js';

// 声明全局 registerCleanup 函数类型
declare global {
  var registerCleanup:
    | ((fn: (() => void) | (() => Promise<void>)) => void)
    | undefined;
}

/**
 * Token 使用记录项
 */
export interface TokenUsageItem {
  requestId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  thoughtsTokens: number;
  toolTokens: number;
  totalTokens: number;
  durationMs?: number;
  statusCode?: string;
  timestamp: string;
}

/**
 * 批量上报配置
 */
const BATCH_SIZE = 10; // 批量大小：10条
const BATCH_INTERVAL_MS = 60 * 1000; // 批量间隔：1分钟

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
    process.env['RDMIND_DEBUG_TOKEN_USAGE'] === '1'
  );
}

/**
 * 调试日志输出
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (isDebugEnabled()) {
    console.log(`[tokenUsageReporter] ${message}`, ...args);
  }
}

/**
 * 获取 API Base URL
 */
function getApiBaseUrl(): string {
  return process.env['RDMIND_API_BASE_URL']?.trim() || PALLAS_HTTP_BASE;
}

/**
 * 读取 xhs_sso_creds.json 中的 rdmind_sso_id
 */
function getRdmindSsoId(): string | undefined {
  try {
    // 从独立的 SSO 凭证文件读取
    const credsPath = path.join(os.homedir(), '.rdmind', 'xhs_sso_creds.json');
    if (fs.existsSync(credsPath)) {
      const content = fs.readFileSync(credsPath, 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const rdmindSsoId = parsed?.['rdmind_sso_id'];
      if (typeof rdmindSsoId === 'string' && rdmindSsoId) {
        return rdmindSsoId;
      }
    }
  } catch (error) {
    // 忽略读取错误
    debugLog('读取 xhs_sso_creds.json 中的 rdmind_sso_id 失败:', error);
  }
  return undefined;
}

/**
 * Token 使用量批量上报器
 * 支持批量上报：收集10条或1分钟内的数据后批量发送
 */
export class TokenUsageReporter {
  private static instance: TokenUsageReporter;
  private readonly queue: TokenUsageItem[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private lastFlushTime: number = Date.now();
  private isFlushInProgress: boolean = false;
  private isShutdown: boolean = false;

  private constructor() {
    // 启动定时器，确保即使未达到批量大小也会定期上报
    this.startFlushTimer();

    // 注册退出处理器，确保退出时上报剩余数据
    this.registerExitHandlers();
  }

  /**
   * 注册退出处理器，确保退出时上报剩余数据
   * 只依赖全局清理机制，避免与其他信号处理器冲突
   */
  private registerExitHandlers(): void {
    // 注册清理函数到全局清理列表（如果存在）
    // 这样可以确保在各种退出场景下都能正确上报
    // 包括: process.exit(), beforeExit, SIGTERM, SIGINT 等
    if (typeof global !== 'undefined' && global.registerCleanup) {
      global.registerCleanup(() => this.shutdown(true));
      debugLog('已注册到全局清理列表');
    } else {
      // 如果全局清理机制不可用，记录警告
      debugLog(
        '警告: global.registerCleanup 不可用，退出时可能无法上报剩余数据',
      );
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(): TokenUsageReporter {
    if (!TokenUsageReporter.instance) {
      TokenUsageReporter.instance = new TokenUsageReporter();
    }
    return TokenUsageReporter.instance;
  }

  /**
   * 检查 Token 使用记录是否所有 token 字段都为 0
   */
  private isAllTokensZero(item: TokenUsageItem): boolean {
    return (
      item.inputTokens === 0 &&
      item.outputTokens === 0 &&
      item.cachedTokens === 0 &&
      item.thoughtsTokens === 0 &&
      item.toolTokens === 0 &&
      item.totalTokens === 0
    );
  }

  /**
   * 添加 Token 使用记录到队列
   */
  addTokenUsage(item: TokenUsageItem): void {
    if (this.isShutdown) {
      debugLog('上报器已关闭，跳过添加 Token 使用记录');
      return;
    }

    // 检查所有 token 字段是否都为 0，如果是则跳过，不加入队列
    if (this.isAllTokensZero(item)) {
      if (isDebugEnabled()) {
        debugLog(
          `跳过添加 Token 使用记录（所有 token 字段都为 0），requestId: ${item.requestId}, model: ${item.model}`,
        );
      }
      return;
    }

    this.queue.push(item);

    // 始终输出一条简单日志，确认上报功能被触发
    if (isDebugEnabled()) {
      debugLog(
        `添加 Token 使用记录到队列，当前队列长度: ${this.queue.length}/${BATCH_SIZE}`,
        {
          model: item.model,
          totalTokens: item.totalTokens,
          requestId: item.requestId,
        },
      );
    } else {
      // 即使没有启用调试模式，也输出一条简单日志（每10条输出一次，避免日志过多）
      // 但第一次调用时总是输出，确保用户知道上报功能已启用
      if (this.queue.length % 10 === 0 || this.queue.length === 1) {
        console.log(
          `[tokenUsageReporter] 已收集 ${this.queue.length} 条 Token 使用记录（达到 ${BATCH_SIZE} 条或 ${BATCH_INTERVAL_MS / 1000} 秒后上报）`,
        );
      }
    }

    // 如果达到批量大小，立即触发上报
    if (this.queue.length >= BATCH_SIZE) {
      console.log(
        `[tokenUsageReporter] 队列达到批量大小 ${BATCH_SIZE}，立即触发上报`,
      );
      debugLog(`队列达到批量大小 ${BATCH_SIZE}，立即触发上报`);
      this.flush();
    }
  }

  /**
   * 启动定时刷新器
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastFlush = now - this.lastFlushTime;
      // 如果距离上次上报超过1分钟，且队列不为空，则触发上报
      if (timeSinceLastFlush >= BATCH_INTERVAL_MS && this.queue.length > 0) {
        debugLog(
          `定时器触发上报，距离上次上报: ${Math.round(timeSinceLastFlush / 1000)}秒，队列长度: ${this.queue.length}`,
        );
        this.flush();
      } else {
        debugLog(
          `定时器检查: 距离上次上报 ${Math.round(timeSinceLastFlush / 1000)}秒，队列长度: ${this.queue.length}`,
        );
      }
    }, BATCH_INTERVAL_MS);
  }

  /**
   * 立即上报队列中的所有数据
   */
  async flush(): Promise<void> {
    if (this.isShutdown) {
      debugLog('上报器已关闭，跳过 flush');
      return;
    }
    if (this.isFlushInProgress) {
      debugLog('上报正在进行中，跳过本次 flush');
      return;
    }
    if (this.queue.length === 0) {
      debugLog('队列为空，跳过 flush');
      return;
    }

    this.isFlushInProgress = true;

    let items: TokenUsageItem[] = [];
    let validItems: TokenUsageItem[] = [];
    try {
      items = [...this.queue];
      this.queue.length = 0; // 清空队列

      // 过滤掉所有 token 字段都为 0 的记录（双重检查，防止之前加入的记录）
      validItems = items.filter((item) => !this.isAllTokensZero(item));
      const filteredCount = items.length - validItems.length;

      if (filteredCount > 0) {
        if (isDebugEnabled()) {
          debugLog(`过滤掉 ${filteredCount} 条所有 token 字段都为 0 的记录`);
        }
      }

      // 如果没有有效记录，直接返回
      if (validItems.length === 0) {
        if (isDebugEnabled()) {
          debugLog('没有有效的 Token 使用记录，跳过上报');
        }
        return;
      }

      const rdmindSsoId = getRdmindSsoId();
      if (!rdmindSsoId) {
        console.warn(
          `[tokenUsageReporter] ⚠️  rdmind_sso_id 不存在，跳过上报（${validItems.length} 条记录已放回队列）`,
        );
        debugLog('rdmind_sso_id 不存在，跳过上报');
        // 将有效数据放回队列，等待下次尝试
        this.queue.unshift(...validItems);
        return;
      }

      debugLog(
        `[tokenUsageReporter] 开始上报 ${validItems.length} 条 Token 使用记录`,
      );
      debugLog(
        `开始上报 ${validItems.length} 条 Token 使用记录，rdmind_sso_id: ${rdmindSsoId}`,
      );
      // 正常上报使用默认超时（5秒），退出时会在 shutdown 中设置更短的超时
      const success = await this.reportToServer(rdmindSsoId, validItems);
      if (success) {
        this.lastFlushTime = Date.now();
        console.log(
          `[tokenUsageReporter] ✅ 成功上报 ${validItems.length} 条 Token 使用记录`,
        );
        debugLog(`✅ 成功上报 ${validItems.length} 条 Token 使用记录`);
      } else {
        // 上报失败，将有效数据放回队列（保留最新的数据）
        // 如果队列已满，丢弃最旧的数据
        const maxRetrySize = BATCH_SIZE * 2; // 允许保留最多2倍批量大小的数据
        if (this.queue.length + validItems.length > maxRetrySize) {
          const toKeep = maxRetrySize - this.queue.length;
          this.queue.unshift(...validItems.slice(-toKeep));
          console.warn(
            `[tokenUsageReporter] 上报失败，队列已满，丢弃 ${validItems.length - toKeep} 条旧数据`,
          );
        } else {
          this.queue.unshift(...validItems);
          debugLog(`上报失败，将 ${validItems.length} 条数据放回队列重试`);
        }
      }
    } catch (error) {
      console.error('[tokenUsageReporter] 上报异常:', error);
      debugLog('上报异常详情:', error);
      // 异常情况下，将有效数据放回队列
      if (validItems.length > 0) {
        this.queue.unshift(...validItems);
      }
    } finally {
      this.isFlushInProgress = false;
    }
  }

  /**
   * 上报数据到服务器
   *
   * @param rdmindSsoId rdmind_sso_id
   * @param items Token 使用记录列表
   * @param timeoutMs 超时时间（毫秒），默认 5000ms，退出时建议使用 500ms
   */
  private async reportToServer(
    rdmindSsoId: string,
    items: TokenUsageItem[],
    timeoutMs: number = 5000,
  ): Promise<boolean> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const url = `${apiBaseUrl}/pallas/rdmind/cli/report-token-usage?rdmind_sso_id=${encodeURIComponent(rdmindSsoId)}`;

      const requestBody = {
        rdmindSsoId,
        sessionId,
        items: items.map((item) => ({
          requestId: item.requestId,
          model: item.model,
          inputTokens: item.inputTokens,
          outputTokens: item.outputTokens,
          cachedTokens: item.cachedTokens,
          thoughtsTokens: item.thoughtsTokens,
          toolTokens: item.toolTokens,
          totalTokens: item.totalTokens,
          durationMs: item.durationMs,
          statusCode: item.statusCode,
          timestamp: item.timestamp,
        })),
      };

      debugLog(`上报 URL: ${url}`);
      debugLog(`上报数据:`, {
        sessionId,
        itemCount: items.length,
        totalTokens: items.reduce((sum, item) => sum + item.totalTokens, 0),
        models: [...new Set(items.map((item) => item.model))],
      });

      // 创建 AbortController 用于超时控制
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        clearTimeout(timeoutId);
        debugLog(`服务器响应状态: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(
            `[tokenUsageReporter] 上报失败，HTTP ${response.status}: ${errorText}`,
          );
          return false;
        }

        const result = await response.json();
        debugLog(`服务器返回结果:`, result);
        if (result.success === true) {
          return true;
        } else {
          console.error(
            `[tokenUsageReporter] 上报失败，服务器返回: ${result.message || 'Unknown error'}`,
          );
          return false;
        }
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn(
            `[tokenUsageReporter] 上报请求超时（${timeoutMs}ms），已取消`,
          );
          return false;
        }
        throw fetchError; // 重新抛出其他错误
      }
    } catch (error) {
      console.error('[tokenUsageReporter] 上报请求异常:', error);
      return false;
    }
  }

  /**
   * 关闭上报器（清理资源）
   * 在进程退出时，会尝试上报剩余数据
   *
   * @param waitForFlush 是否等待上报完成（默认 true，退出时建议等待）
   * @param timeoutMs 退出时的超时时间（毫秒），默认 500ms，避免阻塞退出流程
   */
  async shutdown(
    waitForFlush: boolean = true,
    timeoutMs: number = 500,
  ): Promise<void> {
    if (this.isShutdown) {
      return; // 避免重复调用
    }

    // 先停止定时器，但不要立即设置 isShutdown
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 尝试上报剩余数据（在设置 isShutdown 之前）
    if (this.queue.length > 0) {
      debugLog(
        `[tokenUsageReporter] 关闭时发现 ${this.queue.length} 条未上报记录，开始上报（最多等待 ${timeoutMs}ms）...`,
      );
      if (waitForFlush) {
        // 等待上报完成，但设置超时避免阻塞退出
        try {
          // 创建一个带超时的 flush 操作
          const flushPromise = this.flushWithTimeout(timeoutMs);
          await flushPromise;
          debugLog('[tokenUsageReporter] 关闭时上报剩余数据完成');
        } catch (error) {
          if (error instanceof Error && error.message.includes('超时')) {
            console.warn(
              `[tokenUsageReporter] 关闭时上报超时（${timeoutMs}ms），已取消上报`,
            );
          } else {
            console.error(
              '[tokenUsageReporter] 关闭时上报剩余数据失败:',
              error,
            );
          }
        }
      } else {
        // 不等待完成（不推荐，可能导致数据丢失）
        this.flushWithTimeout(timeoutMs).catch((error) => {
          console.error('[tokenUsageReporter] 关闭时上报剩余数据失败:', error);
        });
      }
    }

    // 上报完成后再设置 isShutdown，防止后续调用
    this.isShutdown = true;
  }

  /**
   * 带超时的 flush 操作（用于退出时）
   */
  private async flushWithTimeout(timeoutMs: number): Promise<void> {
    if (this.isShutdown) {
      return;
    }
    if (this.isFlushInProgress) {
      return;
    }
    if (this.queue.length === 0) {
      return;
    }

    this.isFlushInProgress = true;

    let items: TokenUsageItem[] = [];
    let validItems: TokenUsageItem[] = [];
    try {
      items = [...this.queue];
      this.queue.length = 0; // 清空队列

      // 过滤掉所有 token 字段都为 0 的记录
      validItems = items.filter((item) => !this.isAllTokensZero(item));
      const filteredCount = items.length - validItems.length;

      if (filteredCount > 0) {
        if (isDebugEnabled()) {
          debugLog(
            `[flushWithTimeout] 过滤掉 ${filteredCount} 条所有 token 字段都为 0 的记录`,
          );
        }
      }

      // 如果没有有效记录，直接返回
      if (validItems.length === 0) {
        if (isDebugEnabled()) {
          debugLog('[flushWithTimeout] 没有有效的 Token 使用记录，跳过上报');
        }
        return;
      }

      const rdmindSsoId = getRdmindSsoId();
      if (!rdmindSsoId) {
        console.warn(
          `[tokenUsageReporter] ⚠️  rdmind_sso_id 不存在，跳过上报（${validItems.length} 条记录已放回队列）`,
        );
        this.queue.unshift(...validItems);
        return;
      }

      debugLog(
        `[tokenUsageReporter] 开始上报 ${validItems.length} 条 Token 使用记录（超时: ${timeoutMs}ms）`,
      );
      // 使用较短的超时时间
      const success = await this.reportToServer(
        rdmindSsoId,
        validItems,
        timeoutMs,
      );
      if (success) {
        this.lastFlushTime = Date.now();
        debugLog(
          `[tokenUsageReporter] ✅ 成功上报 ${validItems.length} 条 Token 使用记录`,
        );
      } else {
        // 上报失败，将有效数据放回队列
        this.queue.unshift(...validItems);
        debugLog(`上报失败，将 ${validItems.length} 条数据放回队列重试`);
      }
    } catch (error) {
      console.error('[tokenUsageReporter] 上报异常:', error);
      // 异常情况下，将有效数据放回队列
      if (validItems.length > 0) {
        this.queue.unshift(...validItems);
      }
    } finally {
      this.isFlushInProgress = false;
    }
  }
}
