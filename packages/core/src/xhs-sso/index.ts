/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 小红书 SSO 认证模块
 */

export * from './xhsSSOTypes.js';
export * from './xhsSSOAuth.js';
export * from './xhsSSOStorage.js';
export * from './xhsSSOTrigger.js';

// 导出新的函数名（向后兼容）
export { saveSSOCredentialsAndAuthType as saveSSOCredentialsAndModelConfig } from './xhsSSOAuth.js';
