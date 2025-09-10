/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importCommand } from './importCommand.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('importCommand', () => {
  const mockContext = createMockCommandContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本配置', () => {
    it('应该有正确的名称和描述', () => {
      expect(importCommand.name).toBe('import');
      expect(importCommand.description).toContain(
        '为工作区的Java项目导入中间件',
      );
      expect(importCommand.kind).toBe(CommandKind.BUILT_IN);
    });

    it('应该有mysql子命令', () => {
      expect(importCommand.subCommands).toBeDefined();
      expect(importCommand.subCommands).toHaveLength(4);
      expect(importCommand.subCommands![0].name).toBe('mysql');
    });
  });

  describe('命令参数解析', () => {
    it('应该在没有项目名时显示错误信息', async () => {
      await importCommand.action!(mockContext, 'mysql');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('请提供项目名称'),
        }),
        expect.any(Number),
      );
    });

    it('应该在错误的参数格式时显示帮助信息', async () => {
      await importCommand.action!(mockContext, '');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('命令格式错误'),
        }),
        expect.any(Number),
      );
    });

    it('应该在不支持的中间件类型时显示错误信息', async () => {
      await importCommand.action!(mockContext, 'kafka');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('不支持的中间件类型：kafka'),
        }),
        expect.any(Number),
      );
    });
  });

  describe('MySQL 导入 (todowrite模式)', () => {
    it('应该显示开始信息并返回AI提示词', async () => {
      const result = await importCommand.action!(
        mockContext,
        'mysql test-project',
      );

      // 检查开始信息
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('RDMind正在接入MySQL'),
        }),
        expect.any(Number),
      );

      // 检查返回值包含AI提示词
      expect(result).toEqual(
        expect.objectContaining({
          type: 'submit_prompt',
          content: expect.stringContaining(
            '请为Java项目 "test-project" 完成 MySQL 接入配置',
          ),
        }),
      );
    });

    it('应该生成包含正确项目名的提示词', async () => {
      const result = await importCommand.action!(mockContext, 'mysql sns-demo');

      expect(result).toEqual(
        expect.objectContaining({
          type: 'submit_prompt',
          content: expect.stringContaining(
            '请为Java项目 "sns-demo" 完成 MySQL 接入配置',
          ),
        }),
      );
    });
  });

  describe('Redis 导入 (todowrite模式)', () => {
    it('应该显示开始信息并返回AI提示词', async () => {
      const result = await importCommand.action!(mockContext, 'redis');

      // 检查开始信息
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('RDMind正在接入Redis'),
        }),
        expect.any(Number),
      );

      // 检查返回值包含AI提示词
      expect(result).toEqual(
        expect.objectContaining({
          type: 'submit_prompt',
          content: expect.stringContaining('请为Java项目完成 Redis 接入配置'),
        }),
      );
    });
  });

  describe('Apollo 导入 (todowrite模式)', () => {
    it('应该在没有appId时显示错误信息', async () => {
      await importCommand.action!(mockContext, 'apollo');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('请提供 AppId 参数'),
        }),
        expect.any(Number),
      );
    });

    it('应该显示开始信息并返回AI提示词', async () => {
      const result = await importCommand.action!(
        mockContext,
        'apollo my-app-id',
      );

      // 检查开始信息
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('RDMind正在接入Apollo'),
        }),
        expect.any(Number),
      );

      // 检查返回值包含AI提示词
      expect(result).toEqual(
        expect.objectContaining({
          type: 'submit_prompt',
          content: expect.stringContaining(
            '请为Java项目完成 Apollo 接入配置，AppId："my-app-id"',
          ),
        }),
      );
    });
  });

  describe('RocketMQ 导入 (todowrite模式)', () => {
    it('应该显示开始信息并返回AI提示词', async () => {
      const result = await importCommand.action!(mockContext, 'rocketmq');

      // 检查开始信息
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('RDMind正在接入RocketMQ'),
        }),
        expect.any(Number),
      );

      // 检查返回值包含AI提示词
      expect(result).toEqual(
        expect.objectContaining({
          type: 'submit_prompt',
          content: expect.stringContaining(
            '请为Java项目完成 RocketMQ 接入配置',
          ),
        }),
      );
    });
  });
});
