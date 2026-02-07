/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
  type SlashCommandActionReturn,
} from './types.js';
import { MessageType } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createDebugLogger } from '@rdmind/rdmind-core';

const debugLogger = createDebugLogger('createCommand');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 验证项目名称
 */
function validateProjectName(name: string): boolean {
  // 项目名只允许字母、数字、连字符，不能以连字符开头或结尾
  return /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(name);
}

/**
 * 验证IDL项目名称（需要符合Java包名规范）
 */
function validateIdlProjectName(name: string): boolean {
  // Java包名规范：
  // 1. 只能包含小写字母、数字、连字符和下划线
  // 2. 不能包含其他特殊符号（点等）
  // 3. 不能以数字、连字符或下划线开头
  return /^[a-z][a-z0-9_-]*$|^[a-z]$/.test(name);
}

/**
 * 获取IDL示例路径
 */
function getIdlExamplePath(): string {
  // 尝试多个可能的模板位置
  const possiblePaths = [
    // 1. npm 发布：
    // __dirname 就是 node_modules/@rdmind/rdmind/
    // 模板在 node_modules/@rdmind/rdmind/templates/
    path.join(__dirname, 'templates', 'idl-template/wiki/example'),

    // 2. 开发环境：相对于工作区根目录的idl-template
    path.join(
      __dirname,
      '..',
      'packages/cli/templates/idl-template/wiki/example',
    ),
  ];

  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }

  // 如果都找不到，返回默认路径（会在后续检查中报错）
  return path.join(process.cwd(), 'idl-template');
}

/**
 * 获取脚手架模板路径
 */
function getTemplatePath(): string {
  // 尝试多个可能的模板位置
  const possiblePaths = [
    // 1. npm 安装
    // __dirname 就是 node_modules/@rdmind/rdmind/
    // 模板在 node_modules/@rdmind/rdmind/template/
    path.join(__dirname, 'template'),

    // 2. 开发环境：
    path.join(__dirname, '..', 'packages/cli/template'),
  ];

  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }

  // 如果都找不到，返回默认路径（会在后续检查中报错）
  return path.join(process.cwd(), 'sns-demo');
}

/**
 * 替换IDL项目名称相关的内容
 */
function replaceIdlProjectNames(
  content: string,
  oldName: string,
  newName: string,
): string {
  // 生成 artifactId：将下划线转为连字符，并去除 _idl 或 -idl 后缀
  // 例如：angelos_idl -> angelos-api, angelos-idl -> angelos-api
  //      angelos_admin_idl -> angelos-admin-api, angelos-admin-idl -> angelos-admin-api
  const artifactId = newName.replace(/[-_]idl$/, '').replace(/_/g, '-');

  // 生成包名/namespace 用的名称：去除 _idl 或 -idl 后缀
  // 例如：angelos_idl -> angelos, angelos-idl -> angelos
  //      angelos_admin_idl -> angelos_admin, angelos-admin-idl -> angelos-admin
  const packageName = newName.replace(/[-_]idl$/, '');

  return (
    content
      // 处理 demo-api artifactId
      .replace(
        new RegExp(`<artifactId>${oldName}-api</artifactId>`, 'g'),
        `<artifactId>${artifactId}-api</artifactId>`,
      )
      .replace(
        new RegExp(`<artifactId>${oldName}</artifactId>`, 'g'),
        `<artifactId>${artifactId}</artifactId>`,
      )
      // 处理 demo 相关的包名（com.xiaohongshu.sns.demo.api.*）
      .replace(
        new RegExp(`com\\.xiaohongshu\\.sns\\.demo`, 'g'),
        `com.xiaohongshu.sns.${packageName}`,
      )
      // 处理 demo 目录名和引用
      .replace(new RegExp(`/demo/`, 'g'), `/${packageName}/`)
      // 处理 hello 相关的包名和类名
      .replace(
        new RegExp(`com\\.xiaohongshu\\.sns\\.rpc\\.${oldName}`, 'g'),
        `com.xiaohongshu.sns.rpc.${packageName}`,
      )
      .replace(new RegExp(`${oldName}Service`, 'g'), `${packageName}Service`)
      .replace(new RegExp(`${oldName}Request`, 'g'), `${packageName}Request`)
      .replace(new RegExp(`${oldName}Response`, 'g'), `${packageName}Response`)
      // 处理 hello 相关的文件名和引用
      .replace(new RegExp(oldName, 'g'), packageName)
  );
}

/**
 * 替换项目名称相关的内容
 */
function replaceProjectNames(
  content: string,
  oldName: string,
  newName: string,
  businessModule: string,
): string {
  // 从项目名中提取包名部分（去掉业务模块前缀，并将连字符转换为点）
  const projectPrefix = `${businessModule}-`;
  const packageName = newName.startsWith(projectPrefix)
    ? newName.substring(projectPrefix.length).replace(/-/g, '.')
    : newName.replace(/-/g, '.');

  return (
    content
      // 先处理包含 sns.demo 的特定模式，将sns替换为业务模块，demo替换为包名部分（用点分隔）
      .replace(
        /com\.xiaohongshu\.sns\.demo/g,
        `com.xiaohongshu.${businessModule}.${packageName}`,
      )
      // 处理一般的 com.xiaohongshu.sns 模式，替换为新的业务模块
      .replace(/com\.xiaohongshu\.sns/g, `com.xiaohongshu.${businessModule}`)
      // 处理 logger name
      .replace(
        /<logger name="com\.xiaohongshu\.sns"/g,
        `<logger name="com.xiaohongshu.${businessModule}"`,
      )
      .replace(
        /<artifactId>sns-demo-parent<\/artifactId>/g,
        `<artifactId>${newName}-parent</artifactId>`,
      )
      .replace(
        /<artifactId>sns-demo-([^<]+)<\/artifactId>/g,
        `<artifactId>${newName}-$1</artifactId>`,
      )
      .replace(
        /<artifactId>sns-demo<\/artifactId>/g,
        `<artifactId>${newName}</artifactId>`,
      )
      .replace(/<name>sns-demo<\/name>/g, `<name>${newName}</name>`)
      .replace(/<name>sns-demo-([^<]+)<\/name>/g, `<name>${newName}-$1</name>`)
      .replace(
        /<module>sns-demo-([^<]+)<\/module>/g,
        `<module>${newName}-$1</module>`,
      )
      .replace(
        /<artifactId>\${projectName}-([^<]+)<\/artifactId>/g,
        `<artifactId>${newName}-$1</artifactId>`,
      )
      .replace(
        /spring\.application\.name=sns-demo/g,
        `spring.application.name=${newName}`,
      )
      .replace(
        /spring\.application\.name:\s*sns-demo/g,
        `spring.application.name: ${newName}`,
      )
      // 最后处理一般的 sns-demo 替换
      .replace(/sns-demo/g, newName)
  );
}

/**
 * 复制单个文件并替换内容
 */
async function copyAndReplaceFile(
  srcFile: string,
  destFile: string,
  oldName: string,
  newName: string,
  businessModule: string,
  isIdlProject: boolean = false,
): Promise<void> {
  // 确保目标目录存在
  const destDir = path.dirname(destFile);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 读取源文件内容
  const content = fs.readFileSync(srcFile, 'utf8');

  // 根据项目类型选择替换函数
  let newContent;
  if (isIdlProject) {
    newContent = replaceIdlProjectNames(content, oldName, newName);
  } else {
    newContent = replaceProjectNames(content, oldName, newName, businessModule);
  }

  // 写入目标文件
  fs.writeFileSync(destFile, newContent, 'utf8');
}

/**
 * 判断是否应该跳过某个文件或目录
 */
function shouldSkipItem(itemName: string): boolean {
  const skipPatterns = [
    // Maven 构建产物
    'target',

    // IDE 配置文件
    '.idea',
    '.vscode',
    '*.iml',

    // Node.js
    'node_modules',

    // 系统文件
    '.DS_Store',
    'Thumbs.db',

    // Git
    '.git',

    // 其他常见的临时文件
    '*.tmp',
    '*.temp',
    '*.log',
  ];

  // 检查完全匹配
  if (skipPatterns.includes(itemName)) {
    return true;
  }

  // 检查模式匹配（简单的通配符支持）
  for (const pattern of skipPatterns) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(itemName)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 递归复制目录并替换名称
 */
async function copyAndReplaceDir(
  srcDir: string,
  destDir: string,
  oldName: string,
  newName: string,
  businessModule: string,
  isIdlProject: boolean = false,
): Promise<void> {
  // 确保目标目录存在
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 读取源目录内容
  const items = fs.readdirSync(srcDir);

  for (const item of items) {
    const srcPath = path.join(srcDir, item);

    // 跳过不应该包含在脚手架中的文件和目录
    if (shouldSkipItem(item)) {
      continue;
    }

    let destItemName = item;

    // 处理不同类型的名称替换
    if (item === 'demo' && isIdlProject) {
      // IDL 项目：将 demo 目录替换为用户提供的项目名
      destItemName = newName;

      // 如果包名包含连字符，需要创建多层目录结构
      if (newName.includes('-')) {
        const pathParts = newName.split('-');
        const currentDestPath = destDir;

        // 创建多层目录结构
        for (let i = 0; i < pathParts.length; i++) {
          const partPath = path.join(
            currentDestPath,
            ...pathParts.slice(0, i + 1),
          );
          if (i === pathParts.length - 1) {
            // 最后一层，复制内容
            await copyAndReplaceDir(
              srcPath,
              partPath,
              oldName,
              newName,
              businessModule,
              isIdlProject,
            );
          } else {
            // 中间层，只创建目录
            if (!fs.existsSync(partPath)) {
              fs.mkdirSync(partPath, { recursive: true });
            }
          }
        }
        continue; // 跳过后续处理
      }
    } else if (item === 'demo') {
      // 非 IDL 项目：特殊处理，将 demo 目录替换为项目名去掉业务模块前缀后的部分
      // 对于包结构，需要处理连字符：如sns-circle变成circle，sns-user-service变成user-service
      const projectPrefix = `${businessModule}-`;
      const packageDirName = newName.startsWith(projectPrefix)
        ? newName.substring(projectPrefix.length)
        : newName;
      destItemName = packageDirName;

      // 如果包名包含连字符，需要创建多层目录结构
      if (packageDirName.includes('-')) {
        const pathParts = packageDirName.split('-');
        const currentDestPath = destDir;

        // 创建多层目录结构
        for (let i = 0; i < pathParts.length; i++) {
          const partPath = path.join(
            currentDestPath,
            ...pathParts.slice(0, i + 1),
          );
          if (i === pathParts.length - 1) {
            // 最后一层，复制内容
            await copyAndReplaceDir(
              srcPath,
              partPath,
              oldName,
              newName,
              businessModule,
              isIdlProject,
            );
          } else {
            // 中间层，只创建目录
            if (!fs.existsSync(partPath)) {
              fs.mkdirSync(partPath, { recursive: true });
            }
          }
        }
        continue; // 跳过后续处理
      }
    } else if (item === 'sns') {
      // 特殊处理：将 sns 目录替换为新的业务模块名
      destItemName = businessModule;
    } else {
      // 使用与文件内容替换相同的逻辑
      if (isIdlProject) {
        const packageName = newName.replace(/[-_]idl$/, '');
        destItemName = item.replace(/demo/g, packageName);
      } else {
        destItemName = item.replace(/sns-demo/g, newName);
      }
    }

    const destPath = path.join(destDir, destItemName);

    const stats = fs.statSync(srcPath);

    if (stats.isDirectory()) {
      // 递归复制目录
      await copyAndReplaceDir(
        srcPath,
        destPath,
        oldName,
        newName,
        businessModule,
        isIdlProject,
      );
    } else if (stats.isFile()) {
      // 复制并替换文件内容
      await copyAndReplaceFile(
        srcPath,
        destPath,
        oldName,
        newName,
        businessModule,
        isIdlProject,
      );
    }
  }
}

/**
 * 创建Java项目
 */
async function createJavaProject(
  context: CommandContext,
  projectName: string,
  businessModule: string,
): Promise<void> {
  // 获取模板路径
  const templatePath = getTemplatePath();

  // 检查模板是否存在
  if (!fs.existsSync(templatePath)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ Java脚手架模板不存在：${templatePath}\n请确保工作区根目录包含 sns-demo 文件夹。`,
      },
      Date.now(),
    );
    return;
  }

  // 检查目标项目是否已经存在
  const targetPath = path.join(process.cwd(), projectName);
  if (fs.existsSync(targetPath)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 项目目录已存在：${targetPath}`,
      },
      Date.now(),
    );
    return;
  }

  try {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `🚀 开始创建Java项目 ${projectName} (业务模块: ${businessModule})...`,
      },
      Date.now(),
    );

    // 复制模板并替换名称
    await copyAndReplaceDir(
      templatePath,
      targetPath,
      'demo',
      projectName,
      businessModule,
    );

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ Java项目 ${projectName} 创建成功！
📁 位置：${targetPath}
🏢 业务模块：${businessModule}
📦 GroupId: com.xiaohongshu.${businessModule}

✨ 已自动过滤构建产物和IDE配置文件 (target/, .idea/, *.iml 等)

项目结构：
${projectName}/
├── ${projectName}-app/
├── ${projectName}-domain/
├── ${projectName}-infrastructure/
├── ${projectName}-common/
├── ${projectName}-start/
├── pom.xml
├── README.md
└── .gitignore`,
      },
      Date.now(),
    );
  } catch (error) {
    // 清理失败的创建
    if (fs.existsSync(targetPath)) {
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } catch (cleanupError) {
        debugLogger.warn(
          'Warning: Could not clean up failed project creation:',
          cleanupError,
        );
      }
    }

    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 创建Java项目失败：${error instanceof Error ? error.message : String(error)}`,
      },
      Date.now(),
    );
  }
}

/**
 * 创建 Java SNS 项目
 */
async function createJavaSnsProject(
  context: CommandContext,
  projectName: string,
): Promise<SlashCommandActionReturn | void> {
  if (!validateProjectName(projectName)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: '❌ 项目名称无效。请使用字母、数字和连字符，不能以连字符开头或结尾。',
      },
      Date.now(),
    );
    return;
  }

  await createJavaProject(context, projectName, 'sns');
}

/**
 * 创建 Java FLS 项目
 */
async function createJavaFlsProject(
  context: CommandContext,
  projectName: string,
): Promise<SlashCommandActionReturn | void> {
  if (!validateProjectName(projectName)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: '❌ 项目名称无效。请使用字母、数字和连字符，不能以连字符开头或结尾。',
      },
      Date.now(),
    );
    return;
  }

  await createJavaProject(context, projectName, 'fls');
}

/**
 * Java SNS 子命令
 */
const javaSnsCommand: SlashCommand = {
  name: 'sns',
  description: '社区',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const projectName = args.trim();
    if (!projectName) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 请提供项目名称。\n\n使用格式：/create java sns <项目名>\n例如：/create java sns my-sns-service',
        },
        Date.now(),
      );
      return;
    }
    return await createJavaSnsProject(context, projectName);
  },
};

/**
 * Java FLS 子命令
 */
const javaFlsCommand: SlashCommand = {
  name: 'fls',
  description: '电商',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const projectName = args.trim();
    if (!projectName) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 请提供项目名称。\n\n使用格式：/create java fls <项目名>\n例如：/create java fls my-fls-service',
        },
        Date.now(),
      );
      return;
    }
    return await createJavaFlsProject(context, projectName);
  },
};

/**
 * 创建IDL项目
 */
async function createIdlProject(
  context: CommandContext,
  projectName: string,
): Promise<void> {
  // 获取模板路径
  const templatePath = getIdlExamplePath();

  // 检查模板是否存在
  if (!fs.existsSync(templatePath)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ IDL脚手架模板不存在：${templatePath}\n请确保工作区根目录包含 idl-template/wiki/example 文件夹。`,
      },
      Date.now(),
    );
    return;
  }

  // 项目目录名直接使用 projectName
  const projectDirectoryName = projectName;

  // 检查目标项目是否已经存在
  const targetPath = path.join(process.cwd(), projectDirectoryName);
  if (fs.existsSync(targetPath)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 项目目录已存在：${targetPath}`,
      },
      Date.now(),
    );
    return;
  }

  try {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `🚀 开始创建IDL项目 ${projectName}...`,
      },
      Date.now(),
    );

    // 复制模板并替换名称
    await copyAndReplaceDir(
      templatePath,
      targetPath,
      'demo', // 模板中的占位名称
      projectName,
      'sns', // 默认业务模块
      true, // 标记为IDL项目
    );

    // 生成搜索关键词：将下划线转为连字符，并去除 _idl 或 -idl 后缀
    // 例如：angelos_idl -> angelos-sdk, angelos-idl -> angelos-sdk
    //      angelos_admin_idl -> angelos-admin-sdk, angelos-admin-idl -> angelos-admin-sdk
    const searchKeyword = projectName
      .replace(/[-_]idl$/, '')
      .replace(/_/g, '-');

    // 检查项目名是否以 idl 结尾，如果不是则给出提示
    const hasIdlSuffix = /[-_]idl$/.test(projectName);
    const namingTip = hasIdlSuffix
      ? `\n💡 已自动处理项目名后缀：\n   • Maven artifactId: ${searchKeyword}-api\n   • 搜索关键词: ${searchKeyword}-sdk`
      : `\n💡 提示：建议IDL项目名以 _idl 或 -idl 结尾（如：${projectName}_idl）\n   这样可以自动优化生成的 artifactId 和搜索关键词`;

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ IDL项目 ${projectName} 创建成功！
📁 位置：${targetPath}

✨ 已自动过滤构建产物和IDE配置文件
${namingTip}

项目结构：
${projectDirectoryName}/
├── .gitignore
├── .gitlab-ci.yml
├── gen-java.sh
├── base.thrift
├── common.thrift
├── dto.thrift
├── enum.thrift
├── req.thrift
├── res.thrift
├── service.thrift
├── maven_project/
│   └── pom.xml
├── sdk-spec.yml
└── README.md

📌 后续事项:
────────────────────────────────────
1. 请按需修改后将该idl项目提交至sns-idls仓库
2. 参考文档配置流水线: https://docs.xiaohongshu.com/doc/57be8d2fb7c584798d5b6135060b2c94
3. 运行流水线成功后可在以下地址搜索获取maven包:
   https://artifactory.devops.xiaohongshu.com/ui/packages/
   搜索关键词: "${searchKeyword}-sdk"
────────────────────────────────────`,
      },
      Date.now(),
    );
  } catch (error) {
    // 清理失败的创建
    if (fs.existsSync(targetPath)) {
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } catch (cleanupError) {
        debugLogger.warn(
          'Warning: Could not clean up failed project creation:',
          cleanupError,
        );
      }
    }

    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 创建IDL项目失败：${error instanceof Error ? error.message : String(error)}`,
      },
      Date.now(),
    );
  }
}

/**
 * 创建 IDL 项目
 */
async function createIdlCommand(
  context: CommandContext,
  projectName: string,
): Promise<SlashCommandActionReturn | void> {
  if (!validateIdlProjectName(projectName)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text:
          '❌ IDL项目名称无效。\n\n' +
          '命名规范：\n' +
          '• 建议以 _idl 或 -idl 结尾（如：angelos_idl 或 angelos-idl）\n' +
          '• 只能包含小写字母、数字、连字符和下划线\n' +
          '• 不能包含其他特殊符号（点等）\n' +
          '• 不能以数字、连字符或下划线开头\n\n' +
          '示例：\n' +
          '• /create idl angelos_idl\n' +
          '• /create idl angelos-idl\n' +
          '• /create idl user_service_idl',
      },
      Date.now(),
    );
    return;
  }

  await createIdlProject(context, projectName);
}

/**
 * IDL 子命令
 */
const idlCommand: SlashCommand = {
  name: 'idl',
  description: 'IDL 项目脚手架（建议项目名以 _idl 或 -idl 结尾）',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const projectName = args.trim();
    if (!projectName) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text:
            '❌ 请提供项目名称。\n\n' +
            '使用格式：/create idl <项目名>\n\n' +
            '💡 建议项目名以 _idl 或 -idl 结尾，例如：\n' +
            '• /create idl angelos_idl\n' +
            '• /create idl angelos-idl\n' +
            '• /create idl user_service_idl\n\n' +
            '这样生成的 artifactId 会自动去除 _idl/-idl 后缀。',
        },
        Date.now(),
      );
      return;
    }
    return await createIdlCommand(context, projectName);
  },
};

/**
 * Java 主命令
 */
const javaCommand: SlashCommand = {
  name: 'java',
  description: 'Java 项目脚手架',
  kind: CommandKind.BUILT_IN,
  subCommands: [javaSnsCommand, javaFlsCommand],
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const parts = args.trim().split(/\s+/);

    if (parts.length === 0 || !parts[0]) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 请选择业务模块类型。\n\n可用的业务模块：\n• sns - 社区业务模块\n• fls - 业务模块\n\n使用格式：\n• /create java sns <项目名>\n• /create java fls <项目名>',
        },
        Date.now(),
      );
      return;
    }

    const businessModule = parts[0].toLowerCase();
    const projectName = parts.slice(1).join('-');

    switch (businessModule) {
      case 'sns':
        return await createJavaSnsProject(context, projectName);
      case 'fls':
        return await createJavaFlsProject(context, projectName);
      default:
        context.ui.addItem(
          {
            type: MessageType.ERROR,
            text: `❌ 不支持的业务模块：${businessModule}\n\n当前支持的业务模块：sns, fls`,
          },
          Date.now(),
        );
        return;
    }
  },
};

// Export functions for testing
export { getIdlExamplePath, getTemplatePath };

export const createCommand: SlashCommand = {
  name: 'create',
  description:
    '创建项目脚手架，用法：/create java sns <项目名> 或 /create idl <项目名>',
  kind: CommandKind.BUILT_IN,
  subCommands: [javaCommand, idlCommand],
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const trimmedArgs = args.trim();

    // 如果没有参数，显示帮助信息
    if (!trimmedArgs) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text:
            '📋 创建项目脚手架\n\n' +
            '可用的项目类型：\n' +
            '• java - Java项目（DDD架构）\n' +
            '• idl - IDL项目（Thrift接口定义）\n\n' +
            '使用格式：\n' +
            '• /create java sns <项目名>\n' +
            '• /create java fls <项目名>\n' +
            '• /create idl <项目名>\n\n' +
            '示例：\n' +
            '• /create java sns user-service\n' +
            '• /create idl angelos_idl',
        },
        Date.now(),
      );
      return;
    }

    const parts = trimmedArgs.split(/\s+/);
    const firstArg = parts[0].toLowerCase();

    // 如果第一个参数是 java，则调用 java 子命令
    if (firstArg === 'java') {
      const remainingArgs = parts.slice(1).join(' ');
      return await javaCommand.action!(context, remainingArgs);
    }

    // 如果第一个参数是 idl，则调用 idl 子命令
    if (firstArg === 'idl') {
      const projectName = parts.slice(1).join('-');
      return await createIdlCommand(context, projectName);
    }

    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 不支持的项目类型：${firstArg}

当前支持的项目类型：java, idl

使用格式：
• /create java sns <项目名>
• /create java fls <项目名>
• /create idl <项目名>`,
      },
      Date.now(),
    );
    return;
  },
  // 添加 completion 函数以支持键盘导航选择子命令
  completion: async (
    _context: CommandContext,
    partial: string,
  ): Promise<string[]> => {
    // 提供子命令补全建议
    const subCommands = ['java', 'idl'];
    if (!partial) {
      return subCommands;
    }
    return subCommands.filter((cmd) => cmd.startsWith(partial.toLowerCase()));
  },
};

// For testing purposes, export internal functions
if (process.env['NODE_ENV'] === 'test') {
  // @ts-expect-error - testExports is not part of the public API
  createCommand.testExports = {
    getIdlExamplePath,
    getTemplatePath,
  };
}
