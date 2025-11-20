/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSocketId } from '../../services/websocketSocketId.js';
import {
  type CommandContext,
  type SlashCommand,
  type SlashCommandActionReturn,
  CommandKind,
} from './types.js';
import { MessageType } from '../types.js';
import { USER_SETTINGS_PATH, saveSettings } from '../../config/settings.js';
import type { Settings } from '../../config/settingsSchema.js';
import stripJsonComments from 'strip-json-comments';
import {
  fetchWithTimeout,
  openBrowserSecurely,
  PALLAS_HTTP_BASE,
  RDMIND_SSO_WEB_URL,
} from '@rdmind/rdmind-core';

const SSO_API_TIMEOUT_MS = 10000; // 10 秒超时

export const ssoCommand: SlashCommand = {
  name: 'sso',
  description: '获取并保存 SSO 请求 ID',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    _args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    try {
      // 显示处理中的消息
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: '正在获取 SSO 请求 ID...',
        },
        Date.now(),
      );

      // 获取服务端下发的 socketId
      const socketId = getSocketId();

      if (!socketId) {
        context.ui.addItem(
          {
            type: MessageType.ERROR,
            text: '❌ 未获取到 WebSocket socketId，请确保 WebSocket 连接已建立',
          },
          Date.now(),
        );
        return;
      }

      // 调用 API 获取 SSO ID
      const apiUrl = `${PALLAS_HTTP_BASE}/pallas/rdmind/cli/rdmind-sso-id?socketId=${encodeURIComponent(socketId)}`;

      let response: Response;
      try {
        response = await fetchWithTimeout(apiUrl, SSO_API_TIMEOUT_MS);
      } catch (fetchError) {
        // 处理网络错误，提供更详细的错误信息
        const errorMessage =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        const errorCode = (fetchError as { code?: string })?.code;

        if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timed out')) {
          throw new Error(
            `请求超时 (${SSO_API_TIMEOUT_MS}ms)，请检查网络连接后重试`,
          );
        }

        if (
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ENOTFOUND')
        ) {
          throw new Error(
            `网络请求失败: ${errorMessage}\n\n请检查：\n1. 网络连接是否正常\n2. URL 是否可访问: ${apiUrl}\n3. 是否需要配置代理\n4. DNS 解析是否正常`,
          );
        }

        // 其他网络错误
        throw new Error(
          `网络请求失败: ${errorMessage}\n\n请检查网络连接和 URL 可访问性: ${apiUrl}`,
        );
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
        // 兼容旧的直接返回格式
        rdmind_sso_id?: string;
        error?: string;
        socket_id?: string;
      };

      // 检查是否是 ResultModel 格式（有 data 字段）或直接返回格式
      let rdmindSsoId: string | undefined;
      let errorMessage: string | undefined;

      if (responseData.data) {
        // ResultModel 格式：从 data 字段中提取
        rdmindSsoId = responseData.data.rdmind_sso_id;
        if (
          !rdmindSsoId &&
          responseData.code !== 0 &&
          responseData.success !== true
        ) {
          errorMessage = responseData.message || '响应中未包含 rdmind_sso_id';
        }
      } else if (responseData.rdmind_sso_id) {
        // 兼容旧的直接返回格式
        rdmindSsoId = responseData.rdmind_sso_id;
      } else if (responseData.error || responseData.message) {
        // 错误情况
        errorMessage = responseData.message || responseData.error;
      }

      // 如果提取失败，显示错误
      if (!rdmindSsoId) {
        const errorMsg = errorMessage || '响应格式错误或未包含 rdmind_sso_id';
        context.ui.addItem(
          {
            type: MessageType.ERROR,
            text: `❌ 获取 SSO ID 失败: ${errorMsg}`,
          },
          Date.now(),
        );
        return;
      }

      // 读取现有的 settings.json
      let originalSettings: Settings = {};
      if (fs.existsSync(USER_SETTINGS_PATH)) {
        try {
          const content = fs.readFileSync(USER_SETTINGS_PATH, 'utf-8');
          const parsed = JSON.parse(stripJsonComments(content)) as Record<
            string,
            unknown
          >;
          originalSettings = (parsed || {}) as Settings;
        } catch (error) {
          console.error('读取 settings.json 失败:', error);
        }
      }

      // 更新 sso 配置（使用 Record 类型以支持任意字段）
      const settingsRecord = originalSettings as Record<string, unknown>;
      const existingSso = settingsRecord['sso'];
      const ssoObject =
        existingSso &&
        typeof existingSso === 'object' &&
        !Array.isArray(existingSso)
          ? (existingSso as Record<string, unknown>)
          : {};

      const updatedSettings: Settings = {
        ...settingsRecord,
        sso: {
          ...ssoObject,
          request_sso_id: rdmindSsoId,
        },
      } as Settings;

      // 确保目录存在
      const settingsDir = path.dirname(USER_SETTINGS_PATH);
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }

      // 保存到 settings.json
      saveSettings({
        path: USER_SETTINGS_PATH,
        settings: updatedSettings,
        originalSettings,
      });

      // 构建绑定 URL
      const bindUrl = `${RDMIND_SSO_WEB_URL}?rdmind_sso_id=${encodeURIComponent(rdmindSsoId)}`;

      // 在浏览器中打开绑定 URL
      try {
        await openBrowserSecurely(bindUrl);
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: `✅ SSO 请求 ID 已保存到配置文件\n\nrequest_sso_id: ${rdmindSsoId}\n\n已在浏览器中打开 SSO 绑定页面`,
          },
          Date.now(),
        );
      } catch (browserError) {
        // 如果打开浏览器失败，仍然显示成功消息，但提示用户手动打开
        const browserErrorMessage =
          browserError instanceof Error
            ? browserError.message
            : String(browserError);
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: `✅ SSO 请求 ID 已保存到配置文件\n\nrequest_sso_id: ${rdmindSsoId}\n\n⚠️ 无法自动打开浏览器，请手动访问以下 URL 完成绑定：\n${bindUrl}`,
          },
          Date.now(),
        );
        console.error('打开浏览器失败:', browserErrorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: `❌ 执行 SSO 命令失败: ${errorMessage}\n\n提示：\n- 请检查网络连接\n- 确认可以访问: ${PALLAS_HTTP_BASE}\n- 如使用代理，请确认代理配置正确\n- 可以尝试手动访问 API URL 测试连接`,
        },
        Date.now(),
      );

      // 在控制台输出更详细的错误信息以便调试
      console.error('SSO 命令执行失败详情:', error);
      if (error instanceof Error && error.stack) {
        console.error('错误堆栈:', error.stack);
      }
    }
  },
};
