/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 表示提示词中检测到的单个注入点
 */
export interface Injection {
  /** 从大括号内提取的内容（例如，命令或路径），已去除空格 */
  content: string;
  /** 注入的起始索引（包含，指向触发器的开始位置） */
  startIndex: number;
  /** 注入的结束索引（不包含最后的'}'） */
  endIndex: number;
}

/**
 * 迭代解析提示词以提取注入内容（例如，!{...} 或 @{...}），
 * 正确处理内容中的嵌套大括号
 *
 * 此解析器依赖简单的大括号计数，不支持转义
 *
 * @param prompt
 * @param trigger 开始触发序列（例如，'!{'、'@{'）
 * @param contextName 可选的上下文名称（例如，命令名称），用于错误消息
 * @returns 提取的 Injection 对象数组
 * @throws Error 如果发现未闭合的注入，则抛出错误
 */
export function extractInjections(
  prompt: string,
  trigger: string,
  contextName?: string,
): Injection[] {
  const injections: Injection[] = [];
  let index = 0;

  while (index < prompt.length) {
    const startIndex = prompt.indexOf(trigger, index);

    if (startIndex === -1) {
      break;
    }

    let currentIndex = startIndex + trigger.length;
    let braceCount = 1;
    let foundEnd = false;

    while (currentIndex < prompt.length) {
      const char = prompt[currentIndex];

      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          const injectionContent = prompt.substring(
            startIndex + trigger.length,
            currentIndex,
          );
          const endIndex = currentIndex + 1;

          injections.push({
            content: injectionContent.trim(),
            startIndex,
            endIndex,
          });

          index = endIndex;
          foundEnd = true;
          break;
        }
      }
      currentIndex++;
    }

    // Check if the inner loop finished without finding the closing brace.
    if (!foundEnd) {
      const contextInfo = contextName ? ` in command '${contextName}'` : '';
      // Enforce strict parsing (Comment 1) and clarify limitations (Comment 2).
      throw new Error(
        `Invalid syntax${contextInfo}: Unclosed injection starting at index ${startIndex} ('${trigger}'). Ensure braces are balanced. Paths or commands with unbalanced braces are not supported directly.`,
      );
    }
  }

  return injections;
}
