/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { bfsFileSearch } from './bfsFileSearch.js';
import { getAllGeminiMdFilenames } from '../tools/memoryTool.js';
import type { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import { processImports } from './memoryImportProcessor.js';
import type { FileFilteringOptions } from '../config/constants.js';
import { DEFAULT_MEMORY_FILE_FILTERING_OPTIONS } from '../config/constants.js';
import { QWEN_DIR } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple console logger, similar to the one previously in CLI's config.ts
// TODO: Integrate with a more robust server-side logger if available/appropriate.
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) =>
    console.debug('[DEBUG] [MemoryDiscovery]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => console.warn('[WARN] [MemoryDiscovery]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) =>
    console.error('[ERROR] [MemoryDiscovery]', ...args),
};

interface GeminiFileContent {
  filePath: string;
  content: string | null;
}

async function findProjectRoot(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  while (true) {
    const gitPath = path.join(currentDir, '.git');
    try {
      const stats = await fs.lstat(gitPath);
      if (stats.isDirectory()) {
        return currentDir;
      }
    } catch (error: unknown) {
      // Don't log ENOENT errors as they're expected when .git doesn't exist
      // Also don't log errors in test environments, which often have mocked fs
      const isENOENT =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'ENOENT';

      // Only log unexpected errors in non-test environments
      // process.env['NODE_ENV'] === 'test' or VITEST are common test indicators
      const isTestEnv =
        process.env['NODE_ENV'] === 'test' || process.env['VITEST'];

      if (!isENOENT && !isTestEnv) {
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const fsError = error as { code: string; message: string };
          logger.warn(
            `Error checking for .git directory at ${gitPath}: ${fsError.message}`,
          );
        } else {
          logger.warn(
            `Non-standard error checking for .git directory at ${gitPath}: ${String(error)}`,
          );
        }
      }
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

function getKnowledgeDirectoryPath(): string | null {
  // 尝试多个可能的.knowledge目录路径
  const candidatePaths = [
    // 开发环境路径
    path.resolve(__dirname, '../../../.knowledge'),
    path.resolve(__dirname, '../../.knowledge'),
    // 生产环境路径
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
      // 路径不存在或不可访问，继续尝试下一个
      continue;
    }
  }
  return null; // 没有找到.knowledge目录
}

async function getGeminiMdFilePathsInternal(
  currentWorkingDirectory: string,
  includeDirectoriesToReadGemini: readonly string[],
  userHomePath: string,
  debugMode: boolean,
  fileService: FileDiscoveryService,
  extensionContextFilePaths: string[] = [],
  folderTrust: boolean,
  fileFilteringOptions: FileFilteringOptions,
  maxDirs: number,
): Promise<string[]> {
  const dirs = new Set<string>([
    ...includeDirectoriesToReadGemini,
    currentWorkingDirectory,
  ]);

  // Process directories in parallel with concurrency limit to prevent EMFILE errors
  const CONCURRENT_LIMIT = 10;
  const dirsArray = Array.from(dirs);
  const pathsArrays: string[][] = [];

  for (let i = 0; i < dirsArray.length; i += CONCURRENT_LIMIT) {
    const batch = dirsArray.slice(i, i + CONCURRENT_LIMIT);
    const batchPromises = batch.map((dir) =>
      getGeminiMdFilePathsInternalForEachDir(
        dir,
        userHomePath,
        debugMode,
        fileService,
        extensionContextFilePaths,
        folderTrust,
        fileFilteringOptions,
        maxDirs,
      ),
    );

    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        pathsArrays.push(result.value);
      } else {
        const error = result.reason;
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error discovering files in directory: ${message}`);
        // Continue processing other directories
      }
    }
  }

  // 添加.knowledge目录（不包含.ext子目录）
  const knowledgePath = getKnowledgeDirectoryPath();
  if (knowledgePath) {
    if (debugMode) {
      console.log(
        `[MEMORY-DISCOVERY] Adding knowledge directory: ${knowledgePath}`,
      );
    }
    dirs.add(knowledgePath);
  } else {
    if (debugMode) {
      console.log(`[MEMORY-DISCOVERY] No knowledge directory found`);
    }
  }

  const paths = pathsArrays.flat();
  return Array.from(new Set<string>(paths));
}

async function getGeminiMdFilePathsInternalForEachDir(
  dir: string,
  userHomePath: string,
  debugMode: boolean,
  fileService: FileDiscoveryService,
  extensionContextFilePaths: string[] = [],
  folderTrust: boolean,
  fileFilteringOptions: FileFilteringOptions,
  maxDirs: number,
): Promise<string[]> {
  const allPaths = new Set<string>();
  const geminiMdFilenames = getAllGeminiMdFilenames();

  for (const geminiMdFilename of geminiMdFilenames) {
    const resolvedHome = path.resolve(userHomePath);
    const globalMemoryPath = path.join(
      resolvedHome,
      QWEN_DIR,
      geminiMdFilename,
    );

    // This part that finds the global file always runs.
    try {
      await fs.access(globalMemoryPath, fsSync.constants.R_OK);
      allPaths.add(globalMemoryPath);
      if (debugMode)
        logger.debug(
          `Found readable global ${geminiMdFilename}: ${globalMemoryPath}`,
        );
    } catch {
      // It's okay if it's not found.
    }

    // Handle the case where we're in the home directory (dir is empty string or home path)
    const resolvedDir = dir ? path.resolve(dir) : resolvedHome;
    const isHomeDirectory = resolvedDir === resolvedHome;
    const isKnowledgeDirectory = dir && dir.includes('.knowledge');

    if (isHomeDirectory) {
      // For home directory, only check for RDMind.md directly in the home directory
      const homeContextPath = path.join(resolvedHome, geminiMdFilename);
      try {
        await fs.access(homeContextPath, fsSync.constants.R_OK);
        if (homeContextPath !== globalMemoryPath) {
          allPaths.add(homeContextPath);
          if (debugMode)
            logger.debug(
              `Found readable home ${geminiMdFilename}: ${homeContextPath}`,
            );
        }
      } catch {
        // Not found, which is okay
      }
    } else if (isKnowledgeDirectory) {
      // Special handling for .knowledge directory
      await processKnowledgeDirectory(
        resolvedDir,
        geminiMdFilename,
        allPaths,
        debugMode,
        fileService,
        fileFilteringOptions,
        maxDirs,
      );
    } else if (dir && folderTrust) {
      // FIX: Only perform the workspace search (upward and downward scans)
      // if a valid currentWorkingDirectory is provided and it's not the home directory.
      const resolvedCwd = path.resolve(dir);
      if (debugMode)
        logger.debug(
          `Searching for ${geminiMdFilename} starting from CWD: ${resolvedCwd}`,
        );

      const projectRoot = await findProjectRoot(resolvedCwd);
      if (debugMode)
        logger.debug(`Determined project root: ${projectRoot ?? 'None'}`);

      const upwardPaths: string[] = [];
      let currentDir = resolvedCwd;
      const ultimateStopDir = projectRoot
        ? path.dirname(projectRoot)
        : path.dirname(resolvedHome);

      while (currentDir && currentDir !== path.dirname(currentDir)) {
        if (currentDir === path.join(resolvedHome, QWEN_DIR)) {
          break;
        }

        const potentialPath = path.join(currentDir, geminiMdFilename);
        try {
          await fs.access(potentialPath, fsSync.constants.R_OK);
          if (potentialPath !== globalMemoryPath) {
            upwardPaths.unshift(potentialPath);
          }
        } catch {
          // Not found, continue.
        }

        if (currentDir === ultimateStopDir) {
          break;
        }

        currentDir = path.dirname(currentDir);
      }
      upwardPaths.forEach((p) => allPaths.add(p));

      const mergedOptions: FileFilteringOptions = {
        ...DEFAULT_MEMORY_FILE_FILTERING_OPTIONS,
        ...fileFilteringOptions,
      };

      const downwardPaths = await bfsFileSearch(resolvedCwd, {
        fileName: geminiMdFilename,
        maxDirs,
        debug: debugMode,
        fileService,
        fileFilteringOptions: mergedOptions,
      });
      downwardPaths.sort();
      for (const dPath of downwardPaths) {
        allPaths.add(dPath);
      }
    }
  }

  // Add extension context file paths.
  for (const extensionPath of extensionContextFilePaths) {
    allPaths.add(extensionPath);
  }

  const finalPaths = Array.from(allPaths);

  if (debugMode)
    logger.debug(
      `Final ordered ${getAllGeminiMdFilenames()} paths to read: ${JSON.stringify(
        finalPaths,
      )}`,
    );
  return finalPaths;
}

async function processKnowledgeDirectory(
  knowledgeDir: string,
  geminiMdFilename: string,
  allPaths: Set<string>,
  debugMode: boolean,
  _fileService: FileDiscoveryService,
  _fileFilteringOptions: FileFilteringOptions,
  _maxDirs: number,
): Promise<void> {
  if (debugMode) {
    logger.debug(`[KNOWLEDGE] Processing knowledge directory: ${knowledgeDir}`);
  }
  // 1. 加载.knowledge根目录下的所有.md文件（立即加载）
  try {
    const rootFiles = await fs.readdir(knowledgeDir);
    for (const file of rootFiles) {
      // 通用处理：加载所有.md文件，排除以.开头的隐藏文件
      if (file.endsWith('.md') && !file.startsWith('.')) {
        const filePath = path.join(knowledgeDir, file);
        try {
          await fs.access(filePath, fsSync.constants.R_OK);
          allPaths.add(filePath);
          if (debugMode) {
            logger.debug(
              `[KNOWLEDGE] Loaded knowledge root file: ${file} -> ${filePath}`,
            );
          }
        } catch {
          // 文件不可读，跳过
        }
      }
    }
  } catch (error) {
    if (debugMode) {
      logger.warn(`[KNOWLEDGE] Failed to read knowledge directory: ${error}`);
    }
  }
  // 2. 不加载.ext目录（按需加载）
  // .ext目录的内容将通过各个知识库文件的引用机制按需加载
  if (debugMode) {
    logger.debug(
      `[KNOWLEDGE] Knowledge directory processing complete. Skipped .ext directory for lazy loading.`,
    );
  }
}

async function readGeminiMdFiles(
  filePaths: string[],
  debugMode: boolean,
  importFormat: 'flat' | 'tree' = 'tree',
): Promise<GeminiFileContent[]> {
  const results: GeminiFileContent[] = [];
  if (debugMode) {
    console.log(`[FILE-READ] Starting to read ${filePaths.length} files`);
  }

  for (const filePath of filePaths) {
    if (debugMode) {
      console.log(`[FILE-READ] Reading file: ${filePath}`);
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (debugMode) {
        console.log(
          `[FILE-READ] Successfully read file: ${filePath} (${content.length} chars)`,
        );
      }

      // Process imports in the content
      if (debugMode) {
        console.log(`[FILE-READ] Processing imports for: ${filePath}`);
      }
      const processedResult = await processImports(
        content,
        path.dirname(filePath),
        debugMode,
        undefined,
        undefined,
        importFormat,
      );

      results.push({ filePath, content: processedResult.content });
      if (debugMode) {
        console.log(
          `[FILE-READ] Successfully processed imports for: ${filePath}`,
        );
      }

      if (debugMode)
        logger.debug(
          `Successfully read and processed imports: ${filePath} (Length: ${processedResult.content.length})`,
        );
    } catch (error: unknown) {
      if (debugMode) {
        console.log(`[FILE-READ] Failed to read file: ${filePath}`, error);
      }

      const isTestEnv =
        process.env['NODE_ENV'] === 'test' || process.env['VITEST'];
      if (!isTestEnv) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          `Warning: Could not read ${getAllGeminiMdFilenames()} file at ${filePath}. Error: ${message}`,
        );
      }
      results.push({ filePath, content: null }); // Still include it with null content
      if (debugMode) logger.debug(`Failed to read: ${filePath}`);
    }
  }

  if (debugMode) {
    console.log(`[FILE-READ] Completed reading ${results.length} files`);
  }
  return results;
}

function concatenateInstructions(
  instructionContents: GeminiFileContent[],
  // CWD is needed to resolve relative paths for display markers
  currentWorkingDirectoryForDisplay: string,
): string {
  return instructionContents
    .filter((item) => typeof item.content === 'string')
    .map((item) => {
      const trimmedContent = (item.content as string).trim();
      if (trimmedContent.length === 0) {
        return null;
      }
      const displayPath = path.isAbsolute(item.filePath)
        ? path.relative(currentWorkingDirectoryForDisplay, item.filePath)
        : item.filePath;
      return `--- Context from: ${displayPath} ---\n${trimmedContent}\n--- End of Context from: ${displayPath} ---`;
    })
    .filter((block): block is string => block !== null)
    .join('\n\n');
}

export interface LoadServerHierarchicalMemoryResponse {
  memoryContent: string;
  fileCount: number;
}

/**
 * Loads hierarchical RDMind.md files and concatenates their content.
 * This function is intended for use by the server.
 */
export async function loadServerHierarchicalMemory(
  currentWorkingDirectory: string,
  includeDirectoriesToReadGemini: readonly string[],
  debugMode: boolean,
  fileService: FileDiscoveryService,
  extensionContextFilePaths: string[] = [],
  folderTrust: boolean,
  importFormat: 'flat' | 'tree' = 'tree',
  fileFilteringOptions?: FileFilteringOptions,
  maxDirs: number = 200,
): Promise<LoadServerHierarchicalMemoryResponse> {
  if (debugMode)
    logger.debug(
      `Loading server hierarchical memory for CWD: ${currentWorkingDirectory} (importFormat: ${importFormat})`,
    );

  // For the server, homedir() refers to the server process's home.
  // This is consistent with how MemoryTool already finds the global path.
  const userHomePath = homedir();
  const filePaths = await getGeminiMdFilePathsInternal(
    currentWorkingDirectory,
    includeDirectoriesToReadGemini,
    userHomePath,
    debugMode,
    fileService,
    extensionContextFilePaths,
    folderTrust,
    fileFilteringOptions || DEFAULT_MEMORY_FILE_FILTERING_OPTIONS,
    maxDirs,
  );
  if (filePaths.length === 0) {
    if (debugMode) logger.debug('No RDMind.md files found in hierarchy.');
    return { memoryContent: '', fileCount: 0 };
  }
  const contentsWithPaths = await readGeminiMdFiles(
    filePaths,
    debugMode,
    importFormat,
  );
  // Pass CWD for relative path display in concatenated content
  const combinedInstructions = concatenateInstructions(
    contentsWithPaths,
    currentWorkingDirectory,
  );
  if (debugMode)
    logger.debug(
      `Combined instructions length: ${combinedInstructions.length}`,
    );
  if (debugMode && combinedInstructions.length > 0)
    logger.debug(
      `Combined instructions (snippet): ${combinedInstructions.substring(0, 500)}...`,
    );
  return {
    memoryContent: combinedInstructions,
    fileCount: contentsWithPaths.length,
  };
}
