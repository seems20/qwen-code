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
    id: 'gemini-3.1-pro-preview(low)',
    displayName: 'gemini-3.1-pro-preview(low)',
    baseUrl: 'https://runway.devops.rednote.life/openai/google/v1',
    contextWindow: '1M',
    description: '3 Pro 系列在性能、行为和智能方面的下一代改进版本 (推理强度低)',
  },
  {
    id: 'gemini-3.1-pro-preview(high)',
    displayName: 'gemini-3.1-pro-preview(high)',
    baseUrl: 'https://runway.devops.rednote.life/openai/google/v1',
    contextWindow: '1M',
    description: '3 Pro 系列在性能、行为和智能方面的下一代改进版本 (推理强度高)',
  },
  {
    id: 'gemini-3-flash-preview(low)',
    displayName: 'gemini-3-flash-preview(low)',
    baseUrl: 'https://runway.devops.rednote.life/openai/google/v1',
    contextWindow: '1M',
    description: 'Google 高速智能模型 (推理强度低)',
  },
  {
    id: 'gemini-3-flash-preview(high)',
    displayName: 'gemini-3-flash-preview(high)',
    baseUrl: 'https://runway.devops.rednote.life/openai/google/v1',
    contextWindow: '1M',
    description: 'Google 高速智能模型 (推理强度高)',
  },
  {
    id: 'glm-5',
    displayName: 'glm-5',
    baseUrl: 'https://runway.devops.xiaohongshu.com/openai/zhipu/paas/v4/',
    contextWindow: '200K',
    description:
      '智谱新一代的旗舰基座模型，面向 Agentic Engineering 打造，对齐 Claude Opus 4.5',
  },
  {
    id: 'kimi-k2.5',
    displayName: 'kimi-k2.5',
    baseUrl: 'https://runway.devops.xiaohongshu.com/openai/moonshot/v1',
    contextWindow: '256K',
    description:
      '在 Agent、代码、视觉理解及一系列通用智能任务上取得开源 SoTA 表现',
  },
  {
    id: 'gpt-5.3-codex(medium)',
    displayName: 'gpt-5.3-codex(medium)',
    baseUrl:
      'https://runway.devops.rednote.life/openai/v1/responses?api-version=v1',
    contextWindow: '272K',
    description: 'OpenAI 迄今为止最强大的代理式编码模型 (推理强度中)',
  },
  {
    id: 'gpt-5.3-codex(high)',
    displayName: 'gpt-5.3-codex(high)',
    baseUrl:
      'https://runway.devops.rednote.life/openai/v1/responses?api-version=v1',
    contextWindow: '272K',
    description: 'OpenAI 迄今为止最强大的代理式编码模型 (推理强度高)',
  },
  {
    id: 'claude-opus-4-5@20251101',
    displayName: 'Claude Opus 4.5',
    baseUrl: 'https://runway.devops.rednote.life/openai/google/anthropic/v1',
    contextWindow: '200K',
    description: 'Anthropic 最强大的模型，擅长复杂推理和代码生成',
  },
  {
    id: 'Kimi-K2.5',
    displayName: 'Kimi-K2.5',
    baseUrl: 'https://maas.devops.xiaohongshu.com/snsexperienceai-kimi25-service/v1',
    contextWindow: '256k',
    description: 'QuickSilver 平台部署版本',
  },
];
