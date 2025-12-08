/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import { canUseRipgrep } from '@rdmind/rdmind-core';
import { isL4Repository } from './l4RepositoryAutoSwitch.js';

type WarningCheckOptions = {
  workspaceRoot: string;
  useRipgrep: boolean;
  useBuiltinRipgrep: boolean;
};

type WarningCheck = {
  id: string;
  check: (options: WarningCheckOptions) => Promise<string | null>;
};

// Individual warning checks
const homeDirectoryCheck: WarningCheck = {
  id: 'home-directory',
  check: async (options: WarningCheckOptions) => {
    try {
      const [workspaceRealPath, homeRealPath] = await Promise.all([
        fs.realpath(options.workspaceRoot),
        fs.realpath(os.homedir()),
      ]);

      if (workspaceRealPath === homeRealPath) {
        return '当前正在主目录下运行 RDMind，建议进入项目目录';
      }
      return null;
    } catch (_err: unknown) {
      return 'Could not verify the current directory due to a file system error.';
    }
  },
};

const rootDirectoryCheck: WarningCheck = {
  id: 'root-directory',
  check: async (options: WarningCheckOptions) => {
    try {
      const workspaceRealPath = await fs.realpath(options.workspaceRoot);
      const errorMessage =
        'Warning: You are running RDMind in the root directory. Your entire folder structure will be used for context. It is strongly recommended to run in a project-specific directory.';

      // Check for Unix root directory
      if (path.dirname(workspaceRealPath) === workspaceRealPath) {
        return errorMessage;
      }

      return null;
    } catch (_err: unknown) {
      return 'Could not verify the current directory due to a file system error.';
    }
  },
};

const ripgrepAvailabilityCheck: WarningCheck = {
  id: 'ripgrep-availability',
  check: async (options: WarningCheckOptions) => {
    if (!options.useRipgrep) {
      return null;
    }

    try {
      const isAvailable = await canUseRipgrep(options.useBuiltinRipgrep);
      if (!isAvailable) {
        return 'Ripgrep not available: Please install ripgrep globally to enable faster file content search. Falling back to built-in grep.';
      }
      return null;
    } catch (error) {
      return `Ripgrep not available: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to built-in grep.`;
    }
  },
};

const l4RepositoryCheck: WarningCheck = {
  id: 'l4-repository',
  check: async (options: WarningCheckOptions) => {
    try {
      // 调用接口判断是否是L4仓库
      const isL4Repo = await isL4Repository(options.workspaceRoot);

      if (isL4Repo) {
        return 'L4等级仓库，为您切换到QS平台模型';
      }

      return null;
    } catch (_err: unknown) {
      return null;
    }
  },
};

// All warning checks
const WARNING_CHECKS: readonly WarningCheck[] = [
  homeDirectoryCheck,
  rootDirectoryCheck,
  ripgrepAvailabilityCheck,
  l4RepositoryCheck,
];

export async function getUserStartupWarnings(
  options: WarningCheckOptions,
): Promise<string[]> {
  const results = await Promise.all(
    WARNING_CHECKS.map((check) => check.check(options)),
  );
  return results.filter((msg) => msg !== null);
}
