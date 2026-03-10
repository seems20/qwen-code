# Hook 功能介绍（近期新增）

本文介绍当前项目中近期支持的 Hook（钩子）能力：它是什么、能做什么、如何配置、执行语义和落地建议。

> 基于代码实现与测试整理：`packages/core/src/hooks/*`、`packages/cli/src/ui/commands/hooksCommand.ts`、`integration-tests/hook-integration/hooks.test.ts`。

---

## 1. Hook 是什么

Hook 是一套“在关键生命周期节点插入外部逻辑”的机制。你可以通过配置命令型 hook，让 RDMind 在特定事件发生时执行外部脚本/命令，并根据输出影响后续行为。

核心价值：

- **策略前置**：在请求送入模型前做合规校验、关键词拦截、上下文注入。
- **流程编排**：在即将结束时阻止停止（继续迭代）、补充收尾上下文。
- **可运维**：通过配置和脚本快速扩展，不需要改主流程代码。

---

## 2. 当前已接入并验证的事件

虽然类型层声明了多个事件（如 `PreToolUse`、`PermissionRequest`、`SessionStart` 等），但当前主链路中明确接入并在集成测试覆盖的核心事件是：

- `UserPromptSubmit`：用户 prompt 提交后、进入模型前触发。
- `Stop`：Agent 准备结束响应前触发。

说明：

- 在 `Config.initialize()` 的 hook 执行分发中，当前显式处理 `UserPromptSubmit` 与 `Stop`。
- 这也是 `settingsSchema` 当前重点暴露的 hooks 配置入口。

---

## 3. 配置结构

配置分为两部分：

1) `hooksConfig`：系统级开关与禁用列表  
2) `hooks`：各事件下的 hook 定义

```json
{
  "hooksConfig": {
    "enabled": true,
    "disabled": ["my-hook-name"]
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "sequential": false,
        "hooks": [
          {
            "type": "command",
            "name": "ups-policy-check",
            "command": "python3 scripts/check_prompt.py",
            "timeout": 5000,
            "env": {
              "POLICY_MODE": "strict"
            }
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "name": "stop-review",
            "command": "node scripts/stop_hook.js",
            "timeout": 3000
          }
        ]
      }
    ]
  }
}
```

### 字段说明

- `hooksConfig.enabled`：总开关，关闭后不执行任何 hook。
- `hooksConfig.disabled`：按 hook 名称禁用（即使已配置也不执行）。
- `hooks.<EventName>[]`：某事件下可配置多个 definition。
- `definition.matcher`：匹配条件（工具类事件中通常用于匹配 toolName；`*` 或空表示全匹配）。
- `definition.sequential`：该 definition 中 hook 的执行方式（串行/并行）。
- `definition.hooks[]`：具体 hook 列表。
- `hook.type`：当前主要为 `command`。
- `hook.command`：要执行的 shell 命令。
- `hook.timeout`：超时时间（毫秒），默认 60s。
- `hook.env`：注入命令执行环境变量。

---

## 4. 执行机制与语义

Hook 系统的主组件：

- `HookRegistry`：加载/校验/去重/启停 hook。
- `HookPlanner`：按事件与 matcher 选中 hook，产出执行计划。
- `HookRunner`：执行命令（并行或串行），收集 stdout/stderr/exitCode。
- `HookAggregator`：多 hook 结果合并（OR 语义、上下文拼接等）。
- `HookEventHandler`：事件入口，组装输入并执行整条链路。

### 4.1 并行 vs 串行

- `sequential: false`（默认并行）：同组 hooks 并行执行。
- `sequential: true`：按顺序执行；后一个 hook 可基于前一个 hook 输出修改过的输入继续执行。

### 4.2 合并策略（重点）

对于 `UserPromptSubmit` / `Stop`：

- 采用“偏保守”的 OR 逻辑：
  - 任一 hook 返回 `block`/`deny`，聚合后视为阻断信号。
- `reason`：按换行拼接。
- `hookSpecificOutput.additionalContext`：按换行拼接。
- `continue=false`：优先保留（用于请求“不要停止，继续执行”）。

---

## 5. 命令执行协议（输入/输出）

## 5.1 Hook 输入（stdin JSON）

所有 hook 都会收到基础字段：

- `session_id`
- `transcript_path`
- `cwd`
- `hook_event_name`
- `timestamp`

事件特有字段：

- `UserPromptSubmit`: `prompt`
- `Stop`: `stop_hook_active`, `last_assistant_message`

## 5.2 Hook 输出（stdout/stderr）

优先建议输出 JSON，典型格式：

```json
{
  "decision": "allow",
  "reason": "approved by policy",
  "hookSpecificOutput": {
    "additionalContext": "extra context from hook"
  }
}
```

常用字段：

- `decision`: `allow | block | deny | ask | approve`
- `reason`: 决策原因
- `continue`: `false` 表示请求继续执行（常用于 Stop）
- `stopReason`: 停止/继续原因
- `systemMessage`: 系统提示信息
- `hookSpecificOutput.additionalContext`: 补充上下文

### 5.3 退出码语义

- `0`：成功
- `1`：非阻断错误（通常视作 warning，不强阻断）
- `2`：阻断错误（按阻断处理）
- 其他非 0：按阻断语义处理

另外：

- 超时会被捕获并返回失败结果（默认超时 60s，可配置）。
- stdout/stderr 有长度上限（1MB）防止输出失控。

---

## 6. UserPromptSubmit 与 Stop 的行为差异

这是最需要理解的点。

### 6.1 UserPromptSubmit

- 触发时机：模型处理前。
- 常见用途：拦截高风险请求、追加策略上下文、改写输入。
- 若返回阻断（如 `decision=block`），会阻断本次请求流程（集成测试中表现为执行失败）。

### 6.2 Stop

- 触发时机：模型准备结束前。
- 常见用途：终止前二次审查、要求继续迭代、追加收尾上下文。
- `decision=block` 在 Stop 语义下可理解为“阻止本次停止”（即继续跑），不是直接报错终止。
- `continue=false` 同样用于表达“不要结束，继续执行”。

---

## 7. 运行与管理

交互模式提供 `/hooks` 命令：

- `/hooks list`：查看已加载 hooks
- `/hooks enable <name>`：会话内启用
- `/hooks disable <name>`：会话内禁用

CLI 子命令也提供 hooks 管理入口（`hooks enable/disable`）。

---

## 8. 安全与可信目录

项目对 project-level hooks 有信任检查机制：

- 首次检测到工作区 hooks 时会告警。
- 可信记录写入全局 `trusted_hooks.json`。
- 在不可信目录下，project hooks 可能被限制执行。

建议：

- Hook 脚本只保留最小权限。
- 禁止在 hook 中输出/记录敏感密钥。
- 对外部命令结果做显式超时与错误处理。

---

## 9. 最小可用示例

### 9.1 Prompt 前置策略（拦截）

```json
{
  "hooksConfig": { "enabled": true },
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "name": "block-dangerous-prompt",
            "command": "python3 scripts/block_dangerous_prompt.py",
            "timeout": 3000
          }
        ]
      }
    ]
  }
}
```

### 9.2 Stop 前继续迭代

```json
{
  "hooksConfig": { "enabled": true },
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "name": "require-final-check",
            "command": "echo '{\"continue\": false, \"stopReason\": \"Need final checklist\"}'",
            "timeout": 1000
          }
        ]
      }
    ]
  }
}
```

---

## 10. 落地建议

1. 先从 `UserPromptSubmit` 开始，做“只告警不阻断”的灰度。
2. 对阻断策略保留可观测 reason，便于排查。
3. Stop hook 谨慎使用“继续执行”，配合会话轮次上限防止循环。
4. 每个 hook 保持单一职责，命名清晰，避免把复杂业务硬塞到一个脚本。
5. 建议为关键 hook 补集成测试（参照 `integration-tests/hook-integration/hooks.test.ts`）。

---

## 11. 一句话总结

Hook 功能让 RDMind 具备了**可配置、可插拔、可治理**的流程扩展能力：你可以在关键节点动态执行策略与编排逻辑，而无需侵入主流程代码。