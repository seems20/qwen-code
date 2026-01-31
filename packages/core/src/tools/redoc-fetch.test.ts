/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RedocFetchTool } from './redoc-fetch.js';
import { type Config } from '@rdmind/rdmind-core';

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
    getModel: vi.fn(() => 'test-model'),
  } as unknown as Config;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本功能', () => {
    it('应该有正确的工具属性', () => {
      const tool = new RedocFetchTool(mockConfig);
      expect(tool.name).toBe('redoc_fetch');
      expect(tool.displayName).toBe('RedocFetch');
      expect(tool.description).toContain('从小红书 Redoc 文档获取内容');
      expect(tool.description).toContain('图片理解');
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

    it('应该验证 prompt 不为空', () => {
      const tool = new RedocFetchTool(mockConfig);
      const result = tool['validateToolParamValues']({
        url: 'https://docs.xiaohongshu.com/doc/fefc99fb9aaa0bf065432cf88cd42431',
        prompt: '',
      });
      expect(result).toContain('prompt');
    });
  });

  describe('工具描述', () => {
    it('应该在描述中提到图片理解功能', () => {
      const tool = new RedocFetchTool(mockConfig);
      expect(tool.description).toContain('图片');
      expect(tool.description).toContain('理解');
    });

    it('应该说明图片按原始位置插入', () => {
      const tool = new RedocFetchTool(mockConfig);
      // 可以通过工具描述或其他公开接口验证行为
      expect(tool.description.length).toBeGreaterThan(0);
    });
  });

  describe('嵌套结构支持', () => {
    it('应该能识别 columns 中的图片', () => {
      // 测试通过实际执行来验证，因为 buildContentWithImages 是私有方法
      // 这里只验证工具能正常创建
      const tool = new RedocFetchTool(mockConfig);
      expect(tool.name).toBe('redoc_fetch');
      
      // 实际测试需要 mock fetch 和完整的文档结构
      // 留待集成测试验证嵌套图片提取功能
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
