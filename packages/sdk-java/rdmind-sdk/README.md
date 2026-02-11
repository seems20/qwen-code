# RDMind Java SDK

RDMind Java SDK 是一个用于以编程方式访问 RDMind 功能的实验性 SDK。它提供了一个 Java 接口来与 RDMind CLI 进行交互，允许开发者将 RDMind 的功能集成到他们的 Java 应用程序中。

## 项目详情

- **Group ID**: com.xiaohongshu
- **Artifact ID**: rdmind-sdk
- **版本**: 0.0.2-SNAPSHOT
- **Java 版本**: 1.8+
- **许可证**: Apache-2.0

## 环境要求

- Java >= 1.8
- Maven >= 3.6.0
- RDMind CLI (建议版本 >= 0.5.0)

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

## 快速上手

### 基础查询

使用 SDK 最简单的方法是通过 `RDMindCli.simpleQuery()` 方法：

```java
public static void runSimpleExample() {
    List<String> result = RDMindCli.simpleQuery("你好，请介绍一下你自己");
    result.forEach(System.out::println);
}
```

### 进阶用法（自定义配置）

你可以通过 `TransportOptions` 配置模型、路径、权限等：

```java
public static void runTransportOptionsExample() {
    TransportOptions options = new TransportOptions()
            .setModel("qwen-plus")              
            .setPermissionMode(PermissionMode.AUTO_EDIT) 
            .setCwd("./")                       
            .setPathToRDMindExecutable("/usr/local/bin/rdmind"); 

    List<String> result = RDMindCli.simpleQuery("帮我重构这段代码", options);
    result.forEach(System.out::println);
}
```

### 流式处理（Streaming）

如果你需要实时处理 AI 的思考过程或工具调用：

```java
public static void runStreamingExample() {
    RDMindCli.simpleQuery("帮我写一个快速排序", 
            new TransportOptions(), 
            new AssistantContentSimpleConsumers() {
                @Override
                public void onText(Session session, TextAssistantContent content) {
                    System.out.print(content.getText()); 
                }

                @Override
                public void onThinking(Session session, ThingkingAssistantContent content) {
                    System.out.println("AI 思考中: " + content.getThinking());
                }
            }.setDefaultPermissionOperation(Operation.allow));
}
```

## 核心特性

### 权限模式 (Permission Modes)

SDK 支持多种权限模式来控制 AI 工具的执行：

- **`default`**: 除非手动批准，否则拒绝所有写操作。
- **`plan`**: 强制 AI 先提供计划，不直接执行写操作。
- **`auto-edit`**: 自动批准代码编辑（edit, write_file），其他工具需确认。
- **`yolo`**: 所有工具自动执行，无需确认。

### 架构设计

SDK 采用分层架构：
- **API 层**: `RDMindCli` 提供简洁的静态入口。
- **会话层**: `Session` 管理长连接和上下文。
- **传输层**: `ProcessTransport` 处理与 CLI 进程的通信。
- **工具类**: 内置线程池管理并发，支持自定义超时设置。

## 线程池配置

SDK 默认使用内置线程池：
- **核心线程数**: 30
- **最大线程数**: 100
- **名称前缀**: "rdmind_cli-pool-"

## 常见问题排查

### Q: 为什么无法找到可执行文件？
A: 请确保 `rdmind` 在你的系统 PATH 中，或通过 `TransportOptions.setPathToRDMindExecutable()` 指定绝对路径。

### Q: 如何处理超时？
A: 可以通过 `TransportOptions` 中的 `setTurnTimeout` 和 `setMessageTimeout` 进行调整。

## 维护者

- **组织**: Xiaohongshu
