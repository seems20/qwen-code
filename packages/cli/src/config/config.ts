/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'node:os';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import process from 'node:process';
import { mcpCommand } from '../commands/mcp.js';
import {
  Config,
  loadServerHierarchicalMemory,
  setGeminiMdFilename as setServerGeminiMdFilename,
  getCurrentGeminiMdFilename,
  ApprovalMode,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  DEFAULT_MEMORY_FILE_FILTERING_OPTIONS,
  FileDiscoveryService,
  TelemetryTarget,
  FileFilteringOptions,
  ShellTool,
  EditTool,
  WriteFileTool,
  MCPServerConfig,
  ConfigParameters,
} from '@qwen-code/qwen-code-core';
import { Settings } from './settings.js';

import { Extension, annotateActiveExtensions } from './extension.js';
import { getCliVersion } from '../utils/version.js';
import { loadSandboxConfig } from './sandboxConfig.js';
import { resolvePath } from '../utils/resolvePath.js';

import { isWorkspaceTrusted } from './trustedFolders.js';

// Simple console logger for now - replace with actual logger if available
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

export interface CliArgs {
  model: string | undefined;
  sandbox: boolean | string | undefined;
  sandboxImage: string | undefined;
  debug: boolean | undefined;
  prompt: string | undefined;
  promptInteractive: string | undefined;
  allFiles: boolean | undefined;
  all_files: boolean | undefined;
  showMemoryUsage: boolean | undefined;
  show_memory_usage: boolean | undefined;
  yolo: boolean | undefined;
  approvalMode: string | undefined;
  telemetry: boolean | undefined;
  checkpointing: boolean | undefined;
  telemetryTarget: string | undefined;
  telemetryOtlpEndpoint: string | undefined;
  telemetryOtlpProtocol: string | undefined;
  telemetryLogPrompts: boolean | undefined;
  telemetryOutfile: string | undefined;
  allowedMcpServerNames: string[] | undefined;
  experimentalAcp: boolean | undefined;
  extensions: string[] | undefined;
  listExtensions: boolean | undefined;
  openaiLogging: boolean | undefined;
  openaiApiKey: string | undefined;
  openaiBaseUrl: string | undefined;
  proxy: string | undefined;
  includeDirectories: string[] | undefined;
  tavilyApiKey: string | undefined;
}

export async function parseArguments(): Promise<CliArgs> {
  const yargsInstance = yargs(hideBin(process.argv))
    // Set locale to English for consistent output, especially in tests
    .locale('en')
    .scriptName('rdmind')
    .usage(
      '使用方法: rdmind [选项] [命令]\n\nRDMind - 启动交互式 CLI，使用 -p/--prompt 进入非交互模式',
    )
    .command('$0', '启动 RDMind', (yargsInstance) =>
      yargsInstance
        .option('model', {
          alias: 'm',
          type: 'string',
          description: `模型`,
          default: process.env['GEMINI_MODEL'],
        })
        .option('prompt', {
          alias: 'p',
          type: 'string',
          description: '提示词',
        })
        .option('prompt-interactive', {
          alias: 'i',
          type: 'string',
          description: '根据提供的提示词执行并继续交互模式',
        })
        .option('sandbox', {
          alias: 's',
          type: 'boolean',
          description: '在沙盒中运行？',
        })
        .option('sandbox-image', {
          type: 'string',
          description: '沙盒镜像 URI',
        })
        .option('debug', {
          alias: 'd',
          type: 'boolean',
          description: '在调试模式下运行？',
          default: false,
        })
        .option('all-files', {
          alias: ['a'],
          type: 'boolean',
          description: '在上下文中包含所有文件？',
          default: false,
        })
        .option('all_files', {
          type: 'boolean',
          description: '在上下文中包含所有文件？',
          default: false,
        })
        .deprecateOption(
          'all_files',
          '请使用 --all-files 替代。将在未来删除 --all_files 选项。',
        )
        .option('show-memory-usage', {
          type: 'boolean',
          description: '在状态栏显示使用情况',
          default: false,
        })
        .option('show_memory_usage', {
          type: 'boolean',
          description: '在状态栏显示使用情况',
          default: false,
        })
        .deprecateOption(
          'show_memory_usage',
          '请使用 --show-memory-usage 替代。将在未来几周内删除 --show_memory_usage 选项。',
        )
        .option('yolo', {
          alias: 'y',
          type: 'boolean',
          description: '自动接受所有操作（YOLO 模式）？',
          default: false,
        })
        .option('approval-mode', {
          type: 'string',
          choices: ['default', 'auto_edit', 'yolo'],
          description:
            '设置审批模式：default（提示确认）、auto_edit（自动批准编辑工具）、yolo（自动批准所有工具）',
        })
        .option('telemetry', {
          type: 'boolean',
          description:
            '启用遥测？此标志专门控制是否发送遥测数据。其他 --telemetry-* 标志设置特定值但不会独立启用遥测。',
        })
        .option('telemetry-target', {
          type: 'string',
          choices: ['local', 'gcp'],
          description: '设置遥测目标（local 或 gcp）。覆盖设置文件。',
        })
        .option('telemetry-otlp-endpoint', {
          type: 'string',
          description: '设置遥测的 OTLP 端点。覆盖环境变量和设置文件。',
        })
        .option('telemetry-otlp-protocol', {
          type: 'string',
          choices: ['grpc', 'http'],
          description: '设置遥测的 OTLP 协议（grpc 或 http）。覆盖设置文件。',
        })
        .option('telemetry-log-prompts', {
          type: 'boolean',
          description: '启用或禁用遥测中用户提示词的日志记录。覆盖设置文件。',
        })
        .option('telemetry-outfile', {
          type: 'string',
          description: '将所有遥测输出重定向到指定文件。',
        })
        .option('checkpointing', {
          alias: 'c',
          type: 'boolean',
          description: '启用文件编辑的检查点功能',
          default: false,
        })
        .option('experimental-acp', {
          type: 'boolean',
          description: '在 ACP 模式下启动代理',
        })
        .option('allowed-mcp-server-names', {
          type: 'array',
          string: true,
          description: '允许的 MCP 服务器名称',
        })
        .option('extensions', {
          alias: 'e',
          type: 'array',
          string: true,
          description: '要使用的扩展列表。如果未提供，将使用所有扩展。',
        })
        .option('list-extensions', {
          alias: 'l',
          type: 'boolean',
          description: '列出所有可用扩展并退出。',
        })
        .option('proxy', {
          type: 'string',
          description: '客户端代理，格式如 schema://user:password@host:port',
        })
        .option('include-directories', {
          type: 'array',
          string: true,
          description:
            '要包含工作区中的额外目录（逗号分隔或多个 --include-directories）',
          coerce: (dirs: string[]) =>
            // Handle comma-separated values
            dirs.flatMap((dir) => dir.split(',').map((d) => d.trim())),
        })
        .option('openai-logging', {
          type: 'boolean',
          description: '启用 OpenAI API 调用日志记录以进行调试和分析',
        })
        .option('openai-api-key', {
          type: 'string',
          description: '用于身份验证的 OpenAI API 密钥',
        })
        .option('openai-base-url', {
          type: 'string',
          description: 'OpenAI 基础 URL（用于自定义端点）',
        })
        .option('tavily-api-key', {
          type: 'string',
          description: '用于网络搜索功能的 Tavily API 密钥',
        })

        .check((argv) => {
          if (argv.prompt && argv['promptInteractive']) {
            throw new Error(
              '不能同时使用 --prompt (-p) 和 --prompt-interactive (-i)',
            );
          }
          if (argv.yolo && argv['approvalMode']) {
            throw new Error(
              '不能同时使用 --yolo (-y) 和 --approval-mode。请使用 --approval-mode=yolo 替代。',
            );
          }
          return true;
        }),
    )
    // Register MCP subcommands
    .command(mcpCommand)
    .version(await getCliVersion()) // This will enable the --version flag based on package.json
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .strict()
    .demandCommand(0, 0); // Allow base command to run with no subcommands

  yargsInstance.wrap(yargsInstance.terminalWidth());
  const result = await yargsInstance.parse();

  // Handle case where MCP subcommands are executed - they should exit the process
  // and not return to main CLI logic
  if (result._.length > 0 && result._[0] === 'mcp') {
    // MCP commands handle their own execution and process exit
    process.exit(0);
  }

  // The import format is now only controlled by settings.memoryImportFormat
  // We no longer accept it as a CLI argument
  return result as unknown as CliArgs;
}

// This function is now a thin wrapper around the server's implementation.
// It's kept in the CLI for now as App.tsx directly calls it for memory refresh.
// TODO: Consider if App.tsx should get memory via a server call or if Config should refresh itself.
export async function loadHierarchicalGeminiMemory(
  currentWorkingDirectory: string,
  includeDirectoriesToReadGemini: readonly string[] = [],
  debugMode: boolean,
  fileService: FileDiscoveryService,
  settings: Settings,
  extensionContextFilePaths: string[] = [],
  memoryImportFormat: 'flat' | 'tree' = 'tree',
  fileFilteringOptions?: FileFilteringOptions,
): Promise<{ memoryContent: string; fileCount: number }> {
  // FIX: Use real, canonical paths for a reliable comparison to handle symlinks.
  const realCwd = fs.realpathSync(path.resolve(currentWorkingDirectory));
  const realHome = fs.realpathSync(path.resolve(homedir()));
  const isHomeDirectory = realCwd === realHome;

  // If it is the home directory, pass an empty string to the core memory
  // function to signal that it should skip the workspace search.
  const effectiveCwd = isHomeDirectory ? '' : currentWorkingDirectory;

  if (debugMode) {
    logger.debug(
      `CLI: Delegating hierarchical memory load to server for CWD: ${currentWorkingDirectory} (memoryImportFormat: ${memoryImportFormat})`,
    );
  }

  // Directly call the server function with the corrected path.
  return loadServerHierarchicalMemory(
    effectiveCwd,
    includeDirectoriesToReadGemini,
    debugMode,
    fileService,
    extensionContextFilePaths,
    memoryImportFormat,
    fileFilteringOptions,
    settings.memoryDiscoveryMaxDirs,
  );
}

export async function loadCliConfig(
  settings: Settings,
  extensions: Extension[],
  sessionId: string,
  argv: CliArgs,
  cwd: string = process.cwd(),
): Promise<Config> {
  const debugMode =
    argv.debug ||
    [process.env['DEBUG'], process.env['DEBUG_MODE']].some(
      (v) => v === 'true' || v === '1',
    ) ||
    false;
  const memoryImportFormat = settings.memoryImportFormat || 'tree';

  const ideMode = settings.ideMode ?? false;

  const folderTrustFeature = settings.folderTrustFeature ?? false;
  const folderTrustSetting = settings.folderTrust ?? true;
  const folderTrust = folderTrustFeature && folderTrustSetting;
  const trustedFolder = isWorkspaceTrusted(settings);

  const allExtensions = annotateActiveExtensions(
    extensions,
    argv.extensions || [],
  );

  const activeExtensions = extensions.filter(
    (_, i) => allExtensions[i].isActive,
  );
  // Handle OpenAI API key from command line
  if (argv.openaiApiKey) {
    process.env['OPENAI_API_KEY'] = argv.openaiApiKey;
  }

  // Handle OpenAI base URL from command line
  if (argv.openaiBaseUrl) {
    process.env['OPENAI_BASE_URL'] = argv.openaiBaseUrl;
  }

  // Handle Tavily API key from command line
  if (argv.tavilyApiKey) {
    process.env['TAVILY_API_KEY'] = argv.tavilyApiKey;
  }

  // Set the context filename in the server's memoryTool module BEFORE loading memory
  // TODO(b/343434939): This is a bit of a hack. The contextFileName should ideally be passed
  // directly to the Config constructor in core, and have core handle setGeminiMdFilename.
  // However, loadHierarchicalGeminiMemory is called *before* createServerConfig.
  if (settings.contextFileName) {
    setServerGeminiMdFilename(settings.contextFileName);
  } else {
    // Reset to default if not provided in settings.
    setServerGeminiMdFilename(getCurrentGeminiMdFilename());
  }

  const extensionContextFilePaths = activeExtensions.flatMap(
    (e) => e.contextFiles,
  );

  const fileService = new FileDiscoveryService(cwd);

  const fileFiltering = {
    ...DEFAULT_MEMORY_FILE_FILTERING_OPTIONS,
    ...settings.fileFiltering,
  };

  const includeDirectories = (settings.includeDirectories || [])
    .map(resolvePath)
    .concat((argv.includeDirectories || []).map(resolvePath));

  // Call the (now wrapper) loadHierarchicalGeminiMemory which calls the server's version
  const { memoryContent, fileCount } = await loadHierarchicalGeminiMemory(
    cwd,
    settings.loadMemoryFromIncludeDirectories ? includeDirectories : [],
    debugMode,
    fileService,
    settings,
    extensionContextFilePaths,
    memoryImportFormat,
    fileFiltering,
  );

  let mcpServers = mergeMcpServers(settings, activeExtensions);
  const question = argv.promptInteractive || argv.prompt || '';

  // Determine approval mode with backward compatibility
  let approvalMode: ApprovalMode;
  if (argv.approvalMode) {
    // New --approval-mode flag takes precedence
    switch (argv.approvalMode) {
      case 'yolo':
        approvalMode = ApprovalMode.YOLO;
        break;
      case 'auto_edit':
        approvalMode = ApprovalMode.AUTO_EDIT;
        break;
      case 'default':
        approvalMode = ApprovalMode.DEFAULT;
        break;
      default:
        throw new Error(
          `Invalid approval mode: ${argv.approvalMode}. Valid values are: yolo, auto_edit, default`,
        );
    }
  } else {
    // Fallback to legacy --yolo flag behavior
    approvalMode =
      argv.yolo || false ? ApprovalMode.YOLO : ApprovalMode.DEFAULT;
  }

  const interactive =
    !!argv.promptInteractive || (process.stdin.isTTY && question.length === 0);
  // In non-interactive mode, exclude tools that require a prompt.
  const extraExcludes: string[] = [];
  if (!interactive && !argv.experimentalAcp) {
    switch (approvalMode) {
      case ApprovalMode.DEFAULT:
        // In default non-interactive mode, all tools that require approval are excluded.
        extraExcludes.push(ShellTool.Name, EditTool.Name, WriteFileTool.Name);
        break;
      case ApprovalMode.AUTO_EDIT:
        // In auto-edit non-interactive mode, only tools that still require a prompt are excluded.
        extraExcludes.push(ShellTool.Name);
        break;
      case ApprovalMode.YOLO:
        // No extra excludes for YOLO mode.
        break;
      default:
        // This should never happen due to validation earlier, but satisfies the linter
        break;
    }
  }

  const excludeTools = mergeExcludeTools(
    settings,
    activeExtensions,
    extraExcludes.length > 0 ? extraExcludes : undefined,
  );
  const blockedMcpServers: Array<{ name: string; extensionName: string }> = [];

  if (!argv.allowedMcpServerNames) {
    if (settings.allowMCPServers) {
      mcpServers = allowedMcpServers(
        mcpServers,
        settings.allowMCPServers,
        blockedMcpServers,
      );
    }

    if (settings.excludeMCPServers) {
      const excludedNames = new Set(settings.excludeMCPServers.filter(Boolean));
      if (excludedNames.size > 0) {
        mcpServers = Object.fromEntries(
          Object.entries(mcpServers).filter(([key]) => !excludedNames.has(key)),
        );
      }
    }
  }

  if (argv.allowedMcpServerNames) {
    mcpServers = allowedMcpServers(
      mcpServers,
      argv.allowedMcpServerNames,
      blockedMcpServers,
    );
  }

  const sandboxConfig = await loadSandboxConfig(settings, argv);
  const cliVersion = await getCliVersion();

  return new Config({
    sessionId,
    embeddingModel: DEFAULT_GEMINI_EMBEDDING_MODEL,
    sandbox: sandboxConfig,
    targetDir: cwd,
    includeDirectories,
    loadMemoryFromIncludeDirectories:
      settings.loadMemoryFromIncludeDirectories || false,
    debugMode,
    question,
    fullContext: argv.allFiles || argv.all_files || false,
    coreTools: settings.coreTools || undefined,
    excludeTools,
    toolDiscoveryCommand: settings.toolDiscoveryCommand,
    toolCallCommand: settings.toolCallCommand,
    mcpServerCommand: settings.mcpServerCommand,
    mcpServers,
    userMemory: memoryContent,
    geminiMdFileCount: fileCount,
    approvalMode,
    showMemoryUsage:
      argv.showMemoryUsage ||
      argv.show_memory_usage ||
      settings.showMemoryUsage ||
      false,
    accessibility: settings.accessibility,
    telemetry: {
      enabled: argv.telemetry ?? settings.telemetry?.enabled,
      target: (argv.telemetryTarget ??
        settings.telemetry?.target) as TelemetryTarget,
      otlpEndpoint:
        argv.telemetryOtlpEndpoint ??
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ??
        settings.telemetry?.otlpEndpoint,
      otlpProtocol: (['grpc', 'http'] as const).find(
        (p) =>
          p ===
          (argv.telemetryOtlpProtocol ?? settings.telemetry?.otlpProtocol),
      ),
      logPrompts: argv.telemetryLogPrompts ?? settings.telemetry?.logPrompts,
      outfile: argv.telemetryOutfile ?? settings.telemetry?.outfile,
    },
    usageStatisticsEnabled: settings.usageStatisticsEnabled ?? true,
    // Git-aware file filtering settings
    fileFiltering: {
      respectGitIgnore: settings.fileFiltering?.respectGitIgnore,
      respectGeminiIgnore: settings.fileFiltering?.respectGeminiIgnore,
      enableRecursiveFileSearch:
        settings.fileFiltering?.enableRecursiveFileSearch,
    },
    checkpointing: argv.checkpointing || settings.checkpointing?.enabled,
    proxy:
      argv.proxy ||
      process.env['HTTPS_PROXY'] ||
      process.env['https_proxy'] ||
      process.env['HTTP_PROXY'] ||
      process.env['http_proxy'],
    cwd,
    fileDiscoveryService: fileService,
    bugCommand: settings.bugCommand,
    model: argv.model || settings.model || DEFAULT_GEMINI_MODEL,
    extensionContextFilePaths,
    maxSessionTurns: settings.maxSessionTurns ?? -1,
    sessionTokenLimit: settings.sessionTokenLimit ?? -1,
    experimentalZedIntegration: argv.experimentalAcp || false,
    listExtensions: argv.listExtensions || false,
    extensions: allExtensions,
    blockedMcpServers,
    noBrowser: !!process.env['NO_BROWSER'],
    summarizeToolOutput: settings.summarizeToolOutput,
    ideMode,
    enableOpenAILogging:
      (typeof argv.openaiLogging === 'undefined'
        ? settings.enableOpenAILogging
        : argv.openaiLogging) ?? false,
    systemPromptMappings: (settings.systemPromptMappings ?? [
      {
        baseUrls: [
          'https://dashscope.aliyuncs.com/compatible-mode/v1/',
          'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/',
        ],
        modelNames: ['qwen3-coder-plus'],
        template:
          'SYSTEM_TEMPLATE:{"name":"qwen3_coder","params":{"is_git_repository":{RUNTIME_VARS_IS_GIT_REPO},"sandbox":"{RUNTIME_VARS_SANDBOX}"}}',
      },
    ]) as ConfigParameters['systemPromptMappings'],
    authType: settings.selectedAuthType,
    contentGenerator: settings.contentGenerator,
    // contentGenerator: {
    //   ...settings.contentGenerator,
    //   samplingParams: {
    //     temperature: 0.7,
    //     top_p: 0.8,
    //     top_k: 20,
    //     repetition_penalty: 1.05,
    //     ...settings.contentGenerator?.samplingParams,
    //   },
    // },
    cliVersion,
    tavilyApiKey:
      argv.tavilyApiKey ||
      settings.tavilyApiKey ||
      process.env['TAVILY_API_KEY'],
    chatCompression: settings.chatCompression,
    folderTrustFeature,
    folderTrust,
    interactive,
    trustedFolder,
    shouldUseNodePtyShell: settings.shouldUseNodePtyShell,
    skipNextSpeakerCheck: settings.skipNextSpeakerCheck,
  });
}

function allowedMcpServers(
  mcpServers: { [x: string]: MCPServerConfig },
  allowMCPServers: string[],
  blockedMcpServers: Array<{ name: string; extensionName: string }>,
) {
  const allowedNames = new Set(allowMCPServers.filter(Boolean));
  if (allowedNames.size > 0) {
    mcpServers = Object.fromEntries(
      Object.entries(mcpServers).filter(([key, server]) => {
        const isAllowed = allowedNames.has(key);
        if (!isAllowed) {
          blockedMcpServers.push({
            name: key,
            extensionName: server.extensionName || '',
          });
        }
        return isAllowed;
      }),
    );
  } else {
    blockedMcpServers.push(
      ...Object.entries(mcpServers).map(([key, server]) => ({
        name: key,
        extensionName: server.extensionName || '',
      })),
    );
    mcpServers = {};
  }
  return mcpServers;
}

function mergeMcpServers(settings: Settings, extensions: Extension[]) {
  const mcpServers = { ...(settings.mcpServers || {}) };
  for (const extension of extensions) {
    Object.entries(extension.config.mcpServers || {}).forEach(
      ([key, server]) => {
        if (mcpServers[key]) {
          logger.warn(
            `Skipping extension MCP config for server with key "${key}" as it already exists.`,
          );
          return;
        }
        mcpServers[key] = {
          ...server,
          extensionName: extension.config.name,
        };
      },
    );
  }
  return mcpServers;
}

function mergeExcludeTools(
  settings: Settings,
  extensions: Extension[],
  extraExcludes?: string[] | undefined,
): string[] {
  const allExcludeTools = new Set([
    ...(settings.excludeTools || []),
    ...(extraExcludes || []),
  ]);
  for (const extension of extensions) {
    for (const tool of extension.config.excludeTools || []) {
      allExcludeTools.add(tool);
    }
  }
  return [...allExcludeTools];
}
