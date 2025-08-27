/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { importCommand } from './importCommand.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

// Mock fs module
vi.mock('fs/promises');

describe('importCommand', () => {
  const mockContext = createMockCommandContext();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本配置', () => {
    it('应该有正确的名称和描述', () => {
      expect(importCommand.name).toBe('import');
      expect(importCommand.description).toContain('为当前工作区的Java项目规范导入中间件');
      expect(importCommand.kind).toBe(CommandKind.BUILT_IN);
    });

    it('应该有mysql子命令', () => {
      expect(importCommand.subCommands).toBeDefined();
      expect(importCommand.subCommands).toHaveLength(1);
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
      await importCommand.action!(mockContext, 'redis');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('不支持的中间件类型：redis'),
        }),
        expect.any(Number),
      );
    });
  });

  describe('MySQL依赖检查', () => {
    it('应该检测到缺少infra-root-pom时显示错误', async () => {
      const mockPomContent = `
        <project>
          <dependencies>
            <dependency>
              <groupId>other</groupId>
              <artifactId>other-artifact</artifactId>
            </dependency>
          </dependencies>
        </project>
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockPomContent);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      await importCommand.action!(mockContext, 'mysql test-project');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('未检测到 infra-root-pom 依赖'),
        }),
        expect.any(Number),
      );
    });

    it('应该检测到已存在的redsql依赖并继续生成配置', async () => {
      const mockPomContent = `
        <project>
          <dependencies>
            <dependency>
              <groupId>com.xiaohongshu</groupId>
              <artifactId>infra-root-pom</artifactId>
            </dependency>
            <dependency>
              <groupId>com.xiaohongshu.redsql</groupId>
              <artifactId>redsql-spring-boot-starter</artifactId>
            </dependency>
          </dependencies>
        </project>
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockPomContent);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await importCommand.action!(mockContext, 'mysql test-project');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('✅ 检测到 infra-root-pom 依赖已存在'),
        }),
        expect.any(Number),
      );

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('✅ MySQL 依赖已存在，跳过依赖添加步骤'),
        }),
        expect.any(Number),
      );

      // 应该返回完整的MySQL接入配置提示词
      expect(result).toEqual(
        expect.objectContaining({
          type: 'submit_prompt',
          content: expect.stringContaining('请为项目 "test-project" 完成 MySQL 接入配置'),
        })
      );
    });

    it('应该在pom.xml不存在时显示错误', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await importCommand.action!(mockContext, 'mysql test-project');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining('未找到 pom.xml 文件'),
        }),
        expect.any(Number),
      );
    });

    it('应该成功生成MySQL完整接入配置的AI提示词', async () => {
      const mockPomContent = `
        <project>
          <dependencies>
            <dependency>
              <groupId>com.xiaohongshu</groupId>
              <artifactId>infra-root-pom</artifactId>
            </dependency>
          </dependencies>
        </project>
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockPomContent);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await importCommand.action!(mockContext, 'mysql test-project');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('✅ 检测到 infra-root-pom 依赖已存在'),
        }),
        expect.any(Number),
      );

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('正在使用 AI 完成 MySQL 完整接入配置'),
        }),
        expect.any(Number),
      );

      // 应该返回提交给AI的完整配置提示词
      expect(result).toEqual(
        expect.objectContaining({
          type: 'submit_prompt',
          content: expect.stringContaining('请为项目 "test-project" 完成 MySQL 接入配置'),
        })
      );

      // 类型断言以访问 content 属性
      if (result && 'content' in result) {
        expect(result.content).toContain('com.xiaohongshu.redsql');
        expect(result.content).toContain('redsql-spring-boot-starter');
        expect(result.content).toContain('TestProjectDataSourceConfig');
        expect(result.content).toContain('创建配置类和目录结构');
        expect(result.content).toContain('spring:\\n  datasource:\\n    test-project:');
      }
    });

    it('应该生成包含配置文件更新的完整提示词', async () => {
      const mockPomContent = `
        <project>
          <dependencies>
            <dependency>
              <groupId>com.xiaohongshu</groupId>
              <artifactId>infra-root-pom</artifactId>
            </dependency>
          </dependencies>
        </project>
      `;

      // Mock 配置文件存在
      vi.mocked(fs.access).mockImplementation((filePath: any) => {
        if (typeof filePath === 'string' && 
            (filePath.endsWith('application-prod.yml') || 
             filePath.endsWith('application-sit.yml'))) {
          return Promise.resolve();
        }
        return Promise.resolve();
      });
      vi.mocked(fs.readFile).mockResolvedValue(mockPomContent);
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const result = await importCommand.action!(mockContext, 'mysql sns-circle');

      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining('找到配置文件'),
        }),
        expect.any(Number),
      );

      // 类型断言以访问 content 属性
      if (result && 'content' in result) {
        expect(result.content).toContain('任务3：更新配置文件');
        expect(result.content).toContain('application-prod.yml');
        expect(result.content).toContain('spring:\\n  datasource:\\n    sns-circle:');
        expect(result.content).toContain('SnsCircleDataSourceConfig');
      }
    });
  });

  describe('项目名称处理', () => {
    it('应该支持指定项目名称并查找当前目录的pom.xml', async () => {
      const projectName = 'my-project';
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await importCommand.action!(mockContext, `mysql ${projectName}`);

      // 应该显示项目配置信息
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.INFO,
          text: expect.stringContaining(`正在为项目 "${projectName}" 配置 MySQL 接入`),
        }),
        expect.any(Number),
      );

      // pom.xml路径应该是当前目录，不是项目子目录
      expect(mockContext.ui.addItem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.ERROR,
          text: expect.stringContaining(`未找到 pom.xml 文件`),
        }),
        expect.any(Number),
      );
    });
  });
}); 
