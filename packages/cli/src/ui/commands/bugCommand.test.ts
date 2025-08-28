/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bugCommand } from './bugCommand.js';
import { createMockCommandContext } from '../../test-utils/mockCommandContext.js';
import { MessageType } from '../types.js';

describe('bugCommand', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display the contact message', async () => {
    const mockContext = createMockCommandContext();
    const addItemSpy = vi.spyOn(mockContext.ui, 'addItem');

    if (!bugCommand.action) throw new Error('Action is not defined');
    await bugCommand.action(mockContext, 'A test bug');

    expect(addItemSpy).toHaveBeenCalledWith(
      {
        type: MessageType.INFO,
        text: '遇到bug或者反馈问题，请联系梦奇或冰雪，非常感谢',
      },
      expect.any(Number)
    );
  });
});
