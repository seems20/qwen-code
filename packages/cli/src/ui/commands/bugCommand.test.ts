/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { bugCommand } from './bugCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';

// Mock the open module
vi.mock('open', () => ({
  default: vi.fn(),
}));

describe('bugCommand', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should open the RDMind issues URL and display success message', async () => {
    const mockContext = createMockCommandContext();
    const addItemSpy = vi.spyOn(mockContext.ui, 'addItem');
    const mockOpen = await import('open');
    vi.mocked(mockOpen.default).mockResolvedValue({} as unknown);

    if (!bugCommand.action) throw new Error('Action is not defined');
    await bugCommand.action(mockContext, 'A test bug');

    expect(mockOpen.default).toHaveBeenCalledWith(
      'https://code.devops.xiaohongshu.com/aikit/rdmind/-/issues',
    );
    expect(addItemSpy).toHaveBeenCalledWith(
      {
        type: MessageType.INFO,
        text: '正在打开 RDMind 问题报告页面:\nhttps://code.devops.xiaohongshu.com/aikit/rdmind/-/issues',
      },
      expect.any(Number),
    );
  });

  it('should display error message when opening URL fails', async () => {
    const mockContext = createMockCommandContext();
    const addItemSpy = vi.spyOn(mockContext.ui, 'addItem');
    const mockOpen = await import('open');
    const testError = new Error('Browser not found');
    vi.mocked(mockOpen.default).mockRejectedValue(testError);

    if (!bugCommand.action) throw new Error('Action is not defined');
    await bugCommand.action(mockContext, 'A test bug');

    expect(addItemSpy).toHaveBeenCalledTimes(2);
    expect(addItemSpy).toHaveBeenNthCalledWith(
      1,
      {
        type: MessageType.INFO,
        text: '正在打开 RDMind 问题报告页面:\nhttps://code.devops.xiaohongshu.com/aikit/rdmind/-/issues',
      },
      expect.any(Number),
    );
    expect(addItemSpy).toHaveBeenNthCalledWith(
      2,
      {
        type: MessageType.ERROR,
        text: '无法在浏览器中打开 URL: Browser not found\n请手动访问: https://code.devops.xiaohongshu.com/aikit/rdmind/-/issues',
      },
      expect.any(Number),
    );
  });
});
