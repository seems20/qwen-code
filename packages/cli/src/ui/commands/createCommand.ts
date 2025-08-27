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



/**
 * 验证项目名称
 */
function validateProjectName(name: string): boolean {
  // 项目名只允许字母、数字、连字符，不能以连字符开头或结尾
  return /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(name);
}



/**
 * 获取脚手架模板路径
 */
function getTemplatePath(): string {
  // 尝试多个可能的模板位置
  const possiblePaths = [
    // 1. 开发环境：相对于工作区根目录的sns-demo
    path.join(process.cwd(), 'sns-demo'),
    
    // 2. 开发环境：相对于包根目录的sns-demo  
    path.join(__dirname, '..', '..', '..', '..', 'sns-demo'),
    
    // 3. 打包后：bundle目录中的template
    path.join(__dirname, 'template'),
    path.join(__dirname, '..', 'template'),
    path.join(__dirname, '..', '..', 'template'),
    
    // 4. 全局安装：相对于可执行文件的template
    path.join(path.dirname(process.argv[0]), 'template'),
    path.join(path.dirname(process.argv[0]), '..', 'template'),
    path.join(path.dirname(process.argv[0]), '..', 'lib', 'template'),
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
 * 替换项目名称相关的内容
 */
function replaceProjectNames(content: string, oldName: string, newName: string, businessModule: string): string {
  // 从项目名中提取包名部分（去掉业务模块前缀，并将连字符转换为点）
  const projectPrefix = `${businessModule}-`;
  const packageName = newName.startsWith(projectPrefix) 
    ? newName.substring(projectPrefix.length).replace(/-/g, '.') 
    : newName.replace(/-/g, '.');
  
  return content
    // 先处理包含 sns.demo 的特定模式，将sns替换为业务模块，demo替换为包名部分（用点分隔）
    .replace(/com\.xiaohongshu\.sns\.demo/g, `com.xiaohongshu.${businessModule}.${packageName}`)
    // 处理一般的 com.xiaohongshu.sns 模式，替换为新的业务模块
    .replace(/com\.xiaohongshu\.sns/g, `com.xiaohongshu.${businessModule}`)
    // 处理 logger name
    .replace(/<logger name="com\.xiaohongshu\.sns"/g, `<logger name="com.xiaohongshu.${businessModule}"`)
    .replace(/<artifactId>sns-demo-parent<\/artifactId>/g, `<artifactId>${newName}-parent</artifactId>`)
    .replace(/<artifactId>sns-demo-([^<]+)<\/artifactId>/g, `<artifactId>${newName}-$1</artifactId>`)
    .replace(/<artifactId>sns-demo<\/artifactId>/g, `<artifactId>${newName}</artifactId>`)
    .replace(/<name>sns-demo<\/name>/g, `<name>${newName}</name>`)
    .replace(/<name>sns-demo-([^<]+)<\/name>/g, `<name>${newName}-$1</name>`)
    .replace(/<module>sns-demo-([^<]+)<\/module>/g, `<module>${newName}-$1</module>`)
    .replace(/<artifactId>\${projectName}-([^<]+)<\/artifactId>/g, `<artifactId>${newName}-$1</artifactId>`)
    .replace(/spring\.application\.name=sns-demo/g, `spring.application.name=${newName}`)
    .replace(/spring\.application\.name:\s*sns-demo/g, `spring.application.name: ${newName}`)
    // 最后处理一般的 sns-demo 替换
    .replace(/sns-demo/g, newName);
}

/**
 * 复制单个文件并替换内容
 */
async function copyAndReplaceFile(srcFile: string, destFile: string, oldName: string, newName: string, businessModule: string): Promise<void> {
  // 确保目标目录存在
  const destDir = path.dirname(destFile);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // 读取源文件内容
  const content = fs.readFileSync(srcFile, 'utf8');
  
  // 替换内容
  const newContent = replaceProjectNames(content, oldName, newName, businessModule);
  
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
    '*.log'
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
async function copyAndReplaceDir(srcDir: string, destDir: string, oldName: string, newName: string, businessModule: string): Promise<void> {
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
    if (item === 'demo') {
      // 特殊处理：将 demo 目录替换为项目名去掉业务模块前缀后的部分
      // 对于包结构，需要处理连字符：如sns-circle变成circle，sns-user-service变成user-service
      const projectPrefix = `${businessModule}-`;
      const packageDirName = newName.startsWith(projectPrefix) ? newName.substring(projectPrefix.length) : newName;
      destItemName = packageDirName;
      
      // 如果包名包含连字符，需要创建多层目录结构
      if (packageDirName.includes('-')) {
        const pathParts = packageDirName.split('-');
        const currentDestPath = destDir;
        
        // 创建多层目录结构
        for (let i = 0; i < pathParts.length; i++) {
          const partPath = path.join(currentDestPath, ...pathParts.slice(0, i + 1));
          if (i === pathParts.length - 1) {
            // 最后一层，复制内容
            await copyAndReplaceDir(srcPath, partPath, oldName, newName, businessModule);
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
      // 使用与文件内容替换相同的逻辑：将 sns-demo 替换为新项目名
      destItemName = item.replace(/sns-demo/g, newName);
    }
    
    const destPath = path.join(destDir, destItemName);
    
    const stats = fs.statSync(srcPath);
    
    if (stats.isDirectory()) {
      // 递归复制目录
      await copyAndReplaceDir(srcPath, destPath, oldName, newName, businessModule);
    } else if (stats.isFile()) {
      // 复制并替换文件内容
      await copyAndReplaceFile(srcPath, destPath, oldName, newName, businessModule);
    }
  }
}

/**
 * 创建Java项目
 */
async function createJavaProject(
  context: CommandContext,
  projectName: string,
  businessModule: string
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
    await copyAndReplaceDir(templatePath, targetPath, 'demo', projectName, businessModule);

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ Java项目 ${projectName} 创建成功！\n📁 位置：${targetPath}\n🏢 业务模块：${businessModule}\n📦 GroupId: com.xiaohongshu.${businessModule}\n\n✨ 已自动过滤构建产物和IDE配置文件 (target/, .idea/, *.iml 等)\n\n项目结构：\n${projectName}/\n├── ${projectName}-app/\n├── ${projectName}-domain/\n├── ${projectName}-infrastructure/\n├── ${projectName}-common/\n├── ${projectName}-start/\n├── pom.xml\n├── README.md\n└── .gitignore`,
      },
      Date.now(),
    );
  } catch (error) {
    // 清理失败的创建
    if (fs.existsSync(targetPath)) {
      try {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Warning: Could not clean up failed project creation:', cleanupError);
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
  projectName: string
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
  projectName: string
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
  description: '创建基于SNS业务模块的Java项目',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn | void> => {
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
  description: '创建基于FLS业务模块的Java项目',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn | void> => {
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
 * Java 主命令
 */
const javaCommand: SlashCommand = {
  name: 'java',
  description: '创建项目脚手架',
  kind: CommandKind.BUILT_IN,
  subCommands: [javaSnsCommand, javaFlsCommand],
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn | void> => {
    const parts = args.trim().split(/\s+/);
    
    if (parts.length === 0 || !parts[0]) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 请选择业务模块类型。\n\n可用的业务模块：\n• sns - SNS社交业务模块\n• fls - FLS业务模块\n\n使用格式：\n• /create java sns <项目名>\n• /create java fls <项目名>',
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



export const createCommand: SlashCommand = {
  name: 'create',
  description: '创建Java项目脚手架。支持的业务模块：sns, fls',
  kind: CommandKind.BUILT_IN,
  subCommands: [javaCommand],
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const parts = args.trim().split(/\s+/);
    
    if (parts.length === 0 || !parts[0]) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 请选择业务模块类型。\n\n可用的业务模块：\n• sns - SNS社交业务模块\n• fls - FLS业务模块\n\n使用格式：\n• /create java sns <项目名>\n• /create java fls <项目名>',
        },
        Date.now(),
      );
      return;
    }

    const firstArg = parts[0].toLowerCase();

    // 如果第一个参数是 java，则调用 java 子命令
    if (firstArg === 'java') {
      const remainingArgs = parts.slice(1).join(' ');
      return await javaCommand.action!(context, remainingArgs);
    }

    // 否则，直接把第一个参数当作业务模块，第二个参数当作项目名
    const businessModule = firstArg;
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
            text: `❌ 不支持的业务模块：${businessModule}\n\n当前支持的业务模块：sns, fls\n\n使用格式：\n• /create java sns <项目名>\n• /create java fls <项目名>\n• /create sns <项目名>\n• /create fls <项目名>`,
          },
          Date.now(),
        );
        return;
    }
  },
}; 
