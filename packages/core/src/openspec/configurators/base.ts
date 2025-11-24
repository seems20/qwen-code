/**
 * @license
 * Copyright 2025 RDMind
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Base interface for AI tool configurators
 */
export interface ToolConfigurator {
  /** Display name for the AI tool */
  name: string;

  /** Configuration file name (if any) */
  configFileName?: string;

  /** Whether this tool is available for configuration */
  isAvailable: boolean;

  /**
   * Configure the AI tool integration
   * @param projectPath - The path to the project root
   * @param openspecDir - The path to the openspec directory
   */
  configure(projectPath: string, openspecDir: string): Promise<void>;
}

/**
 * Base interface for slash command configurators
 */
export interface SlashCommandConfigurator {
  /** Unique identifier for the tool */
  readonly toolId: string;

  /** Whether this tool is available */
  readonly isAvailable: boolean;

  /**
   * Generate all slash command files for this tool
   */
  generateAll(projectPath: string, openspecDir: string): Promise<void>;

  /**
   * Get all available slash command targets
   */
  getTargets(): SlashCommandTarget[];

  /**
   * Resolve the absolute path for a command target
   */
  resolveAbsolutePath(projectPath: string, targetId: string): string;
}

/**
 * Represents a slash command target file
 */
export interface SlashCommandTarget {
  id: string;
  relativePath: string;
  description: string;
}

/**
 * Available slash command types
 */
export type SlashCommandId = 'proposal' | 'apply' | 'archive';
