/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Prepares the bundled CLI package for npm publishing
 * This script adds publishing metadata (package.json, README, LICENSE) to dist/
 * All runtime assets (cli.js, vendor/, *.sb) are already in dist/ from the bundle step
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const cliBundlePath = path.join(distDir, 'cli.js');
const vendorDir = path.join(distDir, 'vendor');
const cliDir = path.join(rootDir, 'packages', 'cli');

// Verify dist directory and bundle exist
if (!fs.existsSync(distDir)) {
  console.error('Error: dist/ directory not found');
  console.error('Please run "npm run bundle" first');
  process.exit(1);
}

if (!fs.existsSync(cliBundlePath)) {
  console.error(`Error: Bundle not found at ${cliBundlePath}`);
  console.error('Please run "npm run bundle" first');
  process.exit(1);
}

if (!fs.existsSync(vendorDir)) {
  console.error(`Error: Vendor directory not found at ${vendorDir}`);
  console.error('Please run "npm run bundle" first');
  process.exit(1);
}

// Copy README and LICENSE
console.log('Copying documentation files...');
const filesToCopy = ['README.md', 'LICENSE'];
for (const file of filesToCopy) {
  const sourcePath = path.join(rootDir, file);
  const destPath = path.join(distDir, file);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`Copied ${file}`);
  } else {
    console.warn(`Warning: ${file} not found at ${sourcePath}`);
  }
}

// Copy template directories from packages/cli
console.log('Copying template directories...');
const templateDirs = ['template', 'templates', '.knowledge'];
for (const dir of templateDirs) {
  const sourcePath = path.join(cliDir, dir);
  const destPath = path.join(distDir, dir);
  if (fs.existsSync(sourcePath)) {
    copyRecursiveSync(sourcePath, destPath);
    console.log(`Copied ${dir}/`);
  } else {
    console.warn(`Warning: ${dir} not found at ${sourcePath}`);
  }
}

// Copy examples directory (extension boilerplate templates)
// Note: examples is in a different location (src/commands/extensions/)
console.log('Copying examples directory...');
const examplesSourcePath = path.join(
  cliDir,
  'src',
  'commands',
  'extensions',
  'examples',
);
const examplesDestPath = path.join(distDir, 'examples');
if (fs.existsSync(examplesSourcePath)) {
  copyRecursiveSync(examplesSourcePath, examplesDestPath);
  console.log('Copied examples/');
} else {
  console.warn(`Warning: examples not found at ${examplesSourcePath}`);
}

// Copy locales folder
console.log('Copying locales folder...');
const localesSourceDir = path.join(
  rootDir,
  'packages',
  'cli',
  'src',
  'i18n',
  'locales',
);
const localesDestDir = path.join(distDir, 'locales');

if (fs.existsSync(localesSourceDir)) {
  // Recursive copy function
  function copyRecursiveSync(src, dest) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src);
      for (const entry of entries) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        copyRecursiveSync(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  copyRecursiveSync(localesSourceDir, localesDestDir);
  console.log('Copied locales folder');
} else {
  console.warn(`Warning: locales folder not found at ${localesSourceDir}`);
}

// Copy package.json from root and modify it for publishing
console.log('Creating package.json for distribution...');
const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'),
);

// Create a clean package.json for the published package
const distPackageJson = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  description:
    rootPackageJson.description || 'RDMind - AI-powered coding assistant',
  repository: rootPackageJson.repository,
  type: 'module',
  main: 'cli.js',
  bin: {
    rdmind: 'cli.js',
  },
  files: [
    'cli.js',
    'vendor',
    '*.sb',
    'template',
    'templates',
    'examples',
    '.knowledge',
    'README.md',
    'LICENSE',
    'locales',
  ],
  config: rootPackageJson.config,
  publishConfig: rootPackageJson.publishConfig,
  dependencies: {},
  optionalDependencies: {
    '@lydell/node-pty': '1.1.0',
    '@lydell/node-pty-darwin-arm64': '1.1.0',
    '@lydell/node-pty-darwin-x64': '1.1.0',
    '@lydell/node-pty-linux-x64': '1.1.0',
    '@lydell/node-pty-win32-arm64': '1.1.0',
    '@lydell/node-pty-win32-x64': '1.1.0',
    'node-pty': '^1.0.0',
  },
  engines: rootPackageJson.engines,
};

fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(distPackageJson, null, 2) + '\n',
);

console.log('\n✅ Package prepared for publishing at dist/');
console.log('\nPackage structure:');
execSync('ls -lh dist/', { stdio: 'inherit', cwd: rootDir });

/**
 * Recursively copy directory
 */
function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }

  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      // Skip .DS_Store and other hidden files except .knowledge
      if (entry === '.DS_Store') {
        continue;
      }

      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      copyRecursiveSync(srcPath, destPath);
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}
