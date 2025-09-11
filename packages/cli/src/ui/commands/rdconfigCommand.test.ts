/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rdconfigCommand } from './rdconfigCommand.js';
import { type CommandContext } from './types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';
import { CommandKind } from './types.js';

describe('rdconfigCommand', () => {
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
      expect(rdconfigCommand.name).toBe('rdconfig');
      expect(rdconfigCommand.kind).toBe(CommandKind.BUILT_IN);
      expect(rdconfigCommand.description).toBe(
        '按照小红书工程师的开发环境配置本地工作环境, 包括开发工具、开发语言、开发框架、开发库等',
      );
    });
  });

  describe('信息消息显示', () => {
    it('应该始终显示信息消息，无论是否有用户输入', async () => {
      if (!rdconfigCommand.action) {
        throw new Error('rdconfig command has no action');
      }

      const result = await rdconfigCommand.action(mockContext, '');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: "我将按照小红书规范, 为你配置开发环境, 包括开发工具、开发语言、开发框架、开发库等",
        },
        expect.any(Number),
      );

      expect(result).toEqual({
        type: 'submit_prompt',
        content: expect.stringContaining(
          '# 角色：RDMind - 小红书开发环境配置专家',
        ),
      });
    });

    it('应该显示包含用户需求的信息消息', async () => {
      if (!rdconfigCommand.action) {
        throw new Error('rdconfig command has no action');
      }

      const userPrompt = '配置Java开发环境';
      const result = await rdconfigCommand.action(mockContext, userPrompt);

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: `你的需求是:'${userPrompt}'`,
        },
        expect.any(Number),
      );

      expect(result).toEqual({
        type: 'submit_prompt',
        content: expect.stringContaining(
          '# 角色：RDMind - 小红书开发环境配置专家',
        ),
      });
    });
  });

  describe('内容验证', () => {
    it('应该包含核心工作流内容', async () => {
      if (!rdconfigCommand.action) {
        throw new Error('rdconfig command has no action');
      }

      const result = await rdconfigCommand.action(mockContext, 'test prompt');
      if (!result || result.type !== 'submit_prompt') {
        throw new Error('Expected submit_prompt result');
      }
      const content = result.content;

      expect(content).toContain('# 角色：RDMind - 小红书开发环境配置专家');
      expect(content).toContain('核心工作流');
      expect(content).toContain('环境检测');
      expect(content).toContain('基础工具安装');
      expect(content).toContain('语言环境安装');
      expect(content).toContain('开发环境配置');
      expect(content).toContain('验证测试');
    });

    it('应该包含标准开发环境规范', async () => {
      if (!rdconfigCommand.action) {
        throw new Error('rdconfig command has no action');
      }

      const result = await rdconfigCommand.action(mockContext, 'test prompt');
      if (!result || result.type !== 'submit_prompt') {
        throw new Error('Expected submit_prompt result');
      }
      const content = result.content;

      expect(content).toContain('# 小红书工程师标准开发环境');
      expect(content).toContain('后端开发基础工具');
      expect(content).toContain('后端开发语言环境');
      expect(content).toContain('HomeBrew');
      expect(content).toContain('Jetbrains IDEA');
      expect(content).toContain('Maven');
      expect(content).toContain('Java');
      expect(content).toContain('Docker');
    });

    it('应该包含检测和安装命令', async () => {
      if (!rdconfigCommand.action) {
        throw new Error('rdconfig command has no action');
      }

      const result = await rdconfigCommand.action(mockContext, 'test prompt');
      if (!result || result.type !== 'submit_prompt') {
        throw new Error('Expected submit_prompt result');
      }
      const content = result.content;

      expect(content).toContain('java -version');
      expect(content).toContain('mvn -v');
      expect(content).toContain('git --version');
      expect(content).toContain('docker --version');
      expect(content).toContain('go version');
      expect(content).toContain('brew --version');
    });

    it('应该包含用户诉求', async () => {
      if (!rdconfigCommand.action) {
        throw new Error('rdconfig command has no action');
      }

      const userPrompt = '配置Maven和Docker环境';
      const result = await rdconfigCommand.action(mockContext, userPrompt);
      if (!result || result.type !== 'submit_prompt') {
        throw new Error('Expected submit_prompt result');
      }
      const content = result.content;

      expect(content).toContain(`# 用户诉求\n\`${userPrompt}\``);
    });
  });

  describe('复杂输入处理', () => {
    it('应该正确处理复杂的用户输入', async () => {
      if (!rdconfigCommand.action) {
        throw new Error('rdconfig command has no action');
      }

      const complexPrompt =
        '配置完整的Java + Spring Boot + Docker + Redis开发环境，包括IDE插件和代码规范';
      const result = await rdconfigCommand.action(mockContext, complexPrompt);

      expect(result).toEqual({
        type: 'submit_prompt',
        content: expect.stringContaining(complexPrompt),
      });
    });
  });
});
