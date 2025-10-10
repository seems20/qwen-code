<!-- Powered by BMAD™ Core -->

# 创建下一个 Story 任务

## 目的

根据项目进度和 epic 定义，识别下一个逻辑 story，然后用 `Story Template` 准备一个全面、自包含且可执行的 story 文件。这个任务确保 story 包含所有必要的技术上下文、需求和 acceptance criteria，让 Developer Agent 能够高效实现，不用额外研究或自己找上下文。

## 顺序任务执行（当前任务完成前别继续）

### 0. 加载核心配置并检查工作流

- 从项目根目录加载 `.bmad-core/core-config.yaml`
- 如果文件不存在，停下来告诉用户："core-config.yaml 没找到。这个文件是创建 story 必需的。你可以：1) 从 GITHUB bmad-core/core-config.yaml 复制并配置给你的项目 或者 2) 对你的项目运行 BMad 安装器来自动升级并添加文件。请先添加并配置 core-config.yaml 再继续。"
- 提取关键配置：`devStoryLocation`、`prd.*`、`architecture.*`、`workflow.*`

### 1. 识别下一个要准备的 Story

#### 1.1 定位 Epic 文件并检查现有 Stories

- 根据配置中的 `prdSharded`，定位 epic 文件（分片位置/模式或单体 PRD 部分）
- 如果 `devStoryLocation` 有 story 文件，加载最高的 `{epicNum}.{storyNum}.story.md` 文件
- **如果最高 story 存在：**
  - 验证状态是 'Done'。如果不是，提醒用户："警告：发现未完成的 story！文件：{lastEpicNum}.{lastStoryNum}.story.md 状态：[当前状态] 你应该先修复这个 story，但你想接受风险并覆盖创建下一个 draft story 吗？"
  - 如果继续，选择当前 epic 中的下一个顺序 story
  - 如果 epic 完成，提示用户："Epic {epicNum} 完成：Epic {epicNum} 中的所有 stories 都已完成。你想：1) 开始 Epic {epicNum + 1} 的 story 1 2) 选择特定 story 来搞 3) 取消 story 创建"
  - **关键**：永远别自动跳到另一个 epic。用户必须明确指示要创建哪个 story。
- **如果没有 story 文件存在：** 下一个 story 总是 1.1（第一个 epic 的第一个 story）
- 向用户宣布识别的 story："识别到下一个要准备的 story：{epicNum}.{storyNum} - {Story Title}"

### 2. 收集 Story 需求和前一个 Story 上下文

- 从识别的 epic 文件中提取 story 需求
- 如果前一个 story 存在，检查 Dev Agent Record 部分：
  - Completion Notes 和 Debug Log References
  - Implementation deviations 和技术决策
  - 遇到的挑战和 lessons learned
- 提取为当前 story 准备提供信息的相关见解

### 3. 收集架构上下文

#### 3.1 确定架构阅读策略

- **如果 `architectureVersion: >= v4` 且 `architectureSharded: true`**：读取 `{architectureShardedLocation}/index.md` 然后按下面的 structured reading order
- **否则**：用 monolithic `architectureFile` 获取类似部分

#### 3.2 根据 Story 类型读取架构文档

**For ALL Stories：** tech-stack.md、unified-project-structure.md、coding-standards.md、testing-strategy.md

**For Backend/API Stories，额外：** data-models.md、database-schema.md、backend-architecture.md、rest-api-spec.md、external-apis.md

**For Frontend/UI Stories，额外：** frontend-architecture.md、components.md、core-workflows.md、data-models.md

**For Full-Stack Stories：** 读取上面 Backend 和 Frontend 两个部分

#### 3.3 提取 Story 特定技术细节

只提取与实现当前 story 直接相关的信息。别发明源文档中没有的新库、模式或标准。

Extract：

- Story 将使用的特定 data models、schemas 或 structures
- Story 必须实现或消费的 API endpoints
- Story 中 UI 元素的 component specifications
- 新代码的 file paths 和 naming conventions
- Story 功能特定的 testing requirements
- 影响 Story 的 security 或 performance considerations

ALWAYS cite source documents：`[Source: architecture/{filename}.md#{section}]`

### 4. 验证项目结构对齐

- 把 story 需求与 `docs/architecture/unified-project-structure.md` 中的 Project Structure Guide 交叉引用
- 确保 file paths、component locations 或 module names 与定义的结构对齐
- 在 story draft 的"Project Structure Notes"部分记录任何结构冲突

### 5. 用完整上下文填充 Story 模板

- 用 Story 模板创建新的 story 文件：`{devStoryLocation}/{epicNum}.{storyNum}.story.md`
- 填写基本 story 信息：Title、Status (Draft)、Story statement、来自 Epic 的 Acceptance Criteria
- **`Dev Notes` 部分（关键）：**
  - 关键：这个部分必须只包含从架构文档中提取的信息。永远别发明或假设技术细节。
  - 包含步骤 2-3 中所有相关技术细节，按类别组织：
    - **Previous Story Insights**：从前一个 story 中学到的关键经验
    - **Data Models**：特定 schemas、validation rules、relationships [带源引用]
    - **API Specifications**：endpoint details、request/response formats、auth requirements [带源引用]
    - **Component Specifications**：UI component details、props、state management [带源引用]
    - **File Locations**：基于项目结构应该创建新代码的确切路径
    - **Testing Requirements**：来自 testing-strategy.md 的特定测试用例或策略
    - **Technical Constraints**：version requirements、performance considerations、security rules
  - 每个技术细节都必须包含其源引用：`[Source: architecture/{filename}.md#{section}]`
  - 如果在架构文档中找不到某个类别的信息，明确说明："在架构文档中没找到具体指导"
- **`Tasks / Subtasks` 部分：**
  - 仅基于以下内容生成详细、顺序的技术任务列表：Epic Requirements、Story AC、Reviewed Architecture Information
  - 每个任务必须引用相关架构文档
  - 根据 Testing Strategy 将 unit testing 作为明确的子任务包含
  - 在适用时链接任务到 AC（例如，`Task 1 (AC: 1, 3)`）
- 添加在步骤 4 中发现的项目结构对齐或差异的笔记

### 6. Story Draft 完成和审查

- 审查所有部分的完整性和准确性
- 验证所有技术细节都包含源引用
- 确保任务与 epic requirements 和 architecture constraints 都对齐
- 更新状态为"Draft"并保存 story 文件
- 执行 `.bmad-core/tasks/execute-checklist` `.bmad-core/checklists/story-draft-checklist`
- 向用户提供摘要，包括：
  - 创建的 Story：`{devStoryLocation}/{epicNum}.{storyNum}.story.md`
  - 状态：Draft
  - 从架构文档中包含的关键 technical components
  - Epic 和架构之间注意到的任何 deviations 或 conflicts
  - Checklist Results
  - 下一步：对于复杂 stories，建议用户仔细审查 story draft，也可以选择让 PO 运行任务 `.bmad-core/tasks/validate-next-story`
