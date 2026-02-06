/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { getAllGeminiMdFilenames } from '../tools/memoryTool.js';
import type { FileDiscoveryService } from '../services/fileDiscoveryService.js';
import { processImports } from './memoryImportProcessor.js';
import { QWEN_DIR } from './paths.js';
import type { FileFilteringOptions } from '../config/constants.js';
import { createDebugLogger } from './debugLogger.js';

const logger = createDebugLogger('MEMORY_DISCOVERY');

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

async function getGeminiMdFilePathsInternal(
  currentWorkingDirectory: string,
  includeDirectoriesToReadGemini: readonly string[],
  userHomePath: string,
  fileService: FileDiscoveryService,
  extensionContextFilePaths: string[] = [],
  folderTrust: boolean,
  fileFilteringOptions?: FileFilteringOptions,
  maxDirs?: number,
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

  const paths = pathsArrays.flat();
  return Array.from(new Set<string>(paths));
}

async function getGeminiMdFilePathsInternalForEachDir(
  dir: string,
  userHomePath: string,
  fileService: FileDiscoveryService,
  extensionContextFilePaths: string[] = [],
  folderTrust: boolean,
  fileFilteringOptions?: FileFilteringOptions,
  maxDirs?: number,
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
      logger.debug(
        `Found readable global ${geminiMdFilename}: ${globalMemoryPath}`,
      );
    } catch {
      // It's okay if it's not found.
    }

    // Handle the case where we're in the home directory (dir is empty string or home path)
    const resolvedDir = dir ? path.resolve(dir) : resolvedHome;
    const isHomeDirectory = resolvedDir === resolvedHome;

    if (isHomeDirectory) {
      // For home directory, only check for RDMind.md directly in the home directory
      const homeContextPath = path.join(resolvedHome, geminiMdFilename);
      try {
        await fs.access(homeContextPath, fsSync.constants.R_OK);
        if (homeContextPath !== globalMemoryPath) {
          allPaths.add(homeContextPath);
          logger.debug(
            `Found readable home ${geminiMdFilename}: ${homeContextPath}`,
          );
        }
      } catch {
        // Not found, which is okay
      }
    } else if (dir && folderTrust) {
      // FIX: Only perform the workspace search (upward scan from CWD to project root)
      // if a valid currentWorkingDirectory is provided and it's not the home directory.
      const resolvedCwd = path.resolve(dir);
      logger.debug(
        `Searching for ${geminiMdFilename} starting from CWD: ${resolvedCwd}`,
      );

      const projectRoot = await findProjectRoot(resolvedCwd);
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
    }
  }

  // Also load all Markdown files under ~/.rdmind/rules (including nested subfolders).
  try {
    const resolvedHome = path.resolve(userHomePath);
    const rulesRoot = path.join(resolvedHome, QWEN_DIR, 'rules');
    if (
      fsSync.existsSync(rulesRoot) &&
      fsSync.statSync(rulesRoot).isDirectory()
    ) {
      logger.debug(`[RULES] Scanning rules directory: ${rulesRoot}`);
      const stack: string[] = [rulesRoot];
      while (stack.length > 0) {
        const current = stack.pop() as string;
        let entries: fsSync.Dirent[] = [];
        try {
          entries = fsSync.readdirSync(current, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of entries) {
          // skip hidden files/folders
          if (entry.name.startsWith('.')) continue;
          const fullPath = path.join(current, entry.name);
          if (entry.isDirectory()) {
            stack.push(fullPath);
          } else if (
            entry.isFile() &&
            entry.name.toLowerCase().endsWith('.md')
          ) {
            try {
              await fs.access(fullPath, fsSync.constants.R_OK);
              allPaths.add(fullPath);
              logger.debug(`[RULES] Added rule file: ${fullPath}`);
            } catch {
              // not readable, skip
            }
          }
        }
      }
    }
  } catch (e) {
    logger.warn(`[RULES] Failed to process rules directory: ${String(e)}`);
  }

  // Add extension context file paths.
  for (const extensionPath of extensionContextFilePaths) {
    allPaths.add(extensionPath);
  }

  const finalPaths = Array.from(allPaths);

  return finalPaths;
}

async function readGeminiMdFiles(
  filePaths: string[],
  importFormat: 'flat' | 'tree' = 'tree',
): Promise<GeminiFileContent[]> {
  const results: GeminiFileContent[] = [];
  logger.debug(`Starting to read ${filePaths.length} files`);

  for (const filePath of filePaths) {
    logger.debug(`Reading file: ${filePath}`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      logger.debug(
        `Successfully read file: ${filePath} (${content.length} chars)`,
      );

      // Process imports in the content
      logger.debug(`Processing imports for: ${filePath}`);
      const processedResult = await processImports(
        content,
        path.dirname(filePath),
        undefined,
        undefined,
        importFormat,
      );

      results.push({ filePath, content: processedResult.content });
      logger.debug(
        `Successfully read and processed imports: ${filePath} (Length: ${processedResult.content.length})`,
      );
    } catch (error: unknown) {
      logger.debug(`Failed to read file: ${filePath}`);

      const isTestEnv =
        process.env['NODE_ENV'] === 'test' || process.env['VITEST'];
      if (!isTestEnv) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          `Warning: Could not read ${getAllGeminiMdFilenames()} file at ${filePath}. Error: ${message}`,
        );
      }
      results.push({ filePath, content: null }); // Still include it with null content
    }
  }

  logger.debug(`Completed reading ${results.length} files`);
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
  fileService: FileDiscoveryService,
  extensionContextFilePaths: string[] = [],
  folderTrust: boolean,
  importFormat: 'flat' | 'tree' = 'tree',
  _fileFilteringOptions?: FileFilteringOptions,
  _maxDirs?: number,
): Promise<LoadServerHierarchicalMemoryResponse> {
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
    fileService,
    extensionContextFilePaths,
    folderTrust,
    _fileFilteringOptions,
    _maxDirs,
  );
  if (filePaths.length === 0) {
    logger.debug('No RDMind.md files found in hierarchy.');
    return { memoryContent: '', fileCount: 0 };
  }
  const contentsWithPaths = await readGeminiMdFiles(filePaths, importFormat);
  // Pass CWD for relative path display in concatenated content
  const combinedInstructions = concatenateInstructions(
    contentsWithPaths,
    currentWorkingDirectory,
  );

  // Only count files that match configured memory filenames (e.g., RDMind.md),
  // excluding system context files like output-language.md
  const memoryFilenames = new Set(getAllGeminiMdFilenames());
  const fileCount = contentsWithPaths.filter((item) =>
    memoryFilenames.has(path.basename(item.filePath)),
  ).length;

  return {
    memoryContent: combinedInstructions,
    fileCount, // Only count the context files
  };
}
