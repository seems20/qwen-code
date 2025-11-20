/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { Storage } from '@rdmind/rdmind-core';

const cleanupFunctions: Array<(() => void) | (() => Promise<void>)> = [];

export function registerCleanup(fn: (() => void) | (() => Promise<void>)) {
  cleanupFunctions.push(fn);
}

// 将 registerCleanup 暴露到全局，让 TokenUsageReporter 和 EventUsageReporter 可以注册
declare global {
  var registerCleanup:
    | ((fn: (() => void) | (() => Promise<void>)) => void)
    | undefined;
}

if (typeof global !== 'undefined') {
  global.registerCleanup = registerCleanup;
}

export async function runExitCleanup() {
  for (const fn of cleanupFunctions) {
    try {
      await fn();
    } catch (_) {
      // Ignore errors during cleanup.
    }
  }
  cleanupFunctions.length = 0; // Clear the array
}

export async function cleanupCheckpoints() {
  const storage = new Storage(process.cwd());
  const tempDir = storage.getProjectTempDir();
  const checkpointsDir = join(tempDir, 'checkpoints');
  try {
    await fs.rm(checkpointsDir, { recursive: true, force: true });
  } catch {
    // Ignore errors if the directory doesn't exist or fails to delete.
  }
}
