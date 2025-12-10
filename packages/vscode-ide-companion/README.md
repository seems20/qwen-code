# RDMind Companion

RDMind Companion 扩展无缝集成 RDMind。此扩展兼容 VS Code 和 VS Code 的衍生版本。

# 功能特性

- **编辑器文件上下文**：RDMind 可以感知您在编辑器中打开的文件，从而更好地理解项目结构和内容。

- **选择上下文**：RDMind 可以轻松访问光标位置和选中的文本，直接从您当前的工作中获取有价值的上下文。

- **原生差异对比**：在编辑器内无缝查看、修改和接受 RDMind 建议的代码更改。

- **启动 RDMind**：通过命令面板（Cmd+Shift+P 或 Ctrl+Shift+P）运行 "RDMind: Run" 命令，快速启动新的 RDMind 会话。

# 系统要求

使用此扩展需要：

- VS Code 版本 1.101.0 或更高版本
- RDMind（需单独安装）在 VS Code 集成终端中运行

# 开发和调试

要在本地调试和开发此扩展：

1. **克隆仓库**

   ```bash
   git clone <repository-url>
   cd <repository-name>
   ```

2. **安装依赖**

   ```bash
   npm install
   # 或使用 pnpm
   pnpm install
   ```

3. **开始调试**

   ```bash
   code .  # 在 VS Code 中打开项目根目录
   ```
   - 打开 `packages/vscode-ide-companion/src/extension.ts` 文件
   - 打开调试面板（`Ctrl+Shift+D` 或 `Cmd+Shift+D`）
   - 从调试下拉菜单中选择 **"Launch Companion VS Code Extension"**
   - 按 `F5` 启动扩展开发宿主窗口

4. **进行更改并重新加载**
   - 在原始 VS Code 窗口中编辑源代码
   - 要查看更改，请通过以下方式重新加载扩展开发宿主窗口：
     - 按 `Ctrl+R`（Windows/Linux）或 `Cmd+R`（macOS）
     - 或点击调试工具栏中的"重新加载"按钮

5. **查看日志和调试输出**
   - 在原始 VS Code 窗口中打开调试控制台以查看扩展日志
   - 在扩展开发宿主窗口中，使用 `帮助 > 切换开发人员工具` 打开开发人员工具以查看 webview 日志

## 生产构建

要构建用于分发的扩展：

```bash
npm run compile
# 或
pnpm run compile
```

要将扩展打包为 VSIX 文件：

```bash
npx vsce package
# 或
pnpm vsce package
```

# 服务条款和隐私声明

安装此扩展即表示您同意服务条款。
