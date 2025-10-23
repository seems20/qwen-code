/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { type SlashCommand, CommandKind } from '../commands/types.js';

interface Help {
  commands: readonly SlashCommand[];
}

export const Help: React.FC<Help> = ({ commands }) => (
  <Box
    flexDirection="column"
    marginBottom={1}
    borderColor={theme.border.default}
    borderStyle="round"
    padding={1}
  >
    {/* Basics */}
    <Text bold color={theme.text.primary}>
      基础用法:
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        添加上下文
      </Text>
      : 使用{' '}
      <Text bold color={theme.text.accent}>
        @
      </Text>{' '}
      指定用于上下文的文件 (例如{' '}
      <Text bold color={theme.text.accent}>
        @src/myFile.ts
      </Text>
      )
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        Shell 模式
      </Text>
      : 使用{' '}
      <Text bold color={theme.text.accent}>
        !
      </Text>{' '}
      执行 shell 命令 (例如{' '}
      <Text bold color={theme.text.accent}>
        !npm run start
      </Text>
      )
    </Text>

    <Box height={1} />

    {/* Commands */}
    <Text bold color={theme.text.primary}>
      命令:
    </Text>
    {commands
      .filter((command) => command.description && !command.hidden)
      .map((command: SlashCommand) => (
        <Box key={command.name} flexDirection="column">
          <Text color={theme.text.primary}>
            <Text bold color={theme.text.accent}>
              {' '}
              /{command.name}
            </Text>
            {command.kind === CommandKind.MCP_PROMPT && (
              <Text color={theme.text.secondary}> [MCP]</Text>
            )}
            {command.description && ' - ' + command.description}
          </Text>
          {command.subCommands &&
            command.subCommands
              .filter((subCommand) => !subCommand.hidden)
              .map((subCommand) => (
                <Text key={subCommand.name} color={theme.text.primary}>
                  <Text bold color={theme.text.accent}>
                    {'   '}
                    {subCommand.name}
                  </Text>
                  {subCommand.description && ' - ' + subCommand.description}
                </Text>
              ))}
        </Box>
      ))}
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        {' '}
        !{' '}
      </Text>
      - shell 命令
    </Text>
    <Text color={theme.text.primary}>
      <Text color={theme.text.secondary}>[MCP]</Text> - Model Context Protocol
      command (from external servers)
    </Text>

    <Box height={1} />

    {/* Shortcuts */}
    <Text bold color={theme.text.primary}>
      键盘快捷键:
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        Alt+Left/Right
      </Text>{' '}
      - 在输入框中跳转
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        Ctrl+C
      </Text>{' '}
      - 关闭对话框、取消请求或退出 RDMind
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        {process.platform === 'win32' ? 'Ctrl+Enter' : 'Ctrl+J'}
      </Text>{' '}
      {process.platform === 'linux'
        ? '- 换行 (某些 Linux 发行版支持 Alt+Enter)'
        : '- 换行'}
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        Ctrl+L
      </Text>{' '}
      - 清屏
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        {process.platform === 'darwin' ? 'Ctrl+X / Meta+Enter' : 'Ctrl+X'}
      </Text>{' '}
      - 打开外部编辑器
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        Enter
      </Text>{' '}
      - 发送
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        Esc
      </Text>{' '}
      - 取消操作
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        Shift+Tab
      </Text>{' '}
      - 模式切换
    </Text>
    <Text color={theme.text.primary}>
      <Text bold color={theme.text.accent}>
        Up/Down
      </Text>{' '}
      - 切换
    </Text>
    <Box height={1} />
    <Text color={theme.text.primary}>
      完整的快捷键列表请参见{' '}
      <Text bold color={theme.text.accent}>
        /docs
      </Text>
    </Text>
  </Box>
);
