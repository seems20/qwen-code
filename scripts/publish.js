/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 发布脚本 - 自动化版本发布流程（单包打包模式）
 *
 * 使用方法:
 * npm run publish <version>           # 发布正式版本，如: npm run publish 0.0.13
 * npm run publish <version> -- --tag alpha  # 发布 alpha 版本，如: npm run publish 0.0.13-alpha.0 -- --tag alpha
 * npm run publish patch               # 自动递增补丁版本
 * npm run publish minor               # 自动递增次版本
 * npm run publish major               # 自动递增主版本
 */

function run(command, options = {}) {
  console.log(`\n📝 执行: ${command}`);
  try {
    execSync(command, { stdio: 'inherit', ...options });
  } catch (_error) {
    console.error(`\n❌ 命令执行失败: ${command}`);
    process.exit(1);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function getCurrentVersion() {
  const rootPackageJsonPath = resolve(process.cwd(), 'package.json');
  return readJson(rootPackageJsonPath).version;
}

// 解析命令行参数
const args = process.argv.slice(2);
const versionArg = args[0];
const publishTag = args.includes('--tag')
  ? args[args.indexOf('--tag') + 1]
  : 'latest';

if (!versionArg) {
  console.error('❌ 错误: 未指定版本号');
  console.error('\n使用方法:');
  console.error(
    '  npm run publish <version>              # 如: npm run publish 0.0.13',
  );
  console.error(
    '  npm run publish <version> -- --tag alpha   # 如: npm run publish 0.0.13-alpha.0 -- --tag alpha',
  );
  console.error('  npm run publish patch                  # 自动递增补丁版本');
  console.error('  npm run publish minor                  # 自动递增次版本');
  console.error('  npm run publish major                  # 自动递增主版本');
  process.exit(1);
}

console.log('\n🚀 开始发布流程（单包打包模式）...\n');
console.log('═══════════════════════════════════════════════════════════');

// 显示当前版本
const currentVersion = getCurrentVersion();
console.log(`📌 当前版本: ${currentVersion}`);

// 步骤 1: 更新版本号
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📦 步骤 1/5: 更新版本号');
console.log('═══════════════════════════════════════════════════════════');
run(`node ${resolve(__dirname, 'version.js')} ${versionArg}`);

// 获取新版本号
const newVersion = getCurrentVersion();
console.log(`\n✅ 版本号已更新: ${currentVersion} → ${newVersion}`);

// 步骤 2: 清理旧的构建文件
console.log('\n═══════════════════════════════════════════════════════════');
console.log('🧹 步骤 2/5: 清理旧的构建文件');
console.log('═══════════════════════════════════════════════════════════');
run('npm run clean');
console.log('\n✅ 清理完成');

// 步骤 2.5: 重新安装依赖（因为 clean 删除了 node_modules）
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📦 步骤 2.5/5: 重新安装依赖');
console.log('═══════════════════════════════════════════════════════════');
run('npm install');
console.log('\n✅ 依赖安装完成');

// 步骤 3: 打包项目 (bundle)
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📦 步骤 3/5: 打包项目 (esbuild)');
console.log('═══════════════════════════════════════════════════════════');
run('npm run bundle');
console.log('\n✅ 打包完成');

// 步骤 4: 准备发布包
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📋 步骤 4/5: 准备发布包元数据');
console.log('═══════════════════════════════════════════════════════════');
run('npm run prepare:package');
console.log('\n✅ 发布包准备完成');

// 步骤 5: 发布到 npm（从 dist 目录）
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📤 步骤 5/5: 发布到 npm (tag: ${publishTag})`);
console.log('═══════════════════════════════════════════════════════════');

const publishCommand =
  publishTag === 'latest'
    ? 'cd dist && npm publish'
    : `cd dist && npm publish --tag ${publishTag}`;

run(publishCommand);

// 发布成功
console.log('\n═══════════════════════════════════════════════════════════');
console.log('🎉 发布成功！');
console.log('═══════════════════════════════════════════════════════════');
console.log(`\n📦 已发布版本: v${newVersion}`);
console.log(`🏷️  发布标签: ${publishTag}`);
console.log(`📦 包名: @rdmind/rdmind`);
console.log('\n安装命令:');
if (publishTag === 'latest') {
  console.log(`  npm install -g @rdmind/rdmind`);
} else {
  console.log(`  npm install -g @rdmind/rdmind@${publishTag}`);
  console.log(`  # 或指定版本`);
  console.log(`  npm install -g @rdmind/rdmind@${newVersion}`);
}
console.log('\n═══════════════════════════════════════════════════════════\n');
