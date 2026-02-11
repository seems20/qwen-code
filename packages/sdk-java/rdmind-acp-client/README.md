# RDMind ACP 客户端 SDK

RDMind ACP 客户端 SDK 是一个用于与支持 **代理控制协议 (Agent Control Protocol, ACP)** 的 AI 代理进行通信的 Java 开发工具包。它提供了一种标准化的方式来与 AI 代理进行交互，支持会话管理、文件系统操作、终端命令执行和工具调用等功能。

## 项目概览

该 SDK 实现了 ACP 协议，允许客户端应用程序与 AI 代理进行高效通信。SDK 提供以下核心功能：

- **会话管理**：创建、加载和管理对话。
- **文件系统操作**：读写文本文件。
- **终端命令执行**：在受控环境中执行 shell 命令。
- **工具调用与权限管理**：处理 AI 工具调用并进行精细化权限审批。
- **丰富的内容类型**：支持文本、图像、音频、资源链接等多种数据块。
- **MCP 集成**：支持 Model Context Protocol (MCP) 服务器，扩展工具能力。

## 环境要求

- Java >= 1.8
- Maven >= 3.6.0

## 核心特性

- **协议标准化**：完整实现 ACP 协议，确保与各种 ACP 兼容代理的互操作性。
- **灵活的传输层**：支持多种传输机制（如 Stdio 标准输入输出、HTTP 等）。
- **权限安全控制**：细粒度的权限管理，保护敏感的文件和系统操作。
- **多模态内容处理**：内置对多种媒体类型和数据块的处理逻辑。

## 安装

### Maven

在你的 `pom.xml` 中添加以下依赖：

```xml
<dependency>
    <groupId>com.xiaohongshu</groupId>
    <artifactId>rdmind-acp-client</artifactId>
    <version>0.0.2-SNAPSHOT</version>
</dependency>
```

### Gradle

在 `build.gradle` 中添加：

```gradle
implementation 'com.xiaohongshu:rdmind-acp-client:0.0.2-SNAPSHOT'
```

## 快速上手

以下是一个简单的示例，展示如何创建 ACP 客户端并建立会话：

```java
@Test
public void testSession() throws AgentInitializeException, SessionNewException, IOException {
    // 创建 ACP 客户端，使用本地进程传输（指定 rdmind 可执行文件路径）
    RDMindAcpClient acpClient = new RDMindAcpClient(
            new ProcessTransport(new ProcessTransportOptions().setCommandArgs(new String[] {"rdmind", "--acp", "-y"})));

    try {
        // 向代理发送提示词 (Prompt)
        acpClient.sendPrompt(Collections.singletonList(new TextContent("你好，请介绍一下你自己")),
                new AgentEventConsumer().setContentEventConsumer(new ContentEventSimpleConsumer() {
                    @Override
                    public void onAgentMessageChunkSessionUpdate(AgentMessageChunkSessionUpdate sessionUpdate) {
                        logger.info("收到消息片段: {}", sessionUpdate);
                    }

                    @Override
                    public void onToolCallSessionUpdate(ToolCallSessionUpdate sessionUpdate) {
                        logger.info("工具调用请求: {}", sessionUpdate);
                    }
                    
                    // 其他回调方法请参考 API 文档
                }));
    } finally {
        // 使用完毕后关闭客户端，释放进程资源
        acpClient.close();
    }
}
```

## 核心架构组件

1. **RDMindAcpClient**：主要客户端类，负责管理与 ACP 代理的连接。
2. **Session**：代表与代理的一次交互会话。
3. **Transport**：抽象通信层，处理底层的 JSON-RPC 数据传输。
4. **Protocol Definitions**：基于 JSON Schema 自动生成的协议对象，定义了所有 ACP 消息类型。

## 开发与构建

### 构建命令

```bash
# 编译项目
mvn compile

# 运行测试
mvn test

# 打包
mvn package

# 安装到本地仓库
mvn install
```

## 维护者

- **组织**: Xiaohongshu
