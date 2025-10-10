<!-- Powered by BMAD™ Core -->

# test-design

给用户故事设计完整的测试方案，告诉你该在哪个层面做测试。

## 需要什么

```yaml
required:
  - story_id: '{epic}.{story}' # 比如："1.3"
  - story_path: '{devStoryLocation}/{epic}.{story}.*.md' # 从core-config.yaml来的路径
  - story_title: '{title}' # 没有的话，从故事文件的标题里拿
  - story_slug: '{slug}' # 没有的话，从标题生成（小写，用连字符）
```

## 要干啥

设计一套完整的测试策略，搞清楚测什么、在哪一层测（单元/集成/端到端），还有为啥这么测。这样既能保证测试覆盖到位，又不会重复测试，还能把测试边界划清楚。

## 要用到的文件

```yaml
data:
  - test-levels-framework.md # 单元/集成/端到端测试怎么选的标准
  - test-priorities-matrix.md # P0/P1/P2/P3优先级怎么分的
```

## 怎么做

### 1. 把需求拆开看

把每个验收标准掰开揉碎，看看能测什么。对每个AC：

- 找出核心功能要测啥
- 看看需要哪些数据变化
- 想想出错的情况
- 注意边界条件

### 2. 选测试级别

**参考：** 看看 `test-levels-framework.md` 里的详细标准

简单来说：

- **单元测试**：纯逻辑、算法、计算这些
- **集成测试**：组件之间怎么交互、数据库操作
- **端到端测试**：用户走完整个流程、合规性检查

### 3. 排优先级

**参考：** 看看 `test-priorities-matrix.md` 怎么分类的

优先级简单分法：

- **P0**：赚钱的、安全的、合规的
- **P1**：用户主要用的、高频功能
- **P2**：次要功能、管理后台
- **P3**：有就更好、基本用不到

### 4. 写测试场景

把每个要测的地方都写出来：

```yaml
test_scenario:
  id: '{epic}.{story}-{LEVEL}-{SEQ}'
  requirement: 'AC reference'
  priority: P0|P1|P2|P3
  level: unit|integration|e2e
  description: 'What is being tested'
  justification: 'Why this level was chosen'
  mitigates_risks: ['RISK-001'] # If risk profile exists
```

### 5. 检查覆盖全不全

确保：

- 每个AC都有测试
- 不同级别别重复测
- 重要流程多测几层
- 风险点都覆盖到

## 最后输出啥

### 输出1：测试设计文档

**存到：** `qa.qaLocation/assessments/{epic}.{story}-test-design-{YYYYMMDD}.md`

```markdown
# 测试设计：故事 {epic}.{story}

日期：{date}
设计者：Quinn（测试架构师）

## 测试策略概览

- 测试场景总数：X
- 单元测试：Y（A%）
- 集成测试：Z（B%）
- 端到端测试：W（C%）
- 优先级分布：P0: X, P1: Y, P2: Z

## 按验收标准的测试场景

### AC1：{description}

#### 场景

| ID           | 级别   | 优先级 | 测试内容     | 选择理由     |
| ------------ | ------ | ------ | ------------ | ------------ |
| 1.3-UNIT-001 | 单元   | P0     | 验证输入格式 | 纯验证逻辑   |
| 1.3-INT-001  | 集成   | P0     | 服务处理请求 | 多组件流程   |
| 1.3-E2E-001  | 端到端 | P1     | 用户完成流程 | 关键路径验证 |

[继续所有AC...]

## 风险覆盖

[如果有风险档案，把测试场景和风险对应上]

## 推荐执行顺序

1. P0单元测试（快速失败）
2. P0集成测试
3. P0端到端测试
4. 按顺序执行P1测试
5. 时间允许时执行P2+测试
```

### 输出2：质量门禁YAML块

给质量门禁用的：

```yaml
test_design:
  scenarios_total: X
  by_level:
    unit: Y
    integration: Z
    e2e: W
  by_priority:
    p0: A
    p1: B
    p2: C
  coverage_gaps: [] # 哪些AC没测试
```

### 输出3：追踪引用

给trace-requirements任务用的：

```text
测试设计矩阵：qa.qaLocation/assessments/{epic}.{story}-test-design-{YYYYMMDD}.md
找到的P0测试：{count}
```

## Quality Checklist

最后检查一下：

- [ ] 每个AC都有测试覆盖
- [ ] 测试级别选得合适（别过度测试）
- [ ] 不同级别别重复测
- [ ] 优先级和业务风险对得上
- [ ] 测试ID按规范命名
- [ ] 场景都是独立的，不互相影响

## 核心原则

- **左移测试**：能单元测试就别集成测试，能集成测试就别端到端测试
- **基于风险**：重点测容易出问题的地方
- **高效覆盖**：在合适的级别测一次就够了
- **可维护性**：考虑长期维护成本
- **快速反馈**：快的测试先跑
