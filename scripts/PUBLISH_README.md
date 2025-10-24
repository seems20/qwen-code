# 发布脚本使用说明

## 概述

`publish.js` 脚本自动化了版本发布的整个流程，包括：

1. 更新所有包的版本号
2. 清理旧的构建文件
3. 构建项目
4. 发布到 npm

## 使用方法

### 1. 发布正式版本

```bash
# 发布指定版本号
npm run publish 0.0.13

# 或使用自动递增
npm run publish patch   # 0.0.12 → 0.0.13
npm run publish minor   # 0.0.12 → 0.1.0
npm run publish major   # 0.0.12 → 1.0.0
```

### 2. 发布 Alpha 测试版本

```bash
# 发布 alpha 版本
npm run publish 0.0.13-alpha.0 -- --tag alpha

# 发布 alpha 版本（递增）
npm run publish prerelease -- --tag alpha
```

### 3. 发布其他标签版本

```bash
# 发布 beta 版本
npm run publish 0.0.13-beta.0 -- --tag beta

# 发布 nightly 版本
npm run publish 0.0.13-nightly.20250115 -- --tag nightly
```

## 版本号格式

- **正式版本**: `0.0.13`, `1.0.0`, `2.1.5`
- **Alpha 版本**: `0.0.13-alpha.0`, `0.0.13-alpha.1`
- **Beta 版本**: `0.0.13-beta.0`, `0.0.13-beta.1`
- **Nightly 版本**: `0.0.13-nightly.20250115`

## 脚本流程详解

### 步骤 1: 更新版本号

- 自动更新所有包的 `package.json` 版本号
- 包括：root, cli, core, vscode-ide-companion, test-utils
- 同步更新 CLI 包对 Core 包的依赖版本
- 更新 `sandboxImageUri` 配置
- 运行 `npm install` 更新 `package-lock.json`

### 步骤 2: 清理构建文件

- 删除所有 `dist/` 目录
- 删除 `bundle/` 目录
- 清理所有临时文件

### 步骤 3: 构建项目

- 生成 Git 提交信息
- 运行 esbuild 打包
- 复制资源文件（template, .knowledge 等）
- 构建所有 workspace 包
- 构建 VSCode 扩展

### 步骤 4: 发布到 npm

- 使用 `npm publish --workspaces` 发布所有公开包
- 自动跳过 private 包（test-utils）
- 根据指定标签发布（latest/alpha/beta/nightly）

## 发布前检查清单

在运行发布脚本之前，请确保：

- [ ] 所有代码已提交到 Git
- [ ] 所有测试通过 (`npm test`)
- [ ] 代码已格式化 (`npm run format`)
- [ ] 代码已通过 linting (`npm run lint`)
- [ ] 已登录到 npm (`npm login`)
- [ ] 有发布权限（@rdmind scope）
- [ ] `.knowledge` 目录已复制到 `packages/cli/` 下

## 发布后验证

### 1. 检查 npm 包

```bash
# 查看已发布的版本
npm view @rdmind/rdmind versions

# 查看特定版本信息
npm view @rdmind/rdmind@0.0.13

# 查看 alpha 版本
npm view @rdmind/rdmind@alpha
```

### 2. 测试安装

```bash
# 在新目录测试安装
cd /tmp && mkdir test-rdmind && cd test-rdmind

# 安装正式版本
npm install -g @rdmind/rdmind

# 或安装 alpha 版本
npm install -g @rdmind/rdmind@alpha

# 验证版本
rdmind --version
```

### 3. 测试功能

```bash
# 测试基本功能
rdmind --help

# 测试认证
rdmind auth login

# 测试创建项目
mkdir test-project && cd test-project
# 在 rdmind 中运行: /create
```

## 故障排查

### 问题 1: 版本号更新失败

**错误信息**: `Error: No version specified.`

**解决方案**: 确保提供了有效的版本号参数

```bash
npm run publish 0.0.13
```

### 问题 2: 构建失败

**错误信息**: `Command failed: npm run build`

**解决方案**:

1. 检查代码是否有编译错误
2. 运行 `npm run clean` 清理后重试
3. 检查 TypeScript 类型错误

### 问题 3: 发布失败 - 权限问题

**错误信息**: `npm ERR! 403 Forbidden`

**解决方案**:

1. 确保已登录 npm: `npm login`
2. 检查是否有 @rdmind scope 的发布权限
3. 联系包的维护者添加权限

### 问题 4: 发布失败 - 版本冲突

**错误信息**: `npm ERR! 403 You cannot publish over the previously published versions`

**解决方案**:

1. 使用更高的版本号
2. 或使用不同的标签（如 alpha）

### 问题 5: .knowledge 目录未包含

**解决方案**:

```bash
# 确保 .knowledge 目录已复制到 cli 包
cp -r .knowledge packages/cli/

# 然后重新发布
npm run publish <version>
```

## 自动更新机制

### Latest 标签（正式版本）

- 用户运行 `npm update -g @rdmind/rdmind` 会自动更新到 latest 版本
- 自动更新检查只检测 latest 标签的新版本

### Alpha 标签（测试版本）

- 不会触发自动更新
- 用户需要手动安装: `npm install -g @rdmind/rdmind@alpha`
- 适合内部测试和提前体验新功能

## 最佳实践

1. **版本号管理**
   - 遵循语义化版本（SemVer）规范
   - Bug 修复使用 patch 版本
   - 新功能使用 minor 版本
   - 破坏性更改使用 major 版本

2. **发布频率**
   - 正式版本：稳定后发布，通常每 1-2 周
   - Alpha 版本：频繁发布，用于测试新功能
   - 紧急修复：随时发布 patch 版本

3. **Git 标签**
   - 发布后打 Git 标签：`git tag v0.0.13`
   - 推送标签：`git push origin v0.0.13`

4. **更新日志**
   - 记录每个版本的更改内容
   - 包含新功能、修复和破坏性更改

## 相关命令

```bash
# 只更新版本号（不构建和发布）
npm run release:version 0.0.13

# 只清理
npm run clean

# 只构建
npm run build

# 只发布（需要先手动构建）
npm publish --workspaces
npm publish --workspaces --tag alpha
```

## 联系方式

如有问题，请联系项目维护者或在 GitHub 上提 issue。
