/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
// 使用console进行日志记录

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
    path.resolve(process.cwd(), '.knowledge'),
    path.resolve(__dirname, '../../../.knowledge'),
    path.resolve(__dirname, '../../.knowledge'),
    path.resolve(__dirname, '../.knowledge'),
    path.resolve(__dirname, './.knowledge'),
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
