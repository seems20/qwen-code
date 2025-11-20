/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 小红书 SSO 认证相关类型定义
 */

/**
 * SSO 凭证结构
 */
export interface SSOCredentials {
  /** 真正用于认证的 SSO ID（从 WebSocket sso_bind_success 消息获取） */
  rdmind_sso_id: string;
  /** SSO 用户名 */
  sso_name: string;
  /** 请求阶段的 SSO ID（从 API 获取，用于浏览器绑定） */
  request_sso_id?: string;
}

/**
 * SSO 认证结果
 */
export interface SSOAuthResult {
  /** 是否成功 */
  success: boolean;
  /** 如果成功，包含 SSO 凭证 */
  credentials?: SSOCredentials;
  /** 如果成功，包含 API Key */
  apiKey?: string;
  /** 错误信息 */
  error?: string;
  /** 是否超时 */
  timeout?: boolean;
}

/**
 * SSO 认证配置
 */
export interface SSOAuthConfig {
  /** WebSocket socketId */
  socketId: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** Debug 模式 */
  debug?: boolean;
  /** API 请求超时（毫秒） */
  apiTimeout?: number;
}

/**
 * Request SSO ID API 响应格式
 */
export interface RequestSSOIdResponse {
  code?: number;
  message?: string;
  success?: boolean;
  data?: {
    rdmind_sso_id?: string;
    socket_id?: string;
  };
  // 兼容旧格式
  rdmind_sso_id?: string;
  error?: string;
}

/**
 * WebSocket SSO 绑定成功消息
 */
export interface SSOBindSuccessMessage {
  type: 'sso_bind_success';
  rdmind_sso_id: string;
  sso_name: string;
  message?: string;
}
