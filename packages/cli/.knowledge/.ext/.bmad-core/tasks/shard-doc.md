<!-- Powered by BMAD™ Core -->

# 文档分片任务

## 目标

- 按二级标题把大文档拆成多个小文档
- 建个文件夹结构来整理分片后的文档
- 保持所有内容完整，包括代码块、图表和markdown格式

## 主要方法：用markdown-tree自动分片

[[LLM: 先检查.bmad-core/core-config.yaml里markdownExploder是不是设为true。如果是，试试运行命令：`md-tree explode {input file} {output path}`。

如果命令成功了，告诉用户文档已经分片完成并停止 - 别继续了。

如果命令失败了（特别是提示命令找不到或不可用的错误），告诉用户："markdownExploder已经启用了但md-tree命令用不了。请选一个：

1. 全局装一下@kayvan/markdown-tree-parser：`npm install -g @kayvan/markdown-tree-parser`
2. 或者在.bmad-core/core-config.yaml里把markdownExploder设为false

**重要：先停一下 - 做完上面任一个操作再手动分片。**"

如果markdownExploder设为false，告诉用户："markdownExploder现在是false。为了更好的性能和稳定性，建议：

1. 在.bmad-core/core-config.yaml里把markdownExploder设为true
2. 全局装一下@kayvan/markdown-tree-parser：`npm install -g @kayvan/markdown-tree-parser`

我现在开始手动分片流程。"

然后只有markdownExploder是false的时候才继续下面的手动方法。]]

### 安装和使用

1. **全局装一下**：

   ```bash
   npm install -g @kayvan/markdown-tree-parser
   ```

2. **用explode命令**：

   ```bash
   # PRD文档
   md-tree explode docs/prd.md docs/prd

   # 架构文档
   md-tree explode docs/architecture.md docs/architecture

   # 任意文档
   md-tree explode [源文档] [目标文件夹]
   ```

3. **功能说明**：
   - 自动按二级标题拆文档
   - 创建正确命名的文件
   - 适当调整标题级别
   - 处理代码块和特殊markdown的所有边界情况

如果用户已经装了@kayvan/markdown-tree-parser，直接用并跳过下面的手动流程。

---

## 手动方法（如果@kayvan/markdown-tree-parser用不了或用户要手动）

### 任务说明

1. 识别文档和目标位置

- 确定要分片的文档（用户提供的路径）
- 在`docs/`下建个和文档同名的文件夹（不要扩展名）
- 示例：`docs/prd.md` → 建文件夹`docs/prd/`

2. 解析和提取章节

关键分片规则：

1. 读整个文档内容
2. 识别所有二级标题（## 标题）
3. 对每个二级标题：
   - 提取标题和到下一个二级标题的所有内容
   - 包括所有子章节、代码块、图表、列表、表格等
   - 特别注意：
     - 代码块（```）- 确保捕获完整块包括结束反引号，注意代码块中可能误导的##符号
     - Mermaid图表 - 保持完整的图表语法
     - 嵌套markdown元素
     - 可能包含##的多行内容

关键：用理解markdown上下文的正确解析。代码块中的##不是章节标题。]]

### 3. 创建单独文件

对每个提取的章节：

1. **生成文件名**：把章节标题转成小写连字符格式
   - 去掉特殊字符
   - 空格换成连字符
   - 示例："## Tech Stack" → `tech-stack.md`

2. **调整标题级别**：
   - 二级标题在新文档里变成一级标题（# 而不是 ##）
   - 所有子标题级别减1：

   ```txt
     - ### → ##
     - #### → ###
     - ##### → ####
     - 等等
   ```

3. **写入内容**：把调整后的内容存到新文件

### 4. 创建索引文件

在分片文件夹里建个`index.md`文件：

1. 包含原始一级标题和第一个二级标题之前的任何内容
2. 列出所有分片文件的链接：

```markdown
# 原始文档标题

[原始介绍内容（如有）]

## 章节

- [章节名称 1](./section-name-1.md)
- [章节名称 2](./section-name-2.md)
- [章节名称 3](./section-name-3.md)
  ...
```

### 5. 保持特殊内容

1. **代码块**：必须捕获完整块包括：

   ```language
   content
   ```

2. **Mermaid图表**：保持完整语法：

   ```mermaid
   graph TD
   ...
   ```

3. **表格**：保持正确的markdown表格格式

4. **列表**：保持缩进和嵌套

5. **行内代码**：保持反引号

6. **链接和引用**：保持所有markdown链接完整

7. **模板标记**：如果文档包含{{占位符}}，完全保持

### 6. 验证

分片后：

1. 验证所有章节都被提取
2. 检查没有内容丢失
3. 确保标题级别正确调整
4. 确认所有文件都成功创建

### 7. 报告结果

给个摘要：

```text
文档分片成功：
- 源文件：[原始文档路径]
- 目标位置：docs/[文件夹名]/
- 创建文件数：[数量]
- 章节：
  - section-name-1.md: "章节标题 1"
  - section-name-2.md: "章节标题 2"
  ...
```

## 重要说明

- 永远不要修改实际内容，只调整标题级别
- 保持所有格式，包括重要的空白字符
- 处理边界情况，如包含##符号的代码块章节
- 确保分片可逆（可以从分片重构原始文档）
