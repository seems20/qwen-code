/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 小红书 Pallas API 域名配置
 *
 * 变量1：域名
 * 变量2：HTTP 地址（http:// + 域名）
 * 变量3：WebSocket 地址（ws:// + 域名）
 *
 * 修改域名时，只需修改 PALLAS_DOMAIN 即可，其他变量会自动更新
 */

// 变量1：域名
export const PALLAS_DOMAIN =
  process.env['PALLAS_DOMAIN'] ?? 'pallas.devops.xiaohongshu.com';

// 变量2：HTTP 地址
export const PALLAS_HTTP_BASE = `http://${PALLAS_DOMAIN}`;

// 变量3：WebSocket 地址
export const PALLAS_WS_BASE = `ws://${PALLAS_DOMAIN}`;

// RdMind SSO Web 页面固定地址
export const RDMIND_SSO_WEB_URL =
  'http://rdmind.devops.xiaohongshu.com/apps/reddevmind-web/rdmind/sso';
