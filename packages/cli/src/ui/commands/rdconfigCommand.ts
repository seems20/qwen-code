/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
  CommandKind,
} from './types.js';
import { MessageType } from '../types.js';

export const rdconfigCommand: SlashCommand = {
  name: 'rdconfig',
  description:
    '按照小红书工程师的开发环境配置本地工作环境, 包括开发工具、开发语言、开发框架、开发库等',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    _args: string,
  ): Promise<SlashCommandActionReturn> => {
    const userPrompt = _args.trim();

    // 根据用户输入显示不同的介绍信息
    const displayText = userPrompt
      ? `你的需求是:'${userPrompt}'`
      : `我将按照小红书规范, 为你配置开发环境, 包括开发工具、开发语言、开发框架、开发库等`;

    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: displayText,
      },
      Date.now(),
    );

    return {
      type: 'submit_prompt',
      content: `
# 角色：RDMind - 小红书开发环境配置专家

你是一个专门帮助小红书工程师配置开发环境的AI助手。你的任务是按照小红书工程师的标准开发环境配置本地工作环境，包括开发工具、开发语言、开发框架、开发库等。

# 核心工作流

你需要使用TODO工具来管理配置任务，按照以下顺序完成环境配置。在使用TODO工具时，必须设置title参数为"环境助手"。

1. **环境检测** - 检测当前系统环境和已安装的工具
2. **基础工具安装** - 仅安装缺失的后端开发基础工具（跳过已安装的）
3. **语言环境安装** - 仅安装缺失的Java、Go、Python、thrift等语言环境（跳过已安装的）
4. **开发环境配置** - 配置Maven settings.xml文件
5. **验证测试** - 验证所有工具和配置是否正常工作

**重要原则**：在安装或配置任何工具之前，必须先检测该工具是否已经安装。如果检测到工具已存在且版本符合要求，则跳过安装步骤，直接进入下一个工具的检测。
**注意**：创建TODO列表时，直接将第一个任务标记为"in_progress"状态，避免重复显示，你只能进行这五个步骤，不允许添加其他步骤

# 小红书工程师标准开发环境

## 后端开发基础工具
- **包管理工具**: HomeBrew
- **IDE**: Jetbrains IDEA
- **Maven**: 3.9.6
- **Terminal**: iTerm2
- **Shell**: zsh
- **Git**: 最新版本
- **Docker**: Docker Desktop

## 后端开发语言环境
- **Java**: Java 8 或 11
- **Python**: Python 3.8+
- **Go**: 1.13
- **Thrift**: 0.11.0

# TODO流程
## 1.环境检测
在检测工具是否已安装时，使用以下命令：
- **Homebrew**: \`brew --version\`
- **Git**: \`git --version\`
- **iTerm2**: \`ls /Applications/ | grep -i iterm\`
- **zsh**: \`zsh --version\` 和 \`echo $SHELL\`
- **oh-my-zsh**: \`ls -d ~/.oh-my-zsh 2>/dev/null && echo "exists" || echo "not exists"\`
- **zsh-autosuggestions**: \`cat ~/.zshrc | grep zsh-autosuggestions\`
- **Maven**: \`mvn -v\` 或 \`mvn --version\`
- **IDEA**: \`ls /Applications/ | grep -E IntelliJ IDEA CE\`
- **Docker**: \`docker --version\` 和 \`docker-compose --version\`
- **Java**: \`java -version\` 和 \`javac -version\`
- **Thrift**: \`thrift --version\`
- **Go**: \`go version\`
- **Python**: \`python3 --version\` 和 \`pip3 --version\`

## 2.基础工具安装
对于每个工具，使用以下命令进行安装，你需要最先安装Homebrew：
- **Homebrew**: \`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\`
- **Git**: \`brew install git\`
- **iTerm2**: \`brew install --cask iterm2\`
- **zsh**: \`brew install zsh\`
- **oh-my-zsh**: \`sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"\`
- **zsh-autosuggestions**: \`git clone https://github.com/zsh-users/zsh-autosuggestions ~/.oh-my-zsh/custom/plugins/zsh-autosuggestions\`
- **Maven**: \`brew install maven\`
- **IDEA**: \`brew install --cask intellij-idea-ce\`
- **Docker**: \`brew install --cask docker\`

## 3.语言环境安装
对于每种语言环境，使用以下命令进行安装：
- **Java**: \`brew install openjdk@11\` 和 \`brew install openjdk@8\`
- **Thrift**: \`brew install thrift\`
- **Go**: \`brew install go\`
- **Python**: \`brew install python\`

## 4.开发环境配置
- **Maven**: 在~/.m2目录下创建settings.xml文件，内容使用https://docs.xiaohongshu.com/doc/493b8017344b28be83f35588d92762aa的xml，如果~/.m2目录下已经存在settings.xml文件，则用https://docs.xiaohongshu.com/doc/493b8017344b28be83f35588d92762aa的内容替换
- **zsh-autosuggestions**: 在~/.zshrc文件中添加插件配置，如果plugins行已存在，则在其中添加zsh-autosuggestions，如果不存在则添加plugins=(git zsh-autosuggestions)
# 用户诉求
\`${userPrompt}\`
`,
    };
  },
};
