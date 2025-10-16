# /tech-design 命令使用文档

## 概述

`/tech-design` 是一个基于 AI 的技术方案和执行计划生成工具，可以帮助开发者快速生成标准化的技术文档。

## 功能特点

- ✅ 自动从 Redoc URL 获取文档内容
- ✅ 分析代码仓库结构和技术栈
- ✅ 基于模板生成标准化文档
- ✅ AI 自动调用工具完成整个流程
- ✅ 支持 git 仓库检查
- ✅ 文档自动保存到工作目录

## 使用前提

1. 必须在 **git 仓库目录** 下运行
2. 需要提供有效的 **Redoc 文档 URL**
3. 已配置好 RDMind 的 AI 模型

## 子命令

### 1. solution - 生成技术方案

根据 PRD 文档生成完整的技术方案文档。

**命令格式：**
```
/tech-design solution <prd-url>
```

**简写：**
```
/td s <prd-url>
```

**示例：**
```
/tech-design solution https://docs.xiaohongshu.com/doc/abc123def456
```

**生成内容：**
- 评审信息表格
- 项目背景和 PRD 链接
- 需求分析（对应 PRD 功能点）
- 详细设计（技术方案、数据库设计、接口设计等）
- 工作量评估与排期
- 上线步骤

**输出文件：**
`tech-solution-YYYY-MM-DD.md`

### 2. plan - 生成执行计划

根据技术文档生成详细的执行计划和 AI Coding 指导。

**命令格式：**
```
/tech-design plan <tech-doc-url>
```

**简写：**
```
/td p <tech-doc-url>
```

**示例：**
```
/tech-design plan https://docs.xiaohongshu.com/doc/xyz789abc123
```

**生成内容：**
- 项目概述（背景、目标、技术栈）
- 代码结构分析（目录结构、关键模块、依赖关系）
- 开发任务分解（前置任务、核心任务、后续任务）
- 编码规范（代码风格、命名约定、注释规范、测试要求）
- AI Coding 指导（使用建议、代码审查要点）
- 质量保证（单元测试、集成测试、代码审查流程）
- 部署和发布（环境、流程、回滚预案）
- 项目排期表
- 风险评估

**输出文件：**
`execution-plan-YYYY-MM-DD.md`

## 工作流程

### solution 子命令流程

1. **检查环境**
   - 验证当前目录是否为 git 仓库
   - 检查配置是否正确

2. **AI 自动执行**
   - 使用 `redoc_fetch` 工具获取 PRD 文档内容
   - 分析 PRD 需求和功能点
   - 分析当前代码仓库的技术栈和架构
   - 按照技术方案模板填充内容

3. **生成文档**
   - 使用 `write` 工具保存文档到工作目录
   - 文档命名：`tech-solution-{日期}.md`

### plan 子命令流程

1. **检查环境**
   - 验证当前目录是否为 git 仓库
   - 检查配置是否正确

2. **AI 自动执行**
   - 使用 `redoc_fetch` 工具获取技术文档内容
   - 分析代码仓库结构（目录、技术栈、代码风格）
   - 提取技术文档中的实现细节
   - 生成详细的任务分解和执行计划

3. **生成文档**
   - 使用 `write` 工具保存文档到工作目录
   - 文档命名：`execution-plan-{日期}.md`

## 完整使用示例

### 场景1：从 PRD 开始新项目

```bash
# 1. 进入项目目录
cd /path/to/your/project

# 2. 确保是 git 仓库
git status

# 3. 启动 RDMind
rdmind

# 4. 在 RDMind 中生成技术方案
/tech-design solution https://docs.xiaohongshu.com/doc/prd-abc123

# 5. 等待 AI 生成完成，查看生成的文档
# 输出文件：tech-solution-2025-01-15.md
```

### 场景2：根据技术方案生成执行计划

```bash
# 1. 进入项目目录
cd /path/to/your/project

# 2. 在 RDMind 中生成执行计划
/td plan https://docs.xiaohongshu.com/doc/tech-design-xyz789

# 3. 等待 AI 生成完成，查看生成的文档
# 输出文件：execution-plan-2025-01-15.md

# 4. 使用执行计划指导开发
# 可以将执行计划作为上下文提供给 AI 进行代码开发
```

## 注意事项

### 1. git 仓库要求

命令必须在 git 仓库目录下运行，如果不是 git 仓库会看到错误：

```
❌ 当前目录不是 git 仓库，请在代码仓库目录下使用此命令。
```

**解决方法：**
- 进入正确的 git 仓库目录
- 或者在当前目录初始化 git：`git init`

### 2. Redoc URL 格式

支持的 URL 格式：
- `https://docs.xiaohongshu.com/doc/{doc_id}`
- doc_id 必须是 32 位十六进制字符串

### 3. AI 执行时间

生成过程可能需要几分钟时间，取决于：
- 文档内容的复杂度
- 代码仓库的规模
- AI 模型的响应速度

请耐心等待，不要中断操作。

### 4. 文档审查

生成的文档是基于 AI 理解和分析的结果，建议：
- ✅ 仔细审查生成的内容
- ✅ 根据实际情况调整和完善
- ✅ 补充 AI 可能遗漏的细节
- ✅ 验证技术方案的可行性

### 5. 文件冲突

如果同一天多次生成文档，文件会被覆盖。建议：
- 及时重命名重要的文档
- 或者手动指定不同的文件名

## 技术实现说明

### AI 工具调用

命令会自动让 AI 调用以下工具：

1. **redoc_fetch**
   - 用途：从 Redoc URL 获取文档内容
   - 参数：URL 和提示词

2. **write**
   - 用途：将生成的文档保存到文件
   - 参数：文件路径和内容

### 模板文件

技术方案模板位于：
- `packages/cli/templates/tech-design-template.md`

执行计划采用动态模板，在 AI 提示词中定义。

## 常见问题

### Q1: 命令没有反应？

**检查：**
- 是否在 RDMind 交互式界面中？
- 是否在 git 仓库目录下？
- 是否提供了有效的 Redoc URL？

### Q2: AI 生成的文档不完整？

**原因可能：**
- 源文档内容不够详细
- 代码仓库结构复杂
- AI 模型上下文限制

**解决：**
- 提供更详细的 PRD/技术文档
- 手动补充遗漏的内容
- 分多次生成不同部分

### Q3: 如何自定义模板？

**方法：**
- 修改 `packages/cli/templates/tech-design-template.md`
- 或者在 AI 提示词中调整要求

### Q4: 支持其他文档格式吗？

当前只支持 Redoc 格式的文档。如需支持其他格式：
- 可以手动复制文档内容
- 直接提供给 AI 进行处理

## 快捷键和别名

- `/tech-design` → `/td`（主命令简写）
- `solution` → `s`（子命令简写）
- `plan` → `p`（子命令简写）

**完整简写示例：**
```
/td s <url>  # 生成技术方案
/td p <url>  # 生成执行计划
```

## 相关命令

- `/help` - 查看所有命令帮助
- `/tools` - 查看可用工具列表
- `/create` - 创建项目脚手架
- `/import` - 导入中间件

## 反馈和建议

如遇到问题或有改进建议，请通过 `/bug` 命令提交反馈。

