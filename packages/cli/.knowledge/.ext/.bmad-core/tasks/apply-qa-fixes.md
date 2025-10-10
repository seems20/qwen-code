<!-- Powered by BMAD™ Core -->

# apply-qa-fixes

基于特定story的QA结果（gate和评估）实现修复。这个任务让Dev代理系统性地处理QA输出并应用代码/测试变更，同时只更新story文件中允许的部分。

## 目的

- 读取story的QA输出（gate YAML + 评估markdown）
- 创建优先级的、确定性的修复计划
- 应用代码和测试变更来关闭差距并解决问题
- 只更新Dev代理允许的story部分

## 输入

```yaml
required:
  - story_id: '{epic}.{story}' # 比如 "2.2"
  - qa_root: 来自 `bmad-core/core-config.yaml` 键 `qa.qaLocation` (比如 `docs/project/qa`)
  - story_root: 来自 `bmad-core/core-config.yaml` 键 `devStoryLocation` (比如 `docs/project/stories`)

optional:
  - story_title: '{title}' # 如果缺失，从story H1推导
  - story_slug: '{slug}' # 如果缺失，从标题推导（小写，连字符分隔）
```

## 要读取的QA源

- gate (YAML): `{qa_root}/gates/{epic}.{story}-*.yml`
  - 如果有多个，使用修改时间最新的
- 评估 (Markdown):
  - Test Design: `{qa_root}/assessments/{epic}.{story}-test-design-*.md`
  - Traceability: `{qa_root}/assessments/{epic}.{story}-trace-*.md`
  - Risk Profile: `{qa_root}/assessments/{epic}.{story}-risk-*.md`
  - NFR Assessment: `{qa_root}/assessments/{epic}.{story}-nfr-*.md`

## 先决条件

- 仓库在本地构建和测试运行（Deno 2）
- 可用的lint和测试命令：
  - `deno lint`
  - `deno test -A`

## 流程（不要跳过步骤）

### 0) 加载核心配置和定位Story

- 读取 `bmad-core/core-config.yaml` 并解析 `qa_root` 和 `story_root`
- 在 `{story_root}/{epic}.{story}.*.md` 中定位story文件
  - 如果缺失则停止并询问正确的story id/路径

### 1) 收集QA发现

- 解析最新的gate YAML：
  - `gate` (PASS|CONCERNS|FAIL|WAIVED)
  - `top_issues[]` 包含 `id`, `severity`, `finding`, `suggested_action`
  - `nfr_validation.*.status` 和注释
  - `trace` 覆盖率总结/差距
  - `test_design.coverage_gaps[]`
  - `risk_summary.recommendations.must_fix[]` (如果存在)
- 读取任何存在的评估markdown并提取明确的差距/建议

### 2) 构建确定性修复计划（优先级顺序）

按顺序应用，最高优先级优先：

1. `top_issues` 中的高严重性项目（安全/性能/可靠性/可维护性）
2. NFR状态：所有FAIL必须修复 → 然后CONCERNS
3. Test Design `coverage_gaps`（如果指定，优先P0场景）
4. 未覆盖的Trace需求（AC级别）
5. Risk `must_fix` 建议
6. 中等严重性问题，然后低严重性

指导：

- 优先在代码变更之前/同时添加测试来关闭覆盖率差距
- 保持变更最小化和针对性；遵循项目架构和TS/Deno规则

### 3) 应用变更

- 按计划实现代码修复
- 添加缺失的测试来关闭覆盖率差距（优先单元测试；AC要求的集成测试）
- 通过 `deps.ts` 保持导入集中化（见 `docs/project/typescript-rules.md`）
- 遵循 `src/core/di.ts` 中的DI边界和现有模式

### 4) 验证

- 运行 `deno lint` 并修复问题
- 运行 `deno test -A` 直到所有测试通过
- 迭代直到干净

### 5) 更新Story（仅允许的部分）

关键：Dev代理仅被授权更新story文件的这些部分。不要修改任何其他部分（比如，QA结果、Story、验收标准、开发笔记、测试）：

- Tasks / Subtasks Checkboxes（标记你添加的任何修复子任务为完成）
- Dev Agent Record →
  - Agent Model Used（如果更改）
  - Debug Log References（命令/结果，比如lint/测试）
  - Completion Notes List（更改了什么，为什么，如何）
  - File List（所有添加/修改/删除的文件）
- Change Log（新的日期条目描述应用的修复）
- Status（见下面的规则）

状态规则：

- 如果gate是PASS且所有识别的差距都已关闭 → 设置 `Status: Ready for Done`
- 否则 → 设置 `Status: Ready for Review` 并通知QA重新运行评审

### 6) 不要编辑gate文件

- Dev不修改gate YAML。如果修复解决了问题，请求QA重新运行 `review-story` 来更新gate

## 阻塞条件

- 缺失 `bmad-core/core-config.yaml`
- 找不到 `story_id` 的story文件
- 没有找到QA工件（既没有gate也没有评估）
  - 停止并请求QA生成至少一个gate文件（或仅在有明确的开发者提供的修复列表时继续）

## 完成Checklist

- deno lint: 0个问题
- deno test -A: 所有测试通过
- 所有高严重性 `top_issues` 已解决
- NFR FAIL → 已解决；CONCERNS最小化或已记录
- 覆盖率差距已关闭或已明确记录理由
- Story已更新（仅允许的部分）包括文件列表和变更日志
- 根据状态规则设置状态

## 示例：Story 2.2

给定gate `docs/project/qa/gates/2.2-*.yml` 显示

- `coverage_gaps`: Back action行为未测试（AC2）
- `coverage_gaps`: 集中化依赖执行未测试（AC4）

修复计划：

- 添加测试确保Toolkit Menu "Back" action返回到Main Menu
- 添加静态测试验证service/view的导入通过 `deps.ts`
- 重新运行lint/测试并相应更新Dev Agent Record + File List

## 关键原则

- 确定性的、风险优先的优先级排序
- 最小化、可维护的变更
- 测试验证行为并关闭差距
- 严格遵循允许的story更新区域
- gate所有权仍归QA；Dev通过状态信号准备就绪
