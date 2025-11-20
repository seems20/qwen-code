/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 小红书 SSO 预设模型配置
 */
export interface XhsSsoModel {
  id: string; // API调用时的模型ID
  displayName: string; // UI显示名称
  apiKey?: string; // 模型对应的 API Key
  baseUrl: string; // 模型对应的 Base URL
  contextWindow?: string; // "32K" / "128K"
  description?: string; // 可选描述
}

/**
 * 小红书 SSO 可用模型列表
 */
export const XHS_SSO_MODELS: XhsSsoModel[] = [
  {
    id: 'kimi-k2-turbo-preview',
    displayName: 'kimi-k2-turbo-preview',
    baseUrl: 'https://runway.devops.xiaohongshu.com/openai/moonshot/v1',
    contextWindow: '256K',
    description: 'kimi k2 的高速版本',
  },
  {
    id: 'qwen3-coder-plus',
    displayName: 'qwen3-coder-plus',
    baseUrl: 'https://runway.devops.xiaohongshu.com/openai/qwen/v1',
    contextWindow: '1M',
    description: '基于Qwen3的代码生成模型',
  },
  {
    id: 'qwen3-coder-480b-a35b-instruct',
    displayName: 'qwen3-coder-480b-a35b-instruct',
    baseUrl: 'https://maas.devops.xiaohongshu.com/v1',
    contextWindow: '256k',
    description: 'QuickSilver平台部署版本',
  },
];
