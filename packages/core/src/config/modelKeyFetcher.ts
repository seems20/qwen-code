/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { fetchWithTimeout } from '../utils/fetch.js';
import { createDebugLogger } from '../utils/debugLogger.js';

const logger = createDebugLogger('MODEL_KEY_FETCHER');

/**
 * API 基础 URL
 */
const MODEL_KEY_API_BASE =
  'https://athena-next.devops.xiaohongshu.com/api/media/model/key';

/**
 * API 响应格式
 */
interface ModelKeyResponse {
  success: boolean;
  msg: string;
  data: {
    api_key: string;
  };
  code: number;
}

/**
 * 从 API 获取模型的 API Key
 * @param modelName 模型名称
 * @returns API Key
 * @throws Error 如果获取失败
 */
export async function fetchModelKey(modelName: string): Promise<string> {
  logger.debug(`从 API 获取 key for ${modelName}`);

  try {
    // 如果是 gemini 开头的模型，需要先做预处理，去除思考等级后缀
    // 例如 gemini-3-pro-preview(low) -> gemini-3-pro-preview
    // 或 gemini-3-flash-preview(high) -> gemini-3-flash-preview
    let processedModelName = modelName;
    if (modelName.toLowerCase().startsWith('gemini')) {
      // 匹配并去除括号内的思考等级后缀，例如 (low)、(high) 等
      const match = modelName.match(/^(.+?)\(\w+\)$/);
      if (match) {
        processedModelName = match[1];
        logger.debug(
          `gemini 模型预处理: ${modelName} -> ${processedModelName}`,
        );
      }
    }

    const url = `${MODEL_KEY_API_BASE}?model_name=${encodeURIComponent(processedModelName)}`;
    const response = await fetchWithTimeout(url, 10000); // 10秒超时

    if (!response.ok) {
      throw new Error(
        `获取模型 key 失败: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as ModelKeyResponse;

    // 验证响应格式
    if (!data.success || data.code !== 0) {
      throw new Error(`API 返回错误: ${data.msg || '未知错误'}`);
    }

    if (!data.data?.api_key) {
      throw new Error(
        `API 响应中未找到 api_key: ${JSON.stringify(data).substring(0, 200)}`,
      );
    }

    const apiKey = data.data.api_key;

    logger.debug(
      `成功获取 key for ${modelName}: ${apiKey.substring(0, 8)}...`,
    );

    return apiKey;
  } catch (error) {
    logger.error(
      `获取 key 失败 for ${modelName}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw new Error(
      `无法获取模型 ${modelName} 的 API Key: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
