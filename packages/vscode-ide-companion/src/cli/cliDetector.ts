/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CliDetectionResult {
  isInstalled: boolean;
  cliPath?: string;
  version?: string;
  error?: string;
}

/**
 * Detects if RDMind CLI is installed and accessible
 */
export class CliDetector {
  private static cachedResult: CliDetectionResult | null = null;
  private static lastCheckTime: number = 0;
  private static readonly CACHE_DURATION_MS = 30000; // 30 seconds

  /**
   * Checks if the RDMind CLI is installed
   * @param forceRefresh - Force a new check, ignoring cache
   * @returns Detection result with installation status and details
   */
  static async detectRdmindCli(
    forceRefresh = false,
  ): Promise<CliDetectionResult> {
    const now = Date.now();

    // Return cached result if available and not expired
    if (
      !forceRefresh &&
      this.cachedResult &&
      now - this.lastCheckTime < this.CACHE_DURATION_MS
    ) {
      console.log('[CliDetector] Returning cached result');
      return this.cachedResult;
    }

    console.log(
      '[CliDetector] Starting CLI detection, current PATH:',
      process.env.PATH,
    );

    try {
      const isWindows = process.platform === 'win32';
      const whichCommand = isWindows ? 'where' : 'which';

      // Check if rdmind command exists
      try {
        // Use NVM environment for consistent detection
        // Fallback chain: default alias -> node alias -> current version
        const detectionCommand =
          process.platform === 'win32'
            ? `${whichCommand} rdmind`
            : 'source ~/.nvm/nvm.sh 2>/dev/null && (nvm use default 2>/dev/null || nvm use node 2>/dev/null || nvm use 2>/dev/null); which rdmind';

        console.log(
          '[CliDetector] Detecting CLI with command:',
          detectionCommand,
        );

        const { stdout } = await execAsync(detectionCommand, {
          timeout: 5000,
          shell: '/bin/bash',
        });
        // The output may contain multiple lines, with NVM activation messages
        // We want the last line which should be the actual path
        const lines = stdout
          .trim()
          .split('\n')
          .filter((line) => line.trim());
        const cliPath = lines[lines.length - 1];

        console.log('[CliDetector] Found CLI at:', cliPath);

        // Try to get version
        let version: string | undefined;
        try {
          // Use NVM environment for version check
          // Fallback chain: default alias -> node alias -> current version
          // Also ensure we use the correct Node.js version that matches the CLI installation
          const versionCommand =
            process.platform === 'win32'
              ? 'rdmind --version'
              : 'source ~/.nvm/nvm.sh 2>/dev/null && (nvm use default 2>/dev/null || nvm use node 2>/dev/null || nvm use 2>/dev/null); rdmind --version';

          console.log(
            '[CliDetector] Getting version with command:',
            versionCommand,
          );

          const { stdout: versionOutput } = await execAsync(versionCommand, {
            timeout: 5000,
            shell: '/bin/bash',
          });
          // The output may contain multiple lines, with NVM activation messages
          // We want the last line which should be the actual version
          const versionLines = versionOutput
            .trim()
            .split('\n')
            .filter((line) => line.trim());
          version = versionLines[versionLines.length - 1];
          console.log('[CliDetector] CLI version:', version);
        } catch (versionError) {
          console.log('[CliDetector] Failed to get CLI version:', versionError);
          // Version check failed, but CLI is installed
        }

        this.cachedResult = {
          isInstalled: true,
          cliPath,
          version,
        };
        this.lastCheckTime = now;
        return this.cachedResult;
      } catch (detectionError) {
        console.log('[CliDetector] CLI not found, error:', detectionError);
        // CLI not found
        let error = `RDMind CLI not found in PATH. Please install it using: npm install -g @rdmind/rdmind`;

        // Provide specific guidance for permission errors
        if (detectionError instanceof Error) {
          const errorMessage = detectionError.message;
          if (
            errorMessage.includes('EACCES') ||
            errorMessage.includes('Permission denied')
          ) {
            error += `\n\nThis may be due to permission issues. Possible solutions:
              \n1. Reinstall the CLI without sudo: npm install -g @rdmind/rdmind
              \n2. If previously installed with sudo, fix ownership: sudo chown -R $(whoami) $(npm config get prefix)/lib/node_modules/@rdmind/rdmind
              \n3. Use nvm for Node.js version management to avoid permission issues
              \n4. Check your PATH environment variable includes npm's global bin directory`;
          }
        }

        this.cachedResult = {
          isInstalled: false,
          error,
        };
        this.lastCheckTime = now;
        return this.cachedResult;
      }
    } catch (error) {
      console.log('[CliDetector] General detection error:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      let userFriendlyError = `Failed to detect RDMind CLI: ${errorMessage}`;

      // Provide specific guidance for permission errors
      if (
        errorMessage.includes('EACCES') ||
        errorMessage.includes('Permission denied')
      ) {
        userFriendlyError += `\n\nThis may be due to permission issues. Possible solutions:
          \n1. Reinstall the CLI without sudo: npm install -g @rdmind/rdmind
          \n2. If previously installed with sudo, fix ownership: sudo chown -R $(whoami) $(npm config get prefix)/lib/node_modules/@rdmind/rdmind
          \n3. Use nvm for Node.js version management to avoid permission issues
          \n4. Check your PATH environment variable includes npm's global bin directory`;
      }

      this.cachedResult = {
        isInstalled: false,
        error: userFriendlyError,
      };
      this.lastCheckTime = now;
      return this.cachedResult;
    }
  }

  /**
   * Clears the cached detection result
   */
  static clearCache(): void {
    this.cachedResult = null;
    this.lastCheckTime = 0;
  }

  /**
   * Gets installation instructions based on the platform
   */
  static getInstallationInstructions(): {
    title: string;
    steps: string[];
    documentationUrl: string;
  } {
    return {
      title: 'RDMind CLI is not installed',
      steps: [
        'Install via npm:',
        '  npm install -g @rdmind/rdmind',
        '',
        'If you are using nvm (automatically handled by the plugin):',
        '  The plugin will automatically use your default nvm version',
        '',
        'After installation, reload VS Code or restart the extension.',
      ],
      documentationUrl: 'https://github.com/rdmind/rdmind#installation',
    };
  }
}
