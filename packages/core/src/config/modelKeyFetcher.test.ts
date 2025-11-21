/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchModelKey } from './modelKeyFetcher.js';

// Mock fetchWithTimeout
vi.mock('../utils/fetch.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '../utils/fetch.js';

describe('modelKeyFetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchModelKey', () => {
    it('should fetch and return API key successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          msg: '成功',
          data: {
            api_key: 'test-api-key-123',
          },
          code: 0,
        }),
      };
      vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse as Response);

      const key = await fetchModelKey('qwen3-coder-plus', false);

      expect(key).toBe('test-api-key-123');
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://athena-next.devops.xiaohongshu.com/api/media/model/key?model_name=qwen3-coder-plus',
        10000,
      );
    });

    it('should throw error when API returns non-ok status', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
      vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse as Response);

      await expect(fetchModelKey('invalid-model', false)).rejects.toThrow(
        '获取模型 key 失败: 404 Not Found',
      );
    });

    it('should throw error when success is false', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: false,
          msg: '模型不存在',
          data: null,
          code: -1,
        }),
      };
      vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse as Response);

      await expect(fetchModelKey('qwen3-coder-plus', false)).rejects.toThrow(
        'API 返回错误: 模型不存在',
      );
    });

    it('should throw error when code is not 0', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: false,
          msg: '参数错误',
          data: null,
          code: 400,
        }),
      };
      vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse as Response);

      await expect(fetchModelKey('qwen3-coder-plus', false)).rejects.toThrow(
        'API 返回错误: 参数错误',
      );
    });

    it('should throw error when api_key is not found in response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          msg: '成功',
          data: {},
          code: 0,
        }),
      };
      vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse as Response);

      await expect(fetchModelKey('qwen3-coder-plus', false)).rejects.toThrow(
        'API 响应中未找到 api_key',
      );
    });

    it('should throw error when network fails', async () => {
      vi.mocked(fetchWithTimeout).mockRejectedValue(new Error('Network error'));

      await expect(fetchModelKey('qwen3-coder-plus', false)).rejects.toThrow(
        '无法获取模型 qwen3-coder-plus 的 API Key: Network error',
      );
    });

    it('should handle special characters in model name', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          msg: '成功',
          data: {
            api_key: 'special-key-789',
          },
          code: 0,
        }),
      };
      vi.mocked(fetchWithTimeout).mockResolvedValue(mockResponse as Response);

      const key = await fetchModelKey('model/name with spaces', false);

      expect(key).toBe('special-key-789');
      expect(fetchWithTimeout).toHaveBeenCalledWith(
        'https://athena-next.devops.xiaohongshu.com/api/media/model/key?model_name=model%2Fname%20with%20spaces',
        10000,
      );
    });
  });
});
