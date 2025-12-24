# 发布脚本使用说明

## 概述

`publish.js` 脚本自动化了版本发布的整个流程，使用**单包打包模式**（Bundle Distribution），包括：

1. 更新所有包的版本号
2. 清理旧的构建文件
3. 打包项目（esbuild bundle）
4. 准备发布包元数据
5. 发布到 npm

### 架构变更说明

项目已从**多包模式**迁移到**单包打包模式**：

**旧架构（多包模式）**：

- 发布 `@rdmind/rdmind` 和 `@rdmind/rdmind-core` 两个包
- 使用 `npm publish --workspaces`
- 需要管理包之间的依赖关系

**新架构（单包打包模式）**：

- 只发布单个包 `@rdmind/rdmind`
- 使用 esbuild 将所有代码打包到 `dist/cli.js`
- 包含平台相关的 ripgrep 二进制文件在 `dist/vendor/`
- 从 `dist/` 目录直接发布

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

### 步骤 2: 清理旧的构建文件

- 删除根目录的 `dist/` 目录
- 删除所有工作空间的 `dist/` 目录
- 清理所有临时文件

### 步骤 3: 打包项目（Bundle）

执行 `npm run bundle`，包含以下操作：

- 删除并重新创建 `dist/` 目录
- 生成 Git 提交信息
- 使用 esbuild 打包 CLI 代码到 `dist/cli.js`
  - 设置 `packages: 'bundle'` 进行激进打包
  - 添加 Node.js shims 以提高 ESM 兼容性
  - 目标平台：Node.js 20+
- 复制 sandbox 配置文件（\*.sb）到 `dist/`
- 复制 ripgrep 二进制文件到 `dist/vendor/`（包含所有平台）

### 步骤 4: 准备发布包

执行 `npm run prepare:package`，包含以下操作：

- 验证 `dist/cli.js` 和 `dist/vendor/` 存在
- 复制 `README.md` 和 `LICENSE` 到 `dist/`
- 复制模板和知识库文件：
  - `packages/cli/template/` → `dist/template/`（Maven 项目模板）
  - `packages/cli/templates/` → `dist/templates/`（技术设计模板）
  - `packages/cli/.knowledge/` → `dist/.knowledge/`（知识库文件）
- 创建 `dist/package.json`，包含：
  - 基本元数据（name, version, description）
  - `bin: { rdmind: 'cli.js' }`
  - `files: ['cli.js', 'vendor', '*.sb', 'template', 'templates', '.knowledge', 'README.md', 'LICENSE']`
  - 运行时依赖（仅 tiktoken）
  - 可选依赖（node-pty 系列）

### 步骤 5: 发布到 npm

- 从 `dist/` 目录执行 `npm publish`
- 根据指定标签发布（latest/alpha/beta/nightly）
- 发布包只包含运行时必要的文件

## 发布包结构

发布后的包结构：

```
@rdmind/rdmind/
├── cli.js                      # 打包后的 CLI 入口（单文件）
├── vendor/                     # 平台二进制文件
│   └── ripgrep/
│       ├── arm64-darwin/rg     # macOS Apple Silicon
│       ├── x64-darwin/rg       # macOS Intel
│       ├── arm64-linux/rg      # Linux ARM64
│       ├── x64-linux/rg        # Linux x64
│       └── x64-win32/rg.exe    # Windows x64
├── template/                   # 项目模板
│   └── sns-demo/               # Maven 项目模板
├── templates/                  # 文档模板
│   └── tech-design-template.md
├── .knowledge/                 # 知识库文件
│   ├── BMAD.md
│   ├── coding.md
│   └── .ext/
├── *.sb                        # macOS sandbox 配置
├── README.md
├── LICENSE
└── package.json
```

## 发布前检查清单

在运行发布脚本之前，请确保：

- [ ] 所有代码已提交到 Git
- [ ] 所有测试通过 (`npm run test`)
- [ ] 代码已格式化 (`npm run format`)
- [ ] 代码已通过 linting (`npm run lint`)
- [ ] 已登录到 npm (`npm login`)
- [ ] 有发布权限（@rdmind scope）
- [ ] 版本号符合语义化版本规范
- [ ] CHANGELOG 已更新（如有必要）

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

### 问题 5: 打包失败

**错误信息**: `Error: Bundle not found at dist/cli.js`

**解决方案**:

```bash
# 清理后重新打包
npm run clean
npm run bundle

# 检查 dist 目录是否生成
ls -lh dist/
```

### 问题 6: 模板文件未包含

**解决方案**:

```bash
# 确保源文件存在
ls -la packages/cli/template
ls -la packages/cli/templates
ls -la packages/cli/.knowledge

# 重新运行准备脚本
npm run prepare:package
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

## 关键差异：新旧架构对比

| 项目       | 旧架构（多包模式）          | 新架构（单包打包模式）   |
| ---------- | --------------------------- | ------------------------ |
| 发布包数量 | 2个（rdmind + rdmind-core） | 1个（rdmind）            |
| 构建方式   | TypeScript 编译             | esbuild 打包             |
| 构建命令   | `npm run build`             | `npm run bundle`         |
| 发布命令   | `npm publish --workspaces`  | `cd dist && npm publish` |
| 依赖管理   | 包间依赖                    | 全部打包到 cli.js        |
| 文件大小   | 多个小文件                  | 单个大文件（~14MB）      |
| 二进制文件 | 未包含                      | 包含所有平台 ripgrep     |
| 安装速度   | 较慢（多依赖）              | 较快（少依赖）           |

## 测试发布

在正式发布前，建议先测试打包：

```bash
# 1. 打包测试
npm run bundle
npm run prepare:package

# 2. 查看生成的包结构
ls -lh dist/
tree dist/ -L 2

# 3. 检查 package.json
cat dist/package.json

# 4. 创建测试包
cd dist && npm pack

# 5. 本地安装测试
npm install -g ./rdmind-rdmind-0.0.16.tgz
rdmind --version
rdmind --help
```

## 相关命令

```bash
# 只更新版本号（不打包和发布）
npm run release:version 0.0.13

# 只清理
npm run clean

# 只打包（esbuild bundle）
npm run bundle

# 只准备发布包元数据
npm run prepare:package

# 手动发布（需要先执行上述步骤）
cd dist && npm publish
cd dist && npm publish --tag alpha
```

## 联系方式

如有问题，请联系项目维护者或在 GitHub 上提 issue。
