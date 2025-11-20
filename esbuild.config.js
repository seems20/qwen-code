/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  writeFileSync,
  rmSync,
  chmodSync,
  existsSync,
  statSync,
} from 'node:fs';

let esbuild;
try {
  esbuild = (await import('esbuild')).default;
} catch (_error) {
  console.warn('esbuild not available, skipping bundle step');
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pkg = require(path.resolve(__dirname, 'package.json'));

// Clean dist directory (cross-platform)
// Try to fix permissions before deleting if needed
const distPath = path.resolve(__dirname, 'dist');
if (existsSync(distPath)) {
  try {
    // Try to make files writable before deletion
    const fixPermissions = (dir) => {
      try {
        const stats = statSync(dir);
        if (stats.isDirectory()) {
          chmodSync(dir, 0o755);
        } else {
          chmodSync(dir, 0o644);
        }
      } catch {
        // Ignore permission errors when trying to fix permissions
      }
    };

    // Try to fix permissions recursively (best effort)
    try {
      fixPermissions(distPath);
    } catch {
      // Ignore if we can't fix permissions
    }
  } catch {
    // Ignore permission fixing errors
  }
}

try {
  rmSync(distPath, { recursive: true, force: true });
} catch (error) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'EACCES'
  ) {
    console.error(
      `\n❌ 权限错误：无法删除 ${distPath}\n` +
      `   该目录或文件属于 root 用户，请手动修复权限：\n` +
      `   sudo chown -R $(whoami) ${distPath}\n` +
      `   或者：\n` +
      `   sudo rm -rf ${distPath}\n`,
    );
    process.exit(1);
  }
  throw error;
}

const external = [
  '@lydell/node-pty',
  'node-pty',
  '@lydell/node-pty-darwin-arm64',
  '@lydell/node-pty-darwin-x64',
  '@lydell/node-pty-linux-x64',
  '@lydell/node-pty-win32-arm64',
  '@lydell/node-pty-win32-x64',
  'tiktoken',
];

esbuild
  .build({
    entryPoints: ['packages/cli/index.ts'],
    bundle: true,
    outfile: 'dist/cli.js',
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external,
    packages: 'bundle',
    inject: [path.resolve(__dirname, 'scripts/esbuild-shims.js')],
    banner: {
      js: `// Force strict mode and setup for ESM
"use strict";`,
    },
    alias: {
      'is-in-ci': path.resolve(
        __dirname,
        'packages/cli/src/patches/is-in-ci.ts',
      ),
    },
    define: {
      'process.env.CLI_VERSION': JSON.stringify(pkg.version),
      // Make global available for compatibility
      global: 'globalThis',
    },
    loader: { '.node': 'file' },
    metafile: true,
    write: true,
    keepNames: true,
  })
  .then(({ metafile }) => {
    if (process.env.DEV === 'true') {
      writeFileSync('./dist/esbuild.json', JSON.stringify(metafile, null, 2));
    }
  })
  .catch((error) => {
    console.error('esbuild build failed:', error);
    process.exitCode = 1;
  });
