/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { RedocFetchTool } from './redoc-fetch.js';
import { type Config } from '@qwen-code/qwen-code-core';

describe('RedocFetchTool', () => {
  const mockConfig = {
    getApprovalMode: vi.fn(),
    setApprovalMode: vi.fn(),
    getGeminiClient: vi.fn(() => ({
      generateContent: vi.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ text: 'AI 分析结果' }],
            },
          },
        ],
      }),
    })),
  } as unknown as Config;

  describe('基本功能', () => {
    it('应该有正确的工具属性', () => {
      const tool = new RedocFetchTool(mockConfig);
      expect(tool.name).toBe('redoc_fetch');
      expect(tool.displayName).toBe('RedocFetch');
      expect(tool.description).toContain('从小红书 Redoc 文档获取内容');
    });

    it('应该正确验证 URL 格式', () => {
      const tool = new RedocFetchTool(mockConfig);
      // 测试无效 URL
      const invalidResult = tool['validateToolParamValues']({
        url: 'https://example.com/doc/123',
        prompt: 'test',
      });
      expect(invalidResult).toContain('必须是有效的 Redoc URL');

      // 测试有效 URL
      const validResult = tool['validateToolParamValues']({
        url: 'https://docs.xiaohongshu.com/doc/fefc99fb9aaa0bf065432cf88cd42431',
        prompt: 'test',
      });
      expect(validResult).toBe(null);
    });
  });

  // 注意：这个工具依赖外部 API，真正的功能测试需要：
  // 1. 真实的 API 调用（集成测试）
  // 2. 有效的文档 ID
  // 3. 网络连接
  // 建议的测试方式：
  // - 在开发环境中手动测试真实的 URL
  // - 使用 Postman/Apifox 验证 API 响应格式
  // - 在 CI/CD 中使用真实的测试文档进行端到端测试
});
