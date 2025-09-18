/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rdflowCommand } from './rdflowCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';
import { CommandKind } from './types.js';

describe('rdflowCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    mockContext = createMockCommandContext({
      ui: {
        addItem: vi.fn(),
      },
    } as unknown as CommandContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('命令属性', () => {
    it('应该具有正确的命令属性', () => {
      expect(rdflowCommand.name).toBe('rdflow');
      expect(rdflowCommand.kind).toBe(CommandKind.BUILT_IN);
      expect(rdflowCommand.description).toBe(
        '按照小红书研发工程师的工作习惯和流执行完整的开发工作, 从理解需求->技术方案->代码编写->质量保障, 全面覆盖研发的工作流程',
      );
    });
  });

  describe('空输入处理', () => {
    it('当没有用户输入时应该显示信息消息', async () => {
      if (!rdflowCommand.action) {
        throw new Error('rdflow command has no action');
      }

      const result = await rdflowCommand.action(mockContext, '');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: '我将按照小红书研发工程师的工作习惯和流执行完整的开发工作, 从理解需求->技术方案->代码编写->质量保障, 全面覆盖研发的工作流程',
        },
        expect.any(Number),
      );

      expect(result).toEqual({
        type: 'submit_prompt',
        content: expect.stringContaining('# RDMind - BMAD研发流程编排器'),
      });
    });

    it('当用户输入只有空白字符时应该显示信息消息', async () => {
      if (!rdflowCommand.action) {
        throw new Error('rdflow command has no action');
      }

      const result = await rdflowCommand.action(mockContext, '   \t\n  ');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: '我将按照小红书研发工程师的工作习惯和流执行完整的开发工作, 从理解需求->技术方案->代码编写->质量保障, 全面覆盖研发的工作流程',
        },
        expect.any(Number),
      );

      expect(result).toEqual({
        type: 'submit_prompt',
        content: expect.stringContaining('# RDMind - BMAD研发流程编排器'),
      });
    });
  });

  describe('用户输入处理', () => {
    it('当有用户输入时不应该显示信息消息', async () => {
      if (!rdflowCommand.action) {
        throw new Error('rdflow command has no action');
      }

      await rdflowCommand.action(mockContext, 'some user input');

      expect(mockContext.ui.addItem).not.toHaveBeenCalled();
    });

    it('应该返回包含用户输入的提交提示', async () => {
      if (!rdflowCommand.action) {
        throw new Error('rdflow command has no action');
      }

      const userPrompt = '创建一个用户管理系统';
      const result = await rdflowCommand.action(mockContext, userPrompt);

      expect(result).toEqual({
        type: 'submit_prompt',
        content: expect.stringContaining(userPrompt),
      });
    });
  });

  describe('内容验证', () => {
    it('应该包含核心工作流内容', async () => {
      if (!rdflowCommand.action) {
        throw new Error('rdflow command has no action');
      }

      const result = await rdflowCommand.action(mockContext, 'test prompt');
      if (!result || result.type !== 'submit_prompt') {
        throw new Error('Expected submit_prompt result');
      }
      const content = result.content;

      expect(content).toContain('# RDMind - BMAD研发流程编排器');
      expect(content).toContain('核心工作流');
      expect(content).toContain('阶段1：理解需求');
      expect(content).toContain('阶段2：技术方案');
      expect(content).toContain('阶段5：代码编写');
      expect(content).toContain('阶段6：代码评审');
    });

    it('应该包含工作流指令', async () => {
      if (!rdflowCommand.action) {
        throw new Error('rdflow command has no action');
      }

      const result = await rdflowCommand.action(mockContext, 'test prompt');
      if (!result || result.type !== 'submit_prompt') {
        throw new Error('Expected submit_prompt result');
      }
      const content = result.content;

      expect(content).toContain('严格按照TODO顺序执行');
      expect(content).toContain('每个阶段都要激活对应的BMAD角色');
      expect(content).toContain('必须等待用户明确确认');
      expect(content).toContain('绝对禁止');
    });

    it('应该包含初始化指令', async () => {
      if (!rdflowCommand.action) {
        throw new Error('rdflow command has no action');
      }

      const result = await rdflowCommand.action(mockContext, 'test prompt');
      if (!result || result.type !== 'submit_prompt') {
        throw new Error('Expected submit_prompt result');
      }
      const content = result.content;

      expect(content).toContain('### 初始化');
      expect(content).toContain('你好，我是 **RDMind**');
      expect(content).toContain('八个阶段来完成软件开发');
    });
  });
});
