# BMAD 扩展知识库索引

## 📚 快速导航

### 🎯 精准定位指南

**重要：Agent角色文件已移动到扩展知识库，请使用 `read_knowledge_ext` 工具获取**

| 用户意图     | 对应文件                    | 触发命令             | 获取方式             |
| ------------ | --------------------------- | -------------------- | -------------------- |
| **全栈开发** | agents/dev.md               | `*dev`               | `read_knowledge_ext` |
| **系统架构** | agents/architect.md         | `*architect`         | `read_knowledge_ext` |
| **质量保证** | agents/qa.md                | `*qa`                | `read_knowledge_ext` |
| **敏捷管理** | agents/sm.md                | `*sm`                | `read_knowledge_ext` |
| **产品管理** | agents/po.md                | `*po`                | `read_knowledge_ext` |
| **产品策略** | agents/pm.md                | `*pm`                | `read_knowledge_ext` |
| **需求分析** | agents/ra.md                | `*ra`                | `read_knowledge_ext` |
| **用户体验** | agents/ux-expert.md         | `*ux-expert`         | `read_knowledge_ext` |
| **系统编排** | agents/bmad-orchestrator.md | `*bmad-orchestrator` | `read_knowledge_ext` |

---

## 🔍 场景化精准查找

### 我需要...

#### 💻 **进行软件开发**

- **场景**：代码实现、调试、重构、开发最佳实践
- **文件**：`agents/dev.md`
- **触发命令**：`*dev`
- **关键内容**：全栈开发者Agent定义、开发流程、任务执行
- **获取方式**：`read_knowledge_ext` 工具

#### 🏗️ **设计系统架构**

- **场景**：系统设计、架构文档、技术选择、API设计、基础设施规划
- **文件**：`agents/architect.md`
- **触发命令**：`*architect`
- **关键内容**：系统架构师Agent定义、架构原则、技术选择
- **获取方式**：`read_knowledge_ext` 工具

#### 🧪 **进行质量保证**

- **场景**：测试架构审查、质量门决策、代码改进
- **文件**：`agents/qa.md`
- **触发命令**：`*qa`
- **关键内容**：测试架构师Agent定义、质量分析、风险评估
- **获取方式**：`read_knowledge_ext` 工具

#### 🏃 **管理敏捷流程**

- **场景**：故事创建、史诗管理、敏捷流程指导
- **文件**：`agents/sm.md`
- **触发命令**：`*sm`
- **关键内容**：Scrum Master Agent定义、故事准备、流程管理
- **获取方式**：`read_knowledge_ext` 工具

#### 📝 **管理产品需求**

- **场景**：待办事项管理、故事细化、验收标准、冲刺规划、优先级决策
- **文件**：`agents/po.md`
- **触发命令**：`*po`
- **关键内容**：产品负责人Agent定义、需求管理、流程遵守
- **获取方式**：`read_knowledge_ext` 工具

#### 📋 **制定产品策略**

- **场景**：创建PRD、产品策略、功能优先级、路线图规划、利益相关者沟通
- **文件**：`agents/pm.md`
- **触发命令**：`*pm`
- **关键内容**：产品经理Agent定义、产品策略、市场研究
- **获取方式**：`read_knowledge_ext` 工具

#### 📊 **分析技术需求**

- **场景**：将PRD转化为技术需求文档、需求分析、技术规格制定、架构指导
- **文件**：`agents/ra.md`
- **触发命令**：`*ra`
- **关键内容**：需求分析师Agent定义、技术需求分析、TRD文档创建
- **获取方式**：`read_knowledge_ext` 工具

#### 🎨 **设计用户体验**

- **场景**：UI/UX设计、线框图、原型、前端规范、用户体验优化
- **文件**：`agents/ux-expert.md`
- **触发命令**：`*ux-expert`
- **关键内容**：UX专家Agent定义、用户研究、交互设计
- **获取方式**：`read_knowledge_ext` 工具

#### 🎭 **协调多Agent工作**

- **场景**：工作流协调、多Agent任务、角色切换指导、不确定选择哪个专家时
- **文件**：`agents/bmad-orchestrator.md`
- **触发命令**：`*bmad-orchestrator`
- **关键内容**：BMAD编排器Agent定义、工作流管理、角色协调
- **获取方式**：`read_knowledge_ext` 工具

#### 🔧 **了解系统工具**

- **场景**：工具使用说明、扩展知识库访问、目录结构探索
- **文件**：本文件（BMAD.md）
- **关键内容**：工具使用指南、目录结构、最佳实践
- **获取方式**：直接查看本文件

---

## 📖 优化后的文件结构

```
.knowledge/
├── BMAD.md                     ← 本索引文件（包含工具说明）
└── .ext/
    └── .bmad-core/
        └── agents/
            ├── dev.md          ← 全栈开发者Agent
            ├── architect.md    ← 系统架构师Agent
            ├── qa.md           ← 测试架构师Agent
            ├── sm.md           ← Scrum Master Agent
            ├── po.md           ← 产品负责人Agent
            ├── pm.md           ← 产品经理Agent
            ├── ux-expert.md    ← UX专家Agent
            ├── bmad-orchestrator.md ← BMAD编排器Agent
            └── ...             ← 其他Agent角色
```

---

## 🚀 快速开始

### 按需加载策略

1. **首次使用**：查看本索引文件了解可用Agent
2. **选择角色**：根据具体需求选择对应Agent角色文件
3. **激活Agent**：使用对应的触发命令激活Agent
4. **获取帮助**：激活后使用`*help`命令查看可用功能

### 扩展知识库使用说明

**重要：Agent角色文件已移动到扩展知识库，需要使用专用工具获取**

#### 工具使用说明

BMAD系统提供了两个专用工具来访问扩展知识库：

##### 1. `read_knowledge_ext` - 读取扩展知识库文件

- **用途**: 按需读取`.knowledge/.ext`目录中的文件内容
- **参数**: `relativePath` - 相对于`.knowledge/.ext/`的路径
- **示例**:
  - `read_knowledge_ext(".bmad-core/role/dev.md")`
  - `read_knowledge_ext(".bmad-core/core-config.yaml")`
  - `read_knowledge_ext(".bmad-core/tasks/create-doc.md")`

##### 2. `list_knowledge_ext` - 列出扩展知识库目录

- **用途**: 探索`.knowledge/.ext`目录结构
- **参数**: `subPath` (可选) - 要列出的子路径
- **示例**:
  - `list_knowledge_ext()` - 列出根目录
  - `list_knowledge_ext(".bmad-core")` - 列出.bmad-core目录
  - `list_knowledge_ext(".bmad-core/role")` - 列出role目录

##### 使用原则

- **按需读取**: 不要一次性加载所有文件，只在需要时读取特定文件
- **探索结构**: 使用`list_knowledge_ext`先了解目录结构
- **精确路径**: 使用准确的相对路径来读取文件
- **激活时限制**: 在agent激活时，只读取`core-config.yaml`，不要读取其他文件
- **用户驱动**: 只有在用户明确请求特定任务或命令时，才读取相关的任务文件
- **避免批量读取**: 不要因为发现引用就自动读取所有相关文件

#### 使用场景

##### 场景1：查看特定Agent角色

```bash
# 查看全栈开发者Agent定义
read_knowledge_ext(".bmad-core/agents/dev.md")

# 查看系统架构师Agent定义
read_knowledge_ext(".bmad-core/agents/architect.md")

# 查看产品经理Agent定义
read_knowledge_ext(".bmad-core/agents/pm.md")
```

##### 场景2：探索可用角色

```bash
# 列出所有可用角色
list_knowledge_ext(".bmad-core/agents")
```

##### 场景3：查看任务和模板

```bash
# 查看可用任务
list_knowledge_ext(".bmad-core/tasks")

# 查看可用模板
list_knowledge_ext(".bmad-core/templates")
```

##### 场景4：Agent激活时

```bash
# 仅读取核心配置
read_knowledge_ext(".bmad-core/core-config.yaml")
```

#### 支持的文件

- `agents/dev.md` - 全栈开发者Agent (`*dev`)
- `agents/architect.md` - 系统架构师Agent (`*architect`)
- `agents/qa.md` - 测试架构师Agent (`*qa`)
- `agents/sm.md` - Scrum Master Agent (`*sm`)
- `agents/po.md` - 产品负责人Agent (`*po`)
- `agents/pm.md` - 产品经理Agent (`*pm`)
- `agents/ra.md` - 需求分析师Agent (`*ra`)
- `agents/ux-expert.md` - UX专家Agent (`*ux-expert`)
- `agents/bmad-orchestrator.md` - BMAD编排器Agent (`*bmad-orchestrator`)

### 精准定位技巧

1. **明确意图**：先确定具体需要什么类型的Agent
2. **选择文件**：根据意图选择最相关的Agent文件
3. **使用工具**：通过 `read_knowledge_ext` 工具获取文件内容
4. **激活Agent**：使用对应的触发命令激活Agent

---

## 💡 使用建议

### 🎯 最小化加载原则

- **按需查阅**：根据当前任务使用 `read_knowledge_ext` 获取对应Agent文件
- **精准定位**：使用场景指南快速定位
- **避免冗余**：不要加载不相关的内容
- **高效利用**：充分利用每个Agent的专业性

### 📈 效率提升

- **场景驱动**：使用场景指南快速定位
- **内容精准**：每个Agent文件内容高度聚焦
- **按需激活**：只在需要时激活特定Agent
- **工具支持**：通过 `read_knowledge_ext` 工具实现精准内容获取
- **扩展知识库**：Agent角色文件通过 `read_knowledge_ext` 工具按需获取

### 🔄 持续优化

- **反馈收集**：收集使用过程中的问题和建议
- **内容更新**：根据实际使用情况更新内容
- **结构优化**：持续优化文件结构和内容分配
- **工具支持**：开发自动化工具提高使用效率
