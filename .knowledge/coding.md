# RDMind 小红书开发规范

## 📚 快速导航

### 🎯 精准定位指南

**重要：专业规范文件已移动到扩展知识库，请使用 `read_knowledge_ext` 工具获取**

| 用户意图            | 对应文件             | 内容大小 | 获取方式             |
| ------------------- | -------------------- | -------- | -------------------- |
| **DDD架构设计**     | ddd-architecture.md  | 224行    | `read_knowledge_ext` |
| **Java开发规范**    | java-standards.md    | 315行    | `read_knowledge_ext` |
| **Thrift服务实现**  | thrift-service.md    | 298行    | `read_knowledge_ext` |
| **SQL建表规范**     | sql-standards.md     | 271行    | `read_knowledge_ext` |
| **MyBatis代码生成** | mybatis-standards.md | 410行    | `read_knowledge_ext` |

---

## 🔍 场景化精准查找

### 我需要...

#### 🏗️ **设计DDD架构**

- **场景**：分层架构设计、依赖关系管理、架构错误排查、代码开发检查
- **文件**：`ddd-architecture.md` (224行)
- **关键内容**：架构分层、依赖约束、实现顺序、架构错误解决方案、代码开发检查
- **获取方式**：`read_knowledge_ext` 工具

#### ☕ **编写Java代码**

- **场景**：值对象设计、Lombok使用、分层设计、Java错误排查、文件操作规范
- **文件**：`java-standards.md` (315行)
- **关键内容**：值对象规范、Lombok注解、分层设计、Java错误解决方案、文件操作规范
- **获取方式**：`read_knowledge_ext` 工具

#### 🔌 **实现Thrift服务**

- **场景**：Thrift服务开发、类型安全、错误处理、服务实现检查
- **文件**：`thrift-service.md` (298行)
- **关键内容**：服务实现规范、DTO使用规范、Thrift错误解决方案、服务实现检查
- **获取方式**：`read_knowledge_ext` 工具

#### 🗄️ **设计数据库表**

- **场景**：SQL建表、索引设计、数据库规范、数据库规范检查
- **文件**：`sql-standards.md` (271行)
- **关键内容**：建表规范、索引定义、SQL错误解决方案、数据库规范检查
- **获取方式**：`read_knowledge_ext` 工具

#### 🔧 **生成MyBatis代码**

- **场景**：Mapper生成、XML配置、DO对象设计、MyBatis代码检查
- **文件**：`mybatis-standards.md` (410行)
- **关键内容**：Mapper规范、XML规范、DO规范、MyBatis错误解决方案、MyBatis代码检查
- **获取方式**：`read_knowledge_ext` 工具

---

## 📖 优化后的文件结构

```
.knowledge/
├── coding.md                    ← 本索引文件（精准定位）
└── .ext/
    └── coding/
        ├── ddd-architecture.md          ← DDD架构规范（224行）
        ├── java-standards.md            ← Java开发规范（315行）
        ├── thrift-service.md            ← Thrift服务规范（298行）
        ├── sql-standards.md             ← SQL建表规范（271行）
        └── mybatis-standards.md         ← MyBatis规范（410行）
```

---

## 🚀 快速开始

### 按需加载策略

1. **首次使用**：AI行为规范已默认加载，无需额外操作
2. **开始开发**：使用 `read_knowledge_ext` 工具获取对应专业规范文件
3. **遇到问题**：通过 `read_knowledge_ext` 查看相关规范文件中的错误解决方案
4. **质量检查**：使用 `read_knowledge_ext` 获取各专业文件中的质量检查清单

### 扩展知识库使用说明

**重要：专业规范文件已移动到扩展知识库，需要使用 `read_knowledge_ext` 工具获取**

#### 使用方式

- **工具名称**：`read_knowledge_ext`
- **文件路径**：`.knowledge/.ext/coding/{文件名}`
- **示例**：`read_knowledge_ext .knowledge/.ext/coding/ddd-architecture.md`

#### 支持的文件

- `ddd-architecture.md` - DDD架构设计规范
- `java-standards.md` - Java开发规范
- `thrift-service.md` - Thrift服务实现规范
- `sql-standards.md` - SQL建表规范
- `mybatis-standards.md` - MyBatis代码生成规范

### 精准定位技巧

1. **明确意图**：先确定具体需要什么类型的规范
2. **选择文件**：根据意图选择最相关的文件
3. **使用工具**：通过 `read_knowledge_ext` 工具获取文件内容
4. **按需深入**：只深入阅读需要的部分

---

## 💡 使用建议

### 🎯 最小化加载原则

- **按需查阅**：根据当前任务使用 `read_knowledge_ext` 获取对应文件
- **精准定位**：使用场景指南快速定位
- **避免冗余**：不要加载不相关的内容
- **高效利用**：充分利用每个文件的专业性

### 📈 效率提升

- **场景驱动**：使用场景指南快速定位
- **内容精准**：每个文件内容高度聚焦
- **错误集成**：错误解决方案集成在相关规范中
- **检查集成**：质量检查清单集成在各专业文件中
- **默认加载**：AI行为规范已默认加载，无需额外操作
- **扩展知识库**：专业规范文件通过 `read_knowledge_ext` 工具按需获取

### 🔄 持续优化

- **反馈收集**：收集使用过程中的问题和建议
- **内容更新**：根据实际使用情况更新内容
- **结构优化**：持续优化文件结构和内容分配
- **工具支持**：开发自动化工具提高使用效率
