/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileFilteringOptions,
  MCPServerConfig,
  OutputFormat,
} from '@rdmind/rdmind-core';
import { extensionsCommand } from '../commands/extensions.js';
import {
  ApprovalMode,
  Config,
  DEFAULT_QWEN_MODEL,
  DEFAULT_QWEN_EMBEDDING_MODEL,
  DEFAULT_MEMORY_FILE_FILTERING_OPTIONS,
  EditTool,
  FileDiscoveryService,
  getCurrentGeminiMdFilename,
  loadServerHierarchicalMemory,
  setGeminiMdFilename as setServerGeminiMdFilename,
  ShellTool,
  WriteFileTool,
  resolveTelemetrySettings,
  FatalConfigError,
} from '@rdmind/rdmind-core';
import type { Settings } from './settings.js';
import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';

import { resolvePath } from '../utils/resolvePath.js';
import { getCliVersion } from '../utils/version.js';
import type { Extension } from './extension.js';
import { annotateActiveExtensions } from './extension.js';
import { loadSandboxConfig } from './sandboxConfig.js';
import { appEvents } from '../utils/events.js';
import { mcpCommand } from '../commands/mcp.js';

import { isWorkspaceTrusted } from './trustedFolders.js';
import type { ExtensionEnablementManager } from './extensions/extensionEnablement.js';

// Simple console logger for now - replace with actual logger if available
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

const VALID_APPROVAL_MODE_VALUES = [
  'plan',
  'default',
  'auto-edit',
  'yolo',
] as const;

function formatApprovalModeError(value: string): Error {
  return new Error(
    `Invalid approval mode: ${value}. Valid values are: ${VALID_APPROVAL_MODE_VALUES.join(
      ', ',
    )}`,
  );
}

function parseApprovalModeValue(value: string): ApprovalMode {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'plan':
      return ApprovalMode.PLAN;
    case 'default':
      return ApprovalMode.DEFAULT;
    case 'yolo':
      return ApprovalMode.YOLO;
    case 'auto_edit':
    case 'autoedit':
    case 'auto-edit':
      return ApprovalMode.AUTO_EDIT;
    default:
      throw formatApprovalModeError(value);
  }
}

export interface CliArgs {
  query: string | undefined;
  model: string | undefined;
  sandbox: boolean | string | undefined;
  sandboxImage: string | undefined;
  debug: boolean | undefined;
  prompt: string | undefined;
  promptInteractive: string | undefined;
  allFiles: boolean | undefined;
  showMemoryUsage: boolean | undefined;
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
  allowedTools: string[] | undefined;
  experimentalAcp: boolean | undefined;
  extensions: string[] | undefined;
  listExtensions: boolean | undefined;
  openaiLogging: boolean | undefined;
  openaiApiKey: string | undefined;
  openaiBaseUrl: string | undefined;
  proxy: string | undefined;
  includeDirectories: string[] | undefined;
  tavilyApiKey: string | undefined;
  screenReader: boolean | undefined;
  vlmSwitchMode: string | undefined;
  useSmartEdit: boolean | undefined;
  outputFormat: string | undefined;
}

export async function parseArguments(settings: Settings): Promise<CliArgs> {
  const rawArgv = hideBin(process.argv);
  const yargsInstance = yargs(rawArgv)
    .locale('en')
    .scriptName('rdmind')
    .usage(
      '使用方法: rdmind [options] [command]\n\nRDMind - 启动交互式 CLI，使用 -p/--prompt 进入非交互模式',
    )
    .option('telemetry', {
      type: 'boolean',
      description:
        '启用遥测？控制是否发送遥测数据',
    })
    .option('telemetry-target', {
      type: 'string',
      choices: ['local', 'gcp'],
      description:
        '设置遥测目标',
    })
    .option('telemetry-otlp-endpoint', {
      type: 'string',
      description:
        '设置遥测的 OTLP 端点',
    })
    .option('telemetry-otlp-protocol', {
      type: 'string',
      choices: ['grpc', 'http'],
      description:
        '设置遥测的 OTLP 协议',
    })
    .option('telemetry-log-prompts', {
      type: 'boolean',
      description:
        '启用或禁用遥测中用户提示词的日志记录',
    })
    .option('telemetry-outfile', {
      type: 'string',
      description: '将所有遥测输出重定向到指定文件',
    })
    .deprecateOption(
      'telemetry',
      'Use the "telemetry.enabled" setting in settings.json instead. This flag will be removed in a future version.',
    )
    .deprecateOption(
      'telemetry-target',
      'Use the "telemetry.target" setting in settings.json instead. This flag will be removed in a future version.',
    )
    .deprecateOption(
      'telemetry-otlp-endpoint',
      'Use the "telemetry.otlpEndpoint" setting in settings.json instead. This flag will be removed in a future version.',
    )
    .deprecateOption(
      'telemetry-otlp-protocol',
      'Use the "telemetry.otlpProtocol" setting in settings.json instead. This flag will be removed in a future version.',
    )
    .deprecateOption(
      'telemetry-log-prompts',
      'Use the "telemetry.logPrompts" setting in settings.json instead. This flag will be removed in a future version.',
    )
    .deprecateOption(
      'telemetry-outfile',
      'Use the "telemetry.outfile" setting in settings.json instead. This flag will be removed in a future version.',
    )
    .option('debug', {
      alias: 'd',
      type: 'boolean',
      description: 'Run in debug mode?',
      default: false,
    })
    .option('proxy', {
      type: 'string',
      description:
        'Proxy for gemini client, like schema://user:password@host:port',
    })
    .deprecateOption(
      'proxy',
      'Use the "proxy" setting in settings.json instead. This flag will be removed in a future version.',
    )
    .command('$0 [query..]', '启动 RDMind', (yargsInstance: Argv) =>
      yargsInstance
        .positional('query', {
          description:
            'Positional prompt. Defaults to one-shot; use -i/--prompt-interactive for interactive.',
        })
        .option('model', {
          alias: 'm',
          type: 'string',
          description: `模型`,
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
          description: '沙盒镜像',
        })
        .option('all-files', {
          alias: ['a'],
          type: 'boolean',
          description: '上下文中包含所有文件？',
          default: false,
        })
        .option('show-memory-usage', {
          type: 'boolean',
          description: '状态栏显示使用情况？',
          default: false,
        })
        .option('yolo', {
          alias: 'y',
          type: 'boolean',
          description: '默认接受所有操作（YOLO 模式）？',
          default: false,
        })
        .option('approval-mode', {
          type: 'string',
          choices: ['plan', 'default', 'auto-edit', 'yolo'],
          description:
            '设置审批模式：plan（只做规划）、default（提示确认）、auto_edit（接受编辑）、yolo（接受所有工具）',
        })
        .option('checkpointing', {
          alias: 'c',
          type: 'boolean',
          description: '启用检查点功能',
          default: false,
        })
        .option('experimental-acp', {
          type: 'boolean',
          description: '在 ACP 模式下启动代理',
        })
        .option('allowed-mcp-server-names', {
          type: 'array',
          string: true,
          description: '允许的 MCP 服务名称',
          coerce: (mcpServerNames: string[]) =>
            // Handle comma-separated values
            mcpServerNames.flatMap((mcpServerName) =>
              mcpServerName.split(',').map((m) => m.trim()),
            ),
        })
        .option('allowed-tools', {
          type: 'array',
          string: true,
          description: '无需确认即可运行的工具',
          coerce: (tools: string[]) =>
            // Handle comma-separated values
            tools.flatMap((tool) => tool.split(',').map((t) => t.trim())),
        })
        .option('extensions', {
          alias: 'e',
          type: 'array',
          string: true,
          description:
            '要使用的扩展列表。未提供则使用所有扩展',
          coerce: (extensions: string[]) =>
            // Handle comma-separated values
            extensions.flatMap((extension) =>
              extension.split(',').map((e) => e.trim()),
            ),
        })
        .option('list-extensions', {
          alias: 'l',
          type: 'boolean',
          description: '列出所有可用扩展并退出',
        })
        .option('include-directories', {
          type: 'array',
          string: true,
          description:
            '工作区中的额外目录（逗号分隔或多个 --include-directories）',
          coerce: (dirs: string[]) =>
            // Handle comma-separated values
            dirs.flatMap((dir) => dir.split(',').map((d) => d.trim())),
        })
        .option('openai-logging', {
          type: 'boolean',
          description: '启用 OpenAI API 调用日志记录',
        })
        .option('openai-api-key', {
          type: 'string',
          description: '用于身份验证的 OpenAI API 密钥',
        })
        .option('openai-base-url', {
          type: 'string',
          description: 'OpenAI base URL',
        })
        .option('tavily-api-key', {
          type: 'string',
          description: 'Tavily API 密钥',
        })
        .option('screen-reader', {
          type: 'boolean',
          description: '启用 screen-reader',
        })
        .option('vlm-switch-mode', {
          type: 'string',
          choices: ['once', 'session', 'persist'],
          description:
            '检测到输入中包含图像时的默认行为。可选值：once（切换一次）、session（整个会话期间切换）、persist（继续使用当前模型）。会覆盖设置文件的配置',
          default: process.env['VLM_SWITCH_MODE'],
        })
        .option('output-format', {
          alias: 'o',
          type: 'string',
          description: 'The format of the CLI output.',
          choices: ['text', 'json'],
        })
        .deprecateOption(
          'show-memory-usage',
          'Use the "ui.showMemoryUsage" setting in settings.json instead. This flag will be removed in a future version.',
        )
        .deprecateOption(
          'sandbox-image',
          'Use the "tools.sandbox" setting in settings.json instead. This flag will be removed in a future version.',
        )
        .deprecateOption(
          'checkpointing',
          'Use the "general.checkpointing.enabled" setting in settings.json instead. This flag will be removed in a future version.',
        )
        .deprecateOption(
          'all-files',
          'Use @ includes in the application instead. This flag will be removed in a future version.',
        )
        .deprecateOption(
          'prompt',
          'Use the positional prompt instead. This flag will be removed in a future version.',
        )
        // Ensure validation flows through .fail() for clean UX
        .fail((msg: string, err: Error | undefined, yargs: Argv) => {
          console.error(msg || err?.message || 'Unknown error');
          yargs.showHelp();
          process.exit(1);
        })
        .check((argv: { [x: string]: unknown }) => {
          // The 'query' positional can be a string (for one arg) or string[] (for multiple).
          // This guard safely checks if any positional argument was provided.
          const query = argv['query'] as string | string[] | undefined;
          const hasPositionalQuery = Array.isArray(query)
            ? query.length > 0
            : !!query;

          if (argv['prompt'] && hasPositionalQuery) {
            return '不能同时使用位置参数提示词和 --prompt (-p) 标志';
          }
          if (argv['prompt'] && argv['promptInteractive']) {
            return '不能同时使用 --prompt (-p) 和 --prompt-interactive (-i)';
          }
          if (argv['yolo'] && argv['approvalMode']) {
            return '不能同时使用 --yolo (-y) 和 --approval-mode。请使用 --approval-mode=yolo 替代';
          }
          return true;
        }),
    )
    // Register MCP subcommands
    .command(mcpCommand);

  if (settings?.experimental?.extensionManagement ?? true) {
    yargsInstance.command(extensionsCommand);
  }

  yargsInstance
    .version(await getCliVersion()) // This will enable the --version flag based on package.json
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .strict()
    .demandCommand(0, 0); // Allow base command to run with no subcommands

  yargsInstance.wrap(yargsInstance.terminalWidth());
  const result = await yargsInstance.parse();

  // If yargs handled --help/--version it will have exited; nothing to do here.

  // Handle case where MCP subcommands are executed - they should exit the process
  // and not return to main CLI logic
  if (
    result._.length > 0 &&
    (result._[0] === 'mcp' || result._[0] === 'extensions')
  ) {
    // MCP commands handle their own execution and process exit
    process.exit(0);
  }

  // Normalize query args: handle both quoted "@path file" and unquoted @path file
  const queryArg = (result as { query?: string | string[] | undefined }).query;
  const q: string | undefined = Array.isArray(queryArg)
    ? queryArg.join(' ')
    : queryArg;

  // Route positional args: explicit -i flag -> interactive; else -> one-shot (even for @commands)
  if (q && !result['prompt']) {
    const hasExplicitInteractive =
      result['promptInteractive'] === '' || !!result['promptInteractive'];
    if (hasExplicitInteractive) {
      result['promptInteractive'] = q;
    } else {
      result['prompt'] = q;
    }
  }

  // Keep CliArgs.query as a string for downstream typing
  (result as Record<string, unknown>)['query'] = q || undefined;

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
  folderTrust: boolean,
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
    folderTrust,
    memoryImportFormat,
    fileFilteringOptions,
    settings.context?.discoveryMaxDirs,
  );
}

export function isDebugMode(argv: CliArgs): boolean {
  return (
    argv.debug ||
    [process.env['DEBUG'], process.env['DEBUG_MODE']].some(
      (v) => v === 'true' || v === '1',
    )
  );
}

export async function loadCliConfig(
  settings: Settings,
  extensions: Extension[],
  extensionEnablementManager: ExtensionEnablementManager,
  sessionId: string,
  argv: CliArgs,
  cwd: string = process.cwd(),
): Promise<Config> {
  const debugMode = isDebugMode(argv);

  const memoryImportFormat = settings.context?.importFormat || 'tree';

  const ideMode = settings.ide?.enabled ?? false;

  const folderTrust = settings.security?.folderTrust?.enabled ?? false;
  const trustedFolder = isWorkspaceTrusted(settings)?.isTrusted ?? true;

  const allExtensions = annotateActiveExtensions(
    extensions,
    cwd,
    extensionEnablementManager,
  );

  const activeExtensions = extensions.filter(
    (_, i) => allExtensions[i].isActive,
  );

  // Set the context filename in the server's memoryTool module BEFORE loading memory
  // TODO(b/343434939): This is a bit of a hack. The contextFileName should ideally be passed
  // directly to the Config constructor in core, and have core handle setGeminiMdFilename.
  // However, loadHierarchicalGeminiMemory is called *before* createServerConfig.
  if (settings.context?.fileName) {
    setServerGeminiMdFilename(settings.context.fileName);
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
    ...settings.context?.fileFiltering,
  };

  const includeDirectories = (settings.context?.includeDirectories || [])
    .map(resolvePath)
    .concat((argv.includeDirectories || []).map(resolvePath));

  // Call the (now wrapper) loadHierarchicalGeminiMemory which calls the server's version
  const { memoryContent, fileCount } = await loadHierarchicalGeminiMemory(
    cwd,
    settings.context?.loadMemoryFromIncludeDirectories
      ? includeDirectories
      : [],
    debugMode,
    fileService,
    settings,
    extensionContextFilePaths,
    trustedFolder,
    memoryImportFormat,
    fileFiltering,
  );

  let mcpServers = mergeMcpServers(settings, activeExtensions);
  const question = argv.promptInteractive || argv.prompt || '';

  // Determine approval mode with backward compatibility
  let approvalMode: ApprovalMode;
  if (argv.approvalMode) {
    approvalMode = parseApprovalModeValue(argv.approvalMode);
  } else if (argv.yolo) {
    approvalMode = ApprovalMode.YOLO;
  } else if (settings.tools?.approvalMode) {
    approvalMode = parseApprovalModeValue(settings.tools.approvalMode);
  } else {
    approvalMode = ApprovalMode.DEFAULT;
  }

  // Force approval mode to default if the folder is not trusted.
  if (
    !trustedFolder &&
    approvalMode !== ApprovalMode.DEFAULT &&
    approvalMode !== ApprovalMode.PLAN
  ) {
    logger.warn(
      `Approval mode overridden to "default" because the current folder is not trusted.`,
    );
    approvalMode = ApprovalMode.DEFAULT;
  }

  let telemetrySettings;
  try {
    telemetrySettings = await resolveTelemetrySettings({
      argv,
      env: process.env as unknown as Record<string, string | undefined>,
      settings: settings.telemetry,
    });
  } catch (err) {
    if (err instanceof FatalConfigError) {
      throw new FatalConfigError(
        `Invalid telemetry configuration: ${err.message}.`,
      );
    }
    throw err;
  }

  // Interactive mode: explicit -i flag or (TTY + no args + no -p flag)
  const hasQuery = !!argv.query;
  const interactive =
    !!argv.promptInteractive ||
    (process.stdin.isTTY && !hasQuery && !argv.prompt);
  // In non-interactive mode, exclude tools that require a prompt.
  const extraExcludes: string[] = [];
  if (!interactive && !argv.experimentalAcp) {
    switch (approvalMode) {
      case ApprovalMode.PLAN:
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
    if (settings.mcp?.allowed) {
      mcpServers = allowedMcpServers(
        mcpServers,
        settings.mcp.allowed,
        blockedMcpServers,
      );
    }

    if (settings.mcp?.excluded) {
      const excludedNames = new Set(settings.mcp.excluded.filter(Boolean));
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

  const defaultModel = DEFAULT_QWEN_MODEL;
  const resolvedModel: string =
    argv.model ||
    process.env['OPENAI_MODEL'] ||
    process.env['QWEN_MODEL'] ||
    settings.model?.name ||
    defaultModel;

  const sandboxConfig = await loadSandboxConfig(settings, argv);
  const screenReader =
    argv.screenReader !== undefined
      ? argv.screenReader
      : (settings.ui?.accessibility?.screenReader ?? false);

  const vlmSwitchMode =
    argv.vlmSwitchMode || settings.experimental?.vlmSwitchMode;
  return new Config({
    sessionId,
    embeddingModel: DEFAULT_QWEN_EMBEDDING_MODEL,
    sandbox: sandboxConfig,
    targetDir: cwd,
    includeDirectories,
    loadMemoryFromIncludeDirectories:
      settings.context?.loadMemoryFromIncludeDirectories || false,
    debugMode,
    question,
    fullContext: argv.allFiles || false,
    coreTools: settings.tools?.core || undefined,
    allowedTools: argv.allowedTools || settings.tools?.allowed || undefined,
    excludeTools,
    toolDiscoveryCommand: settings.tools?.discoveryCommand,
    toolCallCommand: settings.tools?.callCommand,
    mcpServerCommand: settings.mcp?.serverCommand,
    mcpServers,
    userMemory: memoryContent,
    geminiMdFileCount: fileCount,
    approvalMode,
    showMemoryUsage:
      argv.showMemoryUsage || settings.ui?.showMemoryUsage || false,
    accessibility: {
      ...settings.ui?.accessibility,
      screenReader,
    },
    telemetry: telemetrySettings,
    usageStatisticsEnabled: settings.privacy?.usageStatisticsEnabled ?? true,
    fileFiltering: settings.context?.fileFiltering,
    checkpointing:
      argv.checkpointing || settings.general?.checkpointing?.enabled,
    proxy:
      argv.proxy ||
      process.env['HTTPS_PROXY'] ||
      process.env['https_proxy'] ||
      process.env['HTTP_PROXY'] ||
      process.env['http_proxy'],
    cwd,
    fileDiscoveryService: fileService,
    bugCommand: settings.advanced?.bugCommand,
    model: resolvedModel,
    extensionContextFilePaths,
    sessionTokenLimit: settings.model?.sessionTokenLimit ?? -1,
    maxSessionTurns: settings.model?.maxSessionTurns ?? -1,
    experimentalZedIntegration: argv.experimentalAcp || false,
    listExtensions: argv.listExtensions || false,
    extensions: allExtensions,
    blockedMcpServers,
    noBrowser: !!process.env['NO_BROWSER'],
    authType: settings.security?.auth?.selectedType,
    generationConfig: {
      ...(settings.model?.generationConfig || {}),
      model: resolvedModel,
      apiKey: argv.openaiApiKey || process.env['OPENAI_API_KEY'],
      baseUrl: argv.openaiBaseUrl || process.env['OPENAI_BASE_URL'],
      enableOpenAILogging:
        (typeof argv.openaiLogging === 'undefined'
          ? settings.model?.enableOpenAILogging
          : argv.openaiLogging) ?? false,
    },
    cliVersion: await getCliVersion(),
    tavilyApiKey:
      argv.tavilyApiKey ||
      settings.advanced?.tavilyApiKey ||
      process.env['TAVILY_API_KEY'],
    summarizeToolOutput: settings.model?.summarizeToolOutput,
    ideMode,
    chatCompression: settings.model?.chatCompression,
    folderTrust,
    interactive,
    trustedFolder,
    useRipgrep: settings.tools?.useRipgrep,
    shouldUseNodePtyShell: settings.tools?.shell?.enableInteractiveShell,
    skipNextSpeakerCheck: settings.model?.skipNextSpeakerCheck,
    enablePromptCompletion: settings.general?.enablePromptCompletion ?? false,
    skipLoopDetection: settings.model?.skipLoopDetection ?? false,
    vlmSwitchMode,
    truncateToolOutputThreshold: settings.tools?.truncateToolOutputThreshold,
    truncateToolOutputLines: settings.tools?.truncateToolOutputLines,
    enableToolOutputTruncation: settings.tools?.enableToolOutputTruncation,
    eventEmitter: appEvents,
    useSmartEdit: argv.useSmartEdit ?? settings.useSmartEdit,
    output: {
      format: (argv.outputFormat ?? settings.output?.format) as OutputFormat,
    },
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
    ...(settings.tools?.exclude || []),
    ...(extraExcludes || []),
  ]);
  for (const extension of extensions) {
    for (const tool of extension.config.excludeTools || []) {
      allExcludeTools.add(tool);
    }
  }
  return [...allExcludeTools];
}
