# RDMind Java SDK

RDMind Java SDK 是一个用于以编程方式访问 RDMind 功能的实验性 SDK。它提供了一个 Java 接口来与 RDMind CLI 进行交互，允许开发者将 RDMind 的智能化编程能力集成到自己的 Java 应用程序中。

## 环境要求

- Java >= 1.8
- Maven >= 3.6.0 (用于从源码构建)
- rdmind CLI >= 0.5.0

### 核心依赖

- **日志**: ch.qos.logback:logback-classic
- **工具**: org.apache.commons:commons-lang3
- **JSON 处理**: com.alibaba.fastjson2:fastjson2
- **测试**: JUnit 5 (org.junit.jupiter:junit-jupiter)

## 安装

在你的 Maven `pom.xml` 中添加以下依赖：

```xml
<dependency>
    <groupId>com.xiaohongshu</groupId>
    <artifactId>rdmind-sdk</artifactId>
    <version>0.0.2-SNAPSHOT</version>
</dependency>
```

如果是使用 Gradle，添加到 `build.gradle`：

```gradle
implementation 'com.xiaohongshu:rdmind-sdk:0.0.2-SNAPSHOT'
```

## 构建与运行

### 构建命令

```bash
# 编译项目
mvn compile

# 运行测试
mvn test

# 打包 JAR
mvn package

# 安装到本地仓库
mvn install
```

## 快速上手

使用 SDK 最简单的方法是通过 `RDMindCli.simpleQuery()` 静态方法：

```java
public static void runSimpleExample() {
    List<String> result = RDMindCli.simpleQuery("你好，请介绍一下你自己");
    result.forEach(logger::info);
}
```

高级用法（使用自定义传输选项）：

```java
public static void runTransportOptionsExample() {
    TransportOptions options = new TransportOptions()
            .setModel("qwen-plus")
            .setPermissionMode(PermissionMode.AUTO_EDIT)
            .setCwd("./")
            .setEnv(new HashMap<String, String>() {{put("CUSTOM_VAR", "value");}})
            .setIncludePartialMessages(true)
            .setTurnTimeout(new Timeout(120L, TimeUnit.SECONDS))
            .setMessageTimeout(new Timeout(90L, TimeUnit.SECONDS))
            .setAllowedTools(Arrays.asList("read_file", "write_file", "list_directory"));

    List<String> result = RDMindCli.simpleQuery("你是谁？你有什么能力？", options);
    result.forEach(logger::info);
}
```

使用自定义内容消费者（Content Consumers）处理流式响应：

```java
public static void runStreamingExample() {
    RDMindCli.simpleQuery("你是谁？你有什么能力？",
            new TransportOptions().setMessageTimeout(new Timeout(10L, TimeUnit.SECONDS)), new AssistantContentSimpleConsumers() {

                @Override
                public void onText(Session session, TextAssistantContent textAssistantContent) {
                    logger.info("Text content received: {}", textAssistantContent.getText());
                }

                @Override
                public void onThinking(Session session, ThingkingAssistantContent thingkingAssistantContent) {
                    logger.info("Thinking content received: {}", thingkingAssistantContent.getThinking());
                }

                @Override
                public void onToolUse(Session session, ToolUseAssistantContent toolUseContent) {
                    logger.info("Tool use content received: {} with arguments: {}",
                            toolUseContent, toolUseContent.getInput());
                }

                @Override
                public void onToolResult(Session session, ToolResultAssistantContent toolResultContent) {
                    logger.info("Tool result content received: {}", toolResultContent.getContent());
                }

                @Override
                public void onOtherContent(Session session, AssistantContent<?> other) {
                    logger.info("Other content received: {}", other);
                }

                @Override
                public void onUsage(Session session, AssistantUsage assistantUsage) {
                    logger.info("Usage information received: Input tokens: {}, Output tokens: {}",
                            assistantUsage.getUsage().getInputTokens(), assistantUsage.getUsage().getOutputTokens());
                }
            }.setDefaultPermissionOperation(Operation.allow));
    logger.info("Streaming example completed.");
}
```

更多示例请参考 `src/test/java/com/xiaohongshu/rdmind/cli/example`

## 架构设计

SDK 采用分层架构：

- **API 层**: 通过 `RDMindCli` 类提供主要的入口点，包含用于基础使用的静态方法。
- **会话层 (Session Layer)**: 通过 `Session` 类管理与 RDMind CLI 的通信会话。
- **传输层 (Transport Layer)**: 处理 SDK 与 CLI 进程之间的通信机制（目前使用 `ProcessTransport` 进行进程间通信）。
- **协议层 (Protocol Layer)**: 基于 CLI 协议定义通信的数据结构。
- **工具类 (Utils)**: 用于并发执行、超时处理和错误管理的通用工具。

## 核心特性

### 权限模式 (Permission Modes)

SDK 支持不同的权限模式来控制工具的执行：

- **`default`**: 除非通过 `canUseTool` 回调或在 `allowedTools` 中批准，否则写工具默认被拒绝。只读工具无需确认即可执行。
- **`plan`**: 阻止所有写工具，指示 AI 先提交计划。
- **`auto-edit`**: 自动批准编辑工具（edit, write_file），其他工具需要确认。
- **`yolo`**: 所有工具自动执行，无需确认。

### 会话事件消费者与助手内容消费者

SDK 提供了两个关键接口用于处理来自 CLI 的事件和内容：

#### SessionEventConsumers 接口 (SessionEventConsumers Interface)

`SessionEventConsumers` 接口提供了会话期间处理不同类型消息的回调：

- `onSystemMessage`: 处理来自 CLI 的系统消息（接收 Session 和 SDKSystemMessage）。
- `onResultMessage`: 处理来自 CLI 的结果消息（接收 Session 和 SDKResultMessage）。
- `onAssistantMessage`: 处理助手消息（AI 响应）（接收 Session 和 SDKAssistantMessage）。
- `onPartialAssistantMessage`: 处理流式传输过程中的部分助手消息（接收 Session 和 SDKPartialAssistantMessage）。
- `onUserMessage`: 处理用户消息（接收 Session 和 SDKUserMessage）。
- `onOtherMessage`: 处理其他类型的消息（接收 Session 和 String 消息）。
- `onControlResponse`: 处理控制响应（接收 Session 和 CLIControlResponse）。
- `onControlRequest`: 处理控制请求（接收 Session 和 CLIControlRequest，返回 CLIControlResponse）。
- `onPermissionRequest`: 处理权限请求（接收 Session 和 CLIControlRequest<CLIControlPermissionRequest>，返回 Behavior）。

#### 助手内容消费者接口 (AssistantContentConsumers Interface)

`AssistantContentConsumers` 接口负责处理助手消息中的具体内容片段：

- `onText`: 处理文本内容（接收 Session 和 TextAssistantContent）。
- `onThinking`: 处理思考内容（思维链）（接收 Session 和 ThingkingAssistantContent）。
- `onToolUse`: 处理工具使用内容（接收 Session 和 ToolUseAssistantContent）。
- `onToolResult`: 处理工具结果内容（接收 Session 和 ToolResultAssistantContent）。
- `onOtherContent`: 处理其他内容类型（接收 Session 和 AssistantContent）。
- `onUsage`: 处理使用量信息（接收 Session 和 AssistantUsage）。
- `onPermissionRequest`: 处理权限请求（接收 Session 和 CLIControlPermissionRequest，返回 Behavior）。
- `onOtherControlRequest`: 处理其他控制请求（接收 Session 和 ControlRequestPayload，返回 ControlResponsePayload）。

#### 接口之间的关系 (Relationship Between the Interfaces)

**关于事件层级的重要说明：**

- `SessionEventConsumers` 是**高层**事件处理器，负责处理不同的消息类型（系统、助手、用户等）。
- `AssistantContentConsumers` 是**底层**内容处理器，负责处理助手消息中的具体内容片段（文本、工具、思考等）。

**处理器关系：**

- `SessionEventConsumers` → `AssistantContentConsumers`（`SessionEventConsumers` 使用 `AssistantContentConsumers` 来处理助手消息中的具体内容）。

**事件衍生关系：**

- `onAssistantMessage` → `onText`, `onThinking`, `onToolUse`, `onToolResult`, `onOtherContent`, `onUsage`
- `onPartialAssistantMessage` → `onText`, `onThinking`, `onToolUse`, `onToolResult`, `onOtherContent`
- `onControlRequest` → `onPermissionRequest`, `onOtherControlRequest`

**事件超时关系 (Event Timeout Relationships)：**

每个事件处理方法都有对应的超时方法，允许自定义该特定事件的超时行为：

- `onSystemMessage` ↔ `onSystemMessageTimeout`
- `onResultMessage` ↔ `onResultMessageTimeout`
- `onAssistantMessage` ↔ `onAssistantMessageTimeout`
- `onPartialAssistantMessage` ↔ `onPartialAssistantMessageTimeout`
- `onUserMessage` ↔ `onUserMessageTimeout`
- `onOtherMessage` ↔ `onOtherMessageTimeout`
- `onControlResponse` ↔ `onControlResponseTimeout`
- `onControlRequest` ↔ `onControlRequestTimeout`

对于 AssistantContentConsumers 的超时方法：

- `onText` ↔ `onTextTimeout`
- `onThinking` ↔ `onThinkingTimeout`
- `onToolUse` ↔ `onToolUseTimeout`
- `onToolResult` ↔ `onToolResultTimeout`
- `onOtherContent` ↔ `onOtherContentTimeout`
- `onPermissionRequest` ↔ `onPermissionRequestTimeout`
- `onOtherControlRequest` ↔ `onOtherControlRequestTimeout`

**默认超时值：**

- `SessionEventSimpleConsumers` 默认超时：180 秒 (`Timeout.TIMEOUT_180_SECONDS`)
- `AssistantContentSimpleConsumers` 默认超时：60 秒 (`Timeout.TIMEOUT_60_SECONDS`)

**超时层级要求 (Timeout Hierarchy Requirements)：**

为了确保正常运行，应维持以下超时关系：

- `onAssistantMessageTimeout` 的返回值应大于 `onTextTimeout`、`onThinkingTimeout`、`onToolUseTimeout`、`onToolResultTimeout` 和 `onOtherContentTimeout` 的返回值。
- `onControlRequestTimeout` 的返回值应大于 `onPermissionRequestTimeout` 和 `onOtherControlRequestTimeout` 的返回值。

## 传输选项 (Transport Options)

`TransportOptions` 类允许配置 SDK 如何与 RDMind CLI 通信：

- `pathToRDMindExecutable`: RDMind CLI 可执行文件的路径。
- `cwd`: CLI 进程的工作目录。
- `model`: 会话使用的 AI 模型。
- `permissionMode`: 控制工具执行的权限模式。
- `env`: 传递给 CLI 进程的环境变量。
- `maxSessionTurns`: 限制会话中的对话轮数。
- `coreTools`: AI 可使用的核心工具列表。
- `excludeTools`: 要排除的工具列表。
- `allowedTools`: 预先批准无需额外确认即可使用的工具列表。
- `authType`: 认证类型。
- `includePartialMessages`: 开启流式响应中的部分消息接收。
- `turnTimeout`: 整轮对话的超时时间。
- `messageTimeout`: 单条消息的超时时间。
- `resumeSessionId`: 要恢复的之前会话的 ID。

## 会话控制功能 (Session Control Features)

- **会话创建**: 使用 `RDMindCli.newSession()` 创建新会话。
- **会话管理**: `Session` 类提供发送 Prompt、处理响应和管理状态的方法。
- **会话清理**: 务必使用 `session.close()` 关闭会话以终止 CLI 进程。
- **会话恢复**: 在 `TransportOptions` 中使用 `setResumeSessionId()` 来恢复之前的会话。
- **会话中断**: 使用 `session.interrupt()` 中断当前正在运行的 Prompt。
- **动态模型切换**: 在会话过程中使用 `session.setModel()` 更改模型。
- **动态权限模式切换**: 在会话过程中使用 `session.setPermissionMode()` 更改权限模式。

## 线程池配置 (Thread Pool Configuration)

SDK 使用线程池管理并发操作，默认配置如下：

- **核心线程数 (Core Pool Size)**: 30 线程
- **最大线程数 (Maximum Pool Size)**: 100 线程
- **保持存活时间 (Keep-Alive Time)**: 60 秒
- **队列容量 (Queue Capacity)**: 300 任务 (使用 LinkedBlockingQueue)
- **线程命名 (Thread Naming)**: "rdmind_cli-pool-{number}"
- **守护线程 (Daemon Threads)**: false
- **拒绝策略 (Rejected Execution Handler)**: CallerRunsPolicy

## 错误处理 (Error Handling)

SDK 提供了针对不同场景的异常类型：

- `SessionControlException`: 会话控制异常（创建、初始化等）。
- `SessionSendPromptException`: 发送提示或接收响应异常。
- `SessionClosedException`: 尝试在已关闭的会话上操作。

## 常见问题排查 (FAQ / Troubleshooting)

### Q: 我需要单独安装 RDMind CLI 吗？
A: 是的，该 SDK 需要系统路径中存在 `rdmind` 命令，或者在 `TransportOptions` 中明确指定其绝对路径。

### Q: 支持哪些 Java 版本？
A: 需要 Java 1.8 或更高版本。

### Q: 如何处理长耗时请求？
A: SDK 包含超时工具。你可以通过 `TransportOptions` 配置轮次和消息的超时时间。

### Q: 为什么有些工具不执行？
A: 这可能是由于权限模式。检查你的 `permissionMode` 设置，并考虑使用 `allowedTools` 预批准特定工具。

### Q: 如何恢复之前的会话？
A: 使用 `TransportOptions` 中的 `setResumeSessionId()` 方法。

### Q: 我可以为 CLI 进程自定义环境变量吗？
A: 可以，使用 `TransportOptions` 中的 `setEnv()` 方法。

## 许可证 (License)

Apache-2.0 - 详见 [LICENSE](./LICENSE) 文件。
