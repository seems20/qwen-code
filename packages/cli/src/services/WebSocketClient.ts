/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import WebSocket from 'ws';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { setSocketId } from './websocketSocketId.js';
import { ssoAuthEvents, saveSSOCredentials } from '@rdmind/rdmind-core';
import { syncPlugins, setDebugMode } from '../core/pluginSync.js';

export interface WebSocketClientOptions {
  url: string;
  retryMaxAttempts: number; // 0 = infinite
  retryBaseDelayMs: number; // base for exponential backoff
  heartbeatIntervalMs: number; // how often to send ping
  heartbeatTimeoutMs: number; // how long to wait for pong
  debug: boolean;
  // Optional initial registration payload to send after open
  // e.g. { type: 'auth', deviceId, deviceName, deviceType }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registrationPayload?: Record<string, any>;
  // Optional callback when reload_commands message is received
  onReloadCommands?: () => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
  private pluginSyncTimer: NodeJS.Timeout | null = null; // 插件同步定时器
  private closedByUser = false;
  private socketId: string | null = null; // 服务端下发的 socketId

  constructor(private readonly options: WebSocketClientOptions) {}

  /**
   * 获取服务端下发的 socketId
   */
  getSocketId(): string | null {
    return this.socketId;
  }

  start() {
    this.closedByUser = false;
    this.connect();
  }

  stop() {
    this.closedByUser = true;
    this.clearReconnectTimer();
    this.clearHeartbeatTimers();
    this.stopPluginSync(); // 停止插件同步定时器
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      try {
        this.ws.close(1000, 'client shutdown');
      } catch {
        // ignore
      }
    }
    this.ws = null;
  }

  private connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const { url } = this.options;
    try {
      if (this.options.debug) {
        console.debug(`[ws] connecting to ${url}`);
      }
      this.ws = new WebSocket(url);
    } catch (err) {
      console.warn('[ws] failed to initiate connection:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('error', (err) => this.onError(err));
    this.ws.on('close', (code, reason) => this.onClose(code, reason));
  }

  private onOpen() {
    this.reconnectAttempts = 0;
    if (this.options.debug) {
      console.debug('[ws] connected');
    } else {
      console.info('[ws] connected');
    }

    // Send optional registration payload
    if (this.ws && this.options.registrationPayload) {
      this.sendAuth(this.options.registrationPayload);
    }
    this.startHeartbeat();
    this.startPluginSync(); // 启动插件同步定时器
  }

  /**
   * 启动插件同步定时器
   */
  private startPluginSync() {
    this.stopPluginSync(); // 先清理可能存在的定时器

    // 每1秒执行一次插件同步
    this.pluginSyncTimer = setInterval(() => {
      this.performPluginSync();
    }, 3000);
  }

  /**
   * 停止插件同步定时器
   */
  private stopPluginSync() {
    if (this.pluginSyncTimer) {
      clearInterval(this.pluginSyncTimer);
      this.pluginSyncTimer = null;
    }
  }

  /**
   * 执行插件同步
   */
  private async performPluginSync() {
    // 检查是否满足插件同步的条件
    const ssoLoggedIn = this.isSSOLoggedIn();

    if (ssoLoggedIn) {
      if (this.options.debug) {
        console.debug('[ws] 执行插件同步');
        console.debug('[ws]   - SSO登录状态:', ssoLoggedIn);
      }

      // WebSocket连接成功后调用插件同步
      if (this.options.debug) {
        setDebugMode(true);
      }
      syncPlugins().catch((error) => {
        console.error('插件同步失败:', error);
      });
    } else if (this.options.debug) {
      console.debug('[ws] 插件同步条件尚未满足');
      console.debug('[ws]   - SSO登录状态:', ssoLoggedIn);
    }
  }

  private onClose(code: number, reason: Buffer) {
    if (this.options.debug) {
      console.debug(
        `[ws] closed code=${code} reason=${reason.toString('utf8')}`,
      );
    }
    this.clearHeartbeatTimers();
    this.stopPluginSync(); // 停止插件同步定时器
    this.socketId = null; // 清除 socketId
    setSocketId(null); // 清除全局 socketId
    this.ws = null;

    if (!this.closedByUser) {
      this.scheduleReconnect();
    }
  }

  /**
   * 检查SSO凭证文件是否存在
   */
  private isSSOLoggedIn(): boolean {
    try {
      const credsPath = path.join(
        os.homedir(),
        '.rdmind',
        'xhs_sso_creds.json',
      );
      return fs.existsSync(credsPath);
    } catch (err) {
      if (this.options.debug) {
        console.debug('[ws] 检查SSO登录状态时出错:', err);
      }
      return false;
    }
  }

  /**
   * 发送 auth 请求
   * @param basePayload 基础 payload，可以包含 deviceId、deviceName、deviceType 等
   * @param rdmindSsoId 可选的 rdmind_sso_id，如果提供则使用该值，否则从 basePayload 中获取
   */
  private sendAuth(
    basePayload?: Record<string, unknown>,
    rdmindSsoId?: string,
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[ws] ⚠️ WebSocket 未连接，无法发送 auth 请求');
      return;
    }

    try {
      // 使用 basePayload 或者 options.registrationPayload 作为基础
      const payload = basePayload
        ? { ...basePayload }
        : this.options.registrationPayload
          ? { ...this.options.registrationPayload }
          : {};

      // 确保 type 是 auth
      payload['type'] = 'auth';

      // 如果提供了 rdmindSsoId，使用它；否则保持原有的值
      if (rdmindSsoId !== undefined) {
        payload['rdmind_sso_id'] = rdmindSsoId;
      }

      const messageStr = JSON.stringify(payload);
      console.log(`[ws-send:auth] ${messageStr}`);
      this.ws.send(messageStr);
    } catch (err) {
      console.error('[ws] ❌ 发送 auth 请求失败:', err);
      if (this.options.debug && err instanceof Error) {
        console.error('[ws] 错误详情:', err.message);
      }
    }
  }

  private onMessage(data: WebSocket.RawData) {
    const text = this.rawDataToString(data);

    // Try JSON protocol { type, message, filename, path, content, title, meta }
    try {
      const payload = JSON.parse(text) as
        | {
            type?: string;
            message?: string;
            filename?: string;
            path?: string;
            content?: string;
            title?: string;
            rdmind_sso_id?: string;
            sso_name?: string;
            socketId?: string;
          }
        | unknown;
      if (payload && typeof payload === 'object') {
        const p = payload as {
          type?: string;
          message?: string;
          filename?: string;
          path?: string;
          content?: string;
          title?: string;
          rdmind_sso_id?: string;
          sso_name?: string;
          socketId?: string;
        };
        const type = (p.type || 'info').toLowerCase();

        // 只在 debug 模式或非心跳消息时输出日志
        if (
          this.options.debug ||
          (type !== 'client_heart_pong' && type !== 'server_heart_ping')
        ) {
          console.log(`[ws-receive:${type}] ${text}`);
        }

        // Handle connection_established (连接建立，接收服务端下发的 socketId)
        if (type === 'connection_established') {
          if (p.socketId) {
            this.socketId = p.socketId;
            setSocketId(p.socketId); // 更新全局 socketId
          }
          return;
        }

        // Handle client_heart_pong (客户端心跳的响应)
        if (type === 'client_heart_pong') {
          this.disarmHeartbeatTimeout();
          return;
        }

        // Handle server_heart_ping (服务端心跳请求)
        if (type === 'server_heart_ping') {
          try {
            const serverHeartPong = JSON.stringify({
              type: 'server_heart_pong',
            });
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              console.log(`[ws-send:server_heart_pong] ${serverHeartPong}`);
              this.ws.send(serverHeartPong);
            }
          } catch (err) {
            if (this.options.debug) {
              console.debug('[ws] failed to send server_heart_pong:', err);
            }
          }
          return;
        }

        // Handle SSO bind success
        if (type === 'sso_bind_success') {
          if (p.rdmind_sso_id && p.sso_name) {
            // 发出事件给自动认证流程
            ssoAuthEvents.emit('sso_bind_success', {
              type: 'sso_bind_success',
              rdmind_sso_id: p.rdmind_sso_id,
              sso_name: p.sso_name,
              message: p.message,
            });

            // 保存到 settings.json（原有逻辑）
            this.handleSsoBindSuccess(p.rdmind_sso_id, p.sso_name, p.message);
          } else {
            console.warn(
              '[ws] ⚠️ SSO 绑定消息缺少必要字段:',
              JSON.stringify(p, null, 2),
            );
          }
          return;
        }

        // Handle create_file type
        if (type === 'create_file' && p.filename) {
          this.handleCreateFile(p.filename, p.content, p.path);
          // Trigger reload after creating file
          if (this.options.onReloadCommands) {
            this.options.onReloadCommands();
          }
          return;
        }

        // Handle delete_file type
        if (type === 'delete_file' && p.filename) {
          this.handleDeleteFile(p.filename, p.path);
          // Trigger reload after deleting file
          if (this.options.onReloadCommands) {
            this.options.onReloadCommands();
          }
          return;
        }

        // Handle other message types (日志已在上面统一打印，这里不需要重复打印)
        if ('message' in p) {
          // 消息已通过统一的 [ws-receive:${type}] 格式打印
          return;
        }
      }
    } catch {
      // Not JSON; fall through and log raw text as unknown type
      console.log(`[ws-receive:unknown] ${text}`);
    }
  }

  private async handleSsoBindSuccess(
    rdmindSsoId: string,
    ssoName: string,
    message?: string,
  ) {
    if (this.options.debug) {
      console.debug('[ws] 🔄 开始处理 SSO 绑定成功消息...');
    }

    try {
      // 显示绑定成功消息（这个总是显示，因为是用户反馈）
      if (message) {
        console.log(`\n✅ ${message}\n`);
      } else {
        console.log(`\n✅ SSO 绑定成功！欢迎 ${ssoName}\n`);
      }

      // 保存到独立文件 ~/.rdmind/xhs_sso_creds.json
      if (this.options.debug) {
        console.debug('[ws] 💾 保存 SSO 凭证到独立文件...');
      }
      await saveSSOCredentials(
        {
          rdmind_sso_id: rdmindSsoId,
          sso_name: ssoName,
        },
        this.options.debug,
      );

      // 更新 registrationPayload，确保后续重连携带最新的 SSO 凭证
      this.options.registrationPayload = {
        ...(this.options.registrationPayload ?? {}),
        rdmind_sso_id: rdmindSsoId,
      };

      if (this.options.debug) {
        console.debug(`[ws] ✅ SSO 凭证已成功保存到独立文件`);
        console.debug(`    🆔 rdmind_sso_id: ${rdmindSsoId}`);
        console.debug(`    👤 sso_name: ${ssoName}\n`);
      }

      // 保存完成后，重新发起 auth 请求，携带新的 rdmind_sso_id
      if (this.options.debug) {
        console.debug('[ws] 🔄 重新发送 auth 请求，携带新的 rdmind_sso_id...');
      }
      this.sendAuth(this.options.registrationPayload, rdmindSsoId);
    } catch (err) {
      console.error('[ws] ❌ 处理 SSO 绑定成功消息失败:', err);
      if (err instanceof Error && err.stack && this.options.debug) {
        console.error('[ws] 错误堆栈:', err.stack);
      }
    }
  }

  private handleCreateFile(
    filename: string,
    content?: string,
    subPath?: string,
  ) {
    // Create file in ~/.rdmind/ (or ~/.rdmind/<subPath> if provided)
    const rdmindDir = path.join(os.homedir(), '.rdmind');
    const targetDir = subPath ? path.join(rdmindDir, subPath) : rdmindDir;
    const filePath = path.join(targetDir, filename);

    try {
      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Write content to file (or empty string if no content provided)
      const fileContent = content || '';
      fs.writeFileSync(filePath, fileContent, { flag: 'w' });
      console.log(`[ws] created file: ${filePath}`);
    } catch (err) {
      console.error(`[ws] failed to create file ${filePath}:`, err);
    }
  }

  private handleDeleteFile(filename: string, subPath?: string) {
    // Delete file in ~/.rdmind/ (or ~/.rdmind/<subPath> if provided)
    const rdmindDir = path.join(os.homedir(), '.rdmind');
    const targetDir = subPath ? path.join(rdmindDir, subPath) : rdmindDir;
    const filePath = path.join(targetDir, filename);

    try {
      // Check if file exists before attempting to delete
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[ws] deleted file: ${filePath}`);
      } else {
        console.log(`[ws] file not found, skipping delete: ${filePath}`);
      }
    } catch (err) {
      console.error(`[ws] failed to delete file ${filePath}:`, err);
    }
  }

  private onError(err: unknown) {
    if (this.options.debug) {
      console.error('[ws] error:', err);
    } else {
      console.warn('[ws] error');
    }
  }

  private scheduleReconnect() {
    if (this.closedByUser) return;
    this.clearReconnectTimer();

    const { retryMaxAttempts, retryBaseDelayMs } = this.options;
    if (retryMaxAttempts > 0 && this.reconnectAttempts >= retryMaxAttempts) {
      console.warn('[ws] reached max reconnect attempts; giving up');
      return;
    }
    const attempt = this.reconnectAttempts++;
    const delay = Math.min(30_000, retryBaseDelayMs * Math.pow(2, attempt));
    if (this.options.debug) {
      console.debug(`[ws] reconnecting in ${delay}ms (attempt ${attempt + 1})`);
    }
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.clearHeartbeatTimers();
    if (!this.ws) return;

    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try {
        const heartbeatMsg = JSON.stringify({ type: 'client_heart_ping' });
        console.log(`[ws-send:client_heart_ping] ${heartbeatMsg}`);
        this.ws.send(heartbeatMsg);
        this.armHeartbeatTimeout();
      } catch (err) {
        if (this.options.debug) {
          console.debug('[ws] heartbeat failed:', err);
        }
      }
    }, this.options.heartbeatIntervalMs);
  }

  private armHeartbeatTimeout() {
    this.disarmHeartbeatTimeout();
    this.heartbeatTimeoutTimer = setTimeout(() => {
      if (this.options.debug) {
        console.debug('[ws] heartbeat timeout; terminating connection');
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.terminate();
        } catch {
          // ignore
        }
      }
    }, this.options.heartbeatTimeoutMs);
  }

  private disarmHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private clearHeartbeatTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.disarmHeartbeatTimeout();
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private rawDataToString(data: WebSocket.RawData): string {
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf8');
    if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
    return String(data);
  }
}
