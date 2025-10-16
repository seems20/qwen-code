/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { techDesignCommand } from './techDesignCommand.js';
import type { CommandContext } from './types.js';
import { CommandKind, MessageType } from './types.js';
import type { Config } from '@rdmind/rdmind-core';

describe('techDesignCommand', () => {
  let mockContext: CommandContext;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {} as Config;
    mockContext = {
      services: {
        config: mockConfig,
        settings: {} as any,
        git: {} as any,
        logger: {} as any,
      },
      ui: {
        addItem: vi.fn(),
        clear: vi.fn(),
        loadHistory: vi.fn(),
        setDebugMessage: vi.fn(),
        pendingItem: null,
        setPendingItem: vi.fn(),
        toggleCorgiMode: vi.fn(),
        toggleVimEnabled: vi.fn(),
        setGeminiMdFileCount: vi.fn(),
        reloadCommands: vi.fn(),
      },
      session: {
        stats: {} as any,
        sessionShellAllowlist: new Set(),
      },
    };
  });

  it('should be defined', () => {
    expect(techDesignCommand).toBeDefined();
    expect(techDesignCommand.name).toBe('tech-design');
    expect(techDesignCommand.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have subcommands', () => {
    expect(techDesignCommand.subCommands).toBeDefined();
    expect(techDesignCommand.subCommands?.length).toBe(2);
    
    const subCommandNames = techDesignCommand.subCommands?.map(cmd => cmd.name);
    expect(subCommandNames).toContain('solution');
    expect(subCommandNames).toContain('plan');
  });

  it('should have alt name', () => {
    expect(techDesignCommand.altNames).toContain('td');
  });

  it('should show help when no subcommand provided', async () => {
    await techDesignCommand.action?.(mockContext, '');
    
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.INFO,
        text: expect.stringContaining('技术方案和执行计划生成工具'),
      }),
      expect.any(Number),
    );
  });

  it('should show error for unknown subcommand', async () => {
    await techDesignCommand.action?.(mockContext, 'unknown arg');
    
    expect(mockContext.ui.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.ERROR,
        text: expect.stringContaining('未知的子命令'),
      }),
      expect.any(Number),
    );
  });
});

