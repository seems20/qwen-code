# RDMind 无头模式案例集

本文档展示 RDMind 在无头模式（非交互模式）下的强大应用场景，这些案例体现了 CLI 模式在自动化、批处理和集成方面的优势。

## 什么是无头模式？

无头模式（Headless Mode）是指使用 `--prompt` 或 `-p` 参数直接传递指令，无需交互式界面的运行方式。结合 `--yolo` 或 `--approval-mode=yolo` 可以实现完全自动化的执行。

### 基本用法

```bash
# 非交互模式
rdmind --prompt "你的指令"

# 自动批准所有操作（完全自动化）
rdmind --prompt "你的指令" --yolo

# 从标准输入读取
echo "你的指令" | rdmind

# 计划模式（只规划不执行）
rdmind --prompt "你的指令" --approval-mode plan
```

## 核心优势

1. **可集成性**：可以轻松集成到脚本、CI/CD 流程中
2. **可重复性**：相同的命令可以重复执行，结果一致
3. **可批处理**：可以批量处理多个任务
4. **可管道化**：支持标准输入输出，可以与其他工具组合使用

---

## 案例 1: 批量代码重构

### 场景

需要将项目中的某个 API 调用从旧版本迁移到新版本，涉及多个文件。

### 实现

```bash
#!/bin/bash
# 批量重构脚本

# 使用 rdmind 自动重构所有相关文件
rdmind --prompt "将项目中所有使用旧 API v1 的地方迁移到新 API v2。旧 API 格式：oldApi.v1.method()，新 API 格式：newApi.v2.method()。请分析代码库，找到所有使用旧 API 的地方并更新。" --yolo --all-files

# 如果需要更精细的控制，可以先规划
rdmind --prompt "分析项目中旧 API v1 的使用情况，生成迁移计划" --approval-mode plan > migration-plan.txt

# 然后执行迁移
rdmind --prompt "$(cat migration-plan.txt)" --yolo
```

### 优势

- 自动分析整个代码库
- 批量处理多个文件
- 无需人工干预

---

## 案例 2: 自动化代码审查

### 场景

在 CI/CD 流程中自动检查代码质量和安全问题。

### 实现

```bash
#!/bin/bash
# CI/CD 代码审查脚本

# 检查代码质量问题
rdmind --prompt "检查最近修改的代码（git diff）是否存在以下问题：
1. 潜在的空指针异常
2. 未处理的异常
3. 资源泄漏（未关闭的文件、连接等）
4. 性能问题（低效的循环、不必要的数据库查询）
5. 安全漏洞（SQL注入、XSS等）
请生成详细的审查报告。" \
  --yolo \
  --all-files > code-review-report.txt

# 检查代码风格
rdmind --prompt "检查代码是否符合项目的编码规范：
1. 命名规范
2. 注释完整性
3. 代码格式
4. 导入顺序
生成格式化的检查报告。" \
  --yolo \
  --all-files > style-check.txt

# 如果发现问题，自动修复（谨慎使用）
if grep -q "需要修复" code-review-report.txt; then
  rdmind --prompt "根据代码审查报告，自动修复可以安全修复的问题" --yolo
fi
```

### 优势

- 集成到 CI/CD 流程
- 自动化质量检查
- 可配置的检查规则

---

## 案例 3: 智能测试生成

### 场景

为新添加的功能自动生成单元测试。

### 实现

```bash
#!/bin/bash
# 自动生成测试脚本

# 为最近修改的文件生成测试
rdmind --prompt "分析最近修改的源代码文件（git diff），为每个修改的类和方法生成完整的单元测试。测试应该包括：
1. 正常情况的测试用例
2. 边界条件测试
3. 异常情况测试
4. 使用适当的测试框架（JUnit、Jest等）
5. 确保测试覆盖率 > 80%" \
  --yolo \
  --all-files

# 针对特定文件生成测试
rdmind --prompt "为 src/services/UserService.ts 生成完整的单元测试，包括所有公共方法的测试用例" --yolo
```

### 优势

- 快速生成测试代码
- 提高测试覆盖率
- 减少手动编写测试的时间

---

## 案例 4: 文档自动生成和更新

### 场景

自动生成 API 文档、更新 README、生成变更日志。

### 实现

```bash
#!/bin/bash
# 文档生成脚本

# 生成 API 文档
rdmind --prompt "分析项目中所有的 API 接口（REST、GraphQL等），生成完整的 API 文档，包括：
1. 接口路径和方法
2. 请求参数说明
3. 响应格式
4. 示例代码
5. 错误码说明
输出到 docs/api.md" \
  --yolo \
  --all-files

# 更新 README
rdmind --prompt "根据最新的代码变更，更新项目的 README.md 文件，包括：
1. 项目概述
2. 安装步骤
3. 使用方法
4. 配置说明
5. 最新的功能列表" \
  --yolo

# 生成变更日志
rdmind --prompt "分析 git 提交历史，生成 CHANGELOG.md，包括：
1. 新功能
2. Bug 修复
3. 性能优化
4. 破坏性变更
按时间倒序排列" \
  --yolo
```

### 优势

- 保持文档与代码同步
- 减少文档维护工作
- 自动化的文档更新流程

---

## 案例 5: 代码迁移和升级

### 场景

将项目从旧框架迁移到新框架，或升级依赖版本。

### 实现

```bash
#!/bin/bash
# 框架迁移脚本

# 第一步：分析迁移范围
rdmind --prompt "分析项目，确定从框架 A 迁移到框架 B 需要修改的范围：
1. 列出所有使用框架 A 的文件
2. 识别需要迁移的 API 调用
3. 分析依赖关系
4. 生成迁移计划" \
  --approval-mode plan > migration-plan.txt

# 第二步：执行迁移
rdmind --prompt "$(cat migration-plan.txt)" \
  --yolo \
  --all-files

# 第三步：更新依赖
rdmind --prompt "更新 package.json/dependencies 中的框架依赖版本，确保兼容性" --yolo

# 第四步：验证迁移
rdmind --prompt "检查迁移后的代码是否有语法错误、类型错误或运行时问题" --yolo
```

### 优势

- 系统化的迁移流程
- 减少人工错误
- 可追溯的迁移历史

---

## 案例 6: 性能分析和优化

### 场景

自动分析代码性能瓶颈并提供优化建议。

### 实现

```bash
#!/bin/bash
# 性能分析脚本

# 分析性能问题
rdmind --prompt "分析代码库，识别潜在的性能问题：
1. 低效的算法（O(n²) 等）
2. 不必要的数据库查询（N+1 问题）
3. 内存泄漏
4. 未优化的循环
5. 重复计算
生成详细的性能分析报告，包括问题位置和优化建议。" \
  --yolo \
  --all-files > performance-report.txt

# 自动优化可以安全优化的部分
rdmind --prompt "根据性能分析报告，自动应用以下优化：
1. 使用缓存减少重复计算
2. 优化数据库查询（添加索引提示、批量查询）
3. 使用更高效的算法
4. 减少不必要的循环嵌套
只优化可以安全自动化的部分，不改变业务逻辑。" \
  --yolo
```

### 优势

- 系统化的性能分析
- 自动化的优化建议
- 可量化的性能提升

---

## 案例 7: 批量代码格式化

### 场景

统一代码风格，修复常见的代码格式问题。

### 实现

```bash
#!/bin/bash
# 代码格式化脚本

# 统一代码风格
rdmind --prompt "统一项目中所有代码的风格：
1. 缩进（使用 2 个空格或 4 个空格，根据项目配置）
2. 行尾空白
3. 导入语句排序
4. 花括号位置
5. 变量命名风格
确保所有文件符合项目的 .prettierrc 或 .eslintrc 配置" \
  --yolo \
  --all-files

# 修复常见的代码问题
rdmind --prompt "修复代码中的常见问题：
1. 未使用的导入
2. 未使用的变量
3. 可以简化的表达式
4. 魔法数字替换为常量
5. 过长的函数拆分" \
  --yolo
```

### 优势

- 统一团队代码风格
- 提高代码可读性
- 减少代码审查时间

---

## 案例 8: 集成到 CI/CD 流程

### 场景

在 GitHub Actions、GitLab CI 等 CI/CD 平台中使用 RDMind。

### 实现

```yaml
# .github/workflows/auto-fix.yml
name: Auto Code Fix

on:
  pull_request:
    paths:
      - 'src/**'

jobs:
  auto-fix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install RDMind
        run: npm install -g @rdmind/rdmind

      - name: Run Code Analysis
        run: |
          rdmind --prompt "分析 Pull Request 的代码变更，检查：
          1. 是否有明显的 bug
          2. 是否符合编码规范
          3. 是否有安全问题
          生成检查报告" \
            --yolo \
            --all-files > pr-review.txt

      - name: Auto Fix Issues
        if: github.event_name == 'pull_request'
        run: |
          rdmind --prompt "根据代码审查报告，自动修复可以安全修复的问题（如格式化、未使用的导入等）" \
            --yolo

      - name: Upload Review Report
        uses: actions/upload-artifact@v3
        with:
          name: code-review-report
          path: pr-review.txt
```

### 优势

- 自动化代码质量检查
- 减少人工审查工作量
- 持续集成的最佳实践

---

## 案例 9: 代码库探索和分析

### 场景

快速理解新加入的代码库，生成项目概览和架构文档。

### 实现

```bash
#!/bin/bash
# 代码库分析脚本

# 生成项目概览
rdmind --prompt "分析这个代码库，生成详细的项目概览文档，包括：
1. 项目目的和功能
2. 技术栈
3. 项目结构
4. 主要模块和组件
5. 数据流和架构图
6. 关键依赖关系
输出到 docs/project-overview.md" \
  --yolo \
  --all-files

# 分析代码质量
rdmind --prompt "分析代码库的质量指标：
1. 代码复杂度
2. 测试覆盖率
3. 依赖关系健康度
4. 潜在的架构问题
生成质量报告到 docs/quality-report.md" \
  --yolo \
  --all-files

# 生成架构图（使用 Mermaid）
rdmind --prompt "分析代码库的架构，生成 Mermaid 格式的架构图，包括：
1. 模块关系图
2. 类图
3. 数据流图
输出到 docs/architecture.md" \
  --yolo
```

### 优势

- 快速理解大型代码库
- 自动生成文档
- 便于新成员上手

---

## 案例 10: 智能代码补全和修复

### 场景

自动修复编译错误、类型错误、测试失败等。

### 实现

```bash
#!/bin/bash
# 自动修复脚本

# 修复编译错误
rdmind --prompt "分析编译错误，自动修复所有可以修复的问题：
1. 语法错误
2. 类型错误
3. 导入错误
4. 未定义的变量
5. 方法签名不匹配
确保修复后的代码能够编译通过" \
  --yolo

# 修复测试失败
rdmind --prompt "分析失败的测试用例，修复所有测试：
1. 更新过时的断言
2. 修复测试数据
3. 更新 Mock 对象
4. 修复异步测试问题
确保所有测试都能通过" \
  --yolo \
  --all-files

# 修复类型错误（TypeScript）
rdmind --prompt "修复所有 TypeScript 类型错误：
1. 添加缺失的类型定义
2. 修复类型不匹配
3. 更新接口定义
4. 修复泛型使用
确保代码通过类型检查" \
  --yolo
```

### 优势

- 快速修复常见错误
- 减少调试时间
- 提高开发效率

---

## 高级技巧

### 1. 组合多个命令

```bash
# 使用管道组合多个任务
rdmind --prompt "分析代码" --yolo | \
  rdmind --prompt "根据分析结果生成优化建议" --yolo | \
  rdmind --prompt "应用优化建议" --yolo
```

### 2. 使用标准输入

```bash
# 从文件读取指令
cat instructions.txt | rdmind --yolo

# 从其他工具的输出作为输入
git diff | rdmind --prompt "分析这些代码变更，生成审查报告" --yolo
```

### 3. 条件执行

```bash
#!/bin/bash
# 根据条件执行不同的任务

if [ "$CI_COMMIT_BRANCH" == "main" ]; then
  rdmind --prompt "生产环境部署前的最终检查" --yolo
else
  rdmind --prompt "开发分支的常规检查" --yolo
fi
```

### 4. 错误处理

```bash
#!/bin/bash
# 带错误处理的自定义脚本

if ! rdmind --prompt "执行任务" --yolo; then
  echo "任务失败，尝试修复..."
  rdmind --prompt "分析失败原因并尝试修复" --yolo
  exit 1
fi
```

### 5. 并行处理

```bash
#!/bin/bash
# 并行处理多个任务

# 使用后台任务
rdmind --prompt "任务1" --yolo > output1.txt &
rdmind --prompt "任务2" --yolo > output2.txt &
rdmind --prompt "任务3" --yolo > output3.txt &

# 等待所有任务完成
wait
```

---

## 最佳实践

1. **渐进式自动化**：从简单的任务开始，逐步增加复杂度
2. **使用计划模式**：在执行大规模操作前，先用 `--approval-mode plan` 预览
3. **版本控制**：在执行自动化操作前，确保代码已提交到版本控制
4. **备份重要数据**：在执行大规模重构前，创建备份
5. **测试验证**：自动化操作后，运行测试确保功能正常
6. **日志记录**：保存操作日志，便于问题追踪
7. **权限控制**：在 CI/CD 中使用时，限制可执行的操作范围

---

## 总结

RDMind 的无头模式为开发者提供了强大的自动化能力，可以：

- ✅ 批量处理代码库
- ✅ 集成到 CI/CD 流程
- ✅ 自动化代码审查和修复
- ✅ 生成文档和报告
- ✅ 执行大规模重构
- ✅ 性能分析和优化

这些案例展示了 CLI 模式在自动化场景下的强大性和灵活性，是提高开发效率的重要工具。
