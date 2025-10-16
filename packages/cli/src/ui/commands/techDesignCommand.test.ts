/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { techDesignCommand } from './techDesignCommand.js';
import type { CommandContext } from './types.js';
import { CommandKind } from './types.js';
import { MessageType } from '../types.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';

describe('techDesignCommand', () => {
  let mockContext: CommandContext;

  beforeEach(() => {
    mockContext = createMockCommandContext({
      services: {
        config: {},
      },
      ui: {
        addItem: vi.fn(),
      },
    } as unknown as CommandContext);
  });

  it('should be defined', () => {
    expect(techDesignCommand).toBeDefined();
    expect(techDesignCommand.name).toBe('tech-design');
    expect(techDesignCommand.kind).toBe(CommandKind.BUILT_IN);
  });

  it('should have subcommands', () => {
    expect(techDesignCommand.subCommands).toBeDefined();
    expect(techDesignCommand.subCommands?.length).toBe(2);

    const subCommandNames = techDesignCommand.subCommands?.map(
      (cmd) => cmd.name,
    );
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
