/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// 使用console进行日志记录

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 读取.knowledge/.ext目录中的文件内容
 * 这个工具允许大模型按需访问扩展知识库中的文件
 */
export async function readKnowledgeExt(
  relativePath: string,
  debugMode: boolean = false,
): Promise<{ content: string; path: string } | null> {
  try {
    // 查找.knowledge目录
    const knowledgeDir = findKnowledgeDirectory();
    if (!knowledgeDir) {
      if (debugMode) {
        console.warn('[KNOWLEDGE-EXT] No .knowledge directory found');
      }
      return null;
    }

    // 构建完整路径
    const extDir = path.join(knowledgeDir, '.ext');
    const fullPath = path.join(extDir, relativePath);

    // 安全检查：确保路径在.ext目录内
    if (!fullPath.startsWith(extDir)) {
      if (debugMode) {
        console.warn(
          `[KNOWLEDGE-EXT] Path traversal attempt blocked: ${relativePath}`,
        );
      }
      return null;
    }

    // 如果路径没有扩展名，尝试添加.md扩展名
    // 但如果已经有扩展名（如.yaml, .json等），则保持原样
    const finalPath = path.extname(fullPath) ? fullPath : `${fullPath}.md`;

    if (debugMode) {
      console.debug(`[KNOWLEDGE-EXT] Attempting to read: ${finalPath}`);
    }

    // 检查文件是否存在
    if (!fsSync.existsSync(finalPath)) {
      if (debugMode) {
        console.warn(`[KNOWLEDGE-EXT] File not found: ${finalPath}`);
      }
      return null;
    }

    // 读取文件内容
    const content = await fs.readFile(finalPath, 'utf-8');

    if (debugMode) {
      console.debug(
        `[KNOWLEDGE-EXT] Successfully read: ${finalPath} (${content.length} chars)`,
      );
    }

    return {
      content,
      path: finalPath,
    };
  } catch (error) {
    if (debugMode) {
      console.error(
        `[KNOWLEDGE-EXT] Error reading file ${relativePath}:`,
        error,
      );
    }
    return null;
  }
}

/**
 * 列出.knowledge/.ext目录中的可用文件
 */
export async function listKnowledgeExt(
  subPath: string = '',
  debugMode: boolean = false,
): Promise<{ files: string[]; directories: string[] } | null> {
  try {
    const knowledgeDir = findKnowledgeDirectory();
    if (!knowledgeDir) {
      if (debugMode) {
        console.warn('[KNOWLEDGE-EXT] No .knowledge directory found');
      }
      return null;
    }

    const extDir = path.join(knowledgeDir, '.ext');
    const targetDir = path.join(extDir, subPath);

    // 安全检查
    if (!targetDir.startsWith(extDir)) {
      if (debugMode) {
        console.warn(
          `[KNOWLEDGE-EXT] Path traversal attempt blocked: ${subPath}`,
        );
      }
      return null;
    }

    if (!fsSync.existsSync(targetDir)) {
      if (debugMode) {
        console.warn(`[KNOWLEDGE-EXT] Directory not found: ${targetDir}`);
      }
      return null;
    }

    const items = await fs.readdir(targetDir, { withFileTypes: true });
    const files: string[] = [];
    const directories: string[] = [];

    for (const item of items) {
      if (item.isDirectory()) {
        directories.push(item.name);
      } else if (item.isFile() && item.name.endsWith('.md')) {
        files.push(item.name);
      }
    }

    if (debugMode) {
      console.debug(
        `[KNOWLEDGE-EXT] Listed ${files.length} files and ${directories.length} directories in ${targetDir}`,
      );
    }

    return { files, directories };
  } catch (error) {
    if (debugMode) {
      console.error(
        `[KNOWLEDGE-EXT] Error listing directory ${subPath}:`,
        error,
      );
    }
    return null;
  }
}

/**
 * 查找.knowledge目录
 */
function findKnowledgeDirectory(): string | null {
  const candidatePaths = [
    // 1. 用户当前工作目录（用户自己的 .knowledge）
    path.resolve(process.cwd(), '.knowledge'),

    // 2. npm 安装后：从 core 包找到 cli 包中的 .knowledge
    // core 包位置: node_modules/@rdmind/rdmind/node_modules/@rdmind/rdmind-core/dist/src/tools/
    // cli 包位置: node_modules/@rdmind/rdmind/.knowledge
    // 从 __dirname (dist/src/tools) 回退到 cli 包根目录
    path.resolve(__dirname, '../../../../../.knowledge'), // 从 core 包的 dist/src/tools 回退到 cli 包
    path.resolve(__dirname, '../../../../../../.knowledge'), // 兼容不同的安装结构

    // 3. npm 全局安装：从 core 包所在位置找到 rdmind 包
    // 全局: /usr/local/lib/node_modules/@rdmind/rdmind/node_modules/@rdmind/rdmind-core/dist/src/tools
    path.resolve(__dirname, '../../../../../../../@rdmind/rdmind/.knowledge'),

    // 4. 开发环境：相对于项目根目录
    path.resolve(__dirname, '../../../../../../../.knowledge'), // 从 packages/core/dist/src/tools 到项目根
    path.resolve(__dirname, '../../../../../../.knowledge'),
    path.resolve(__dirname, '../../../../../.knowledge'),
    path.resolve(__dirname, '../../../../.knowledge'),
    path.resolve(__dirname, '../../../.knowledge'),
    path.resolve(__dirname, '../../.knowledge'),
    path.resolve(__dirname, '../.knowledge'),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      if (
        fsSync.existsSync(candidatePath) &&
        fsSync.statSync(candidatePath).isDirectory()
      ) {
        return candidatePath;
      }
    } catch {
      continue;
    }
  }

  return null;
}
