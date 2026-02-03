# Java SDK 调用 Redoc 功能分析

## 📋 **结论：完全支持，通过 AI 间接调用**

Java SDK 与 TypeScript SDK 架构类似，**支持通过 AI 自动调用 Redoc 工具**来读取和分析文档。

---

## 🔍 **当前架构分析**

### 1. **Redoc 工具状态** ✅

Redoc 功能已在核心系统（`packages/core`）中实现：
- 工具名称：`redoc_fetch`
- 已注册为核心工具（Core Tool）
- Java SDK 通过 CLI 进程自动获得此工具能力

**工具能力：**
- ✅ 读取小红书内部 Redoc 文档
- ✅ 提取文本内容
- ✅ 识别并下载文档中的图片（包括嵌套在 `columns` 等结构中的图片）
- ✅ 将图片以 Base64 编码传递给视觉模型
- ✅ 保持文本和图片的原始顺序

### 2. **Java SDK 能力分析**

Java SDK 提供以下核心接口：

#### ✅ **方式 A：简单查询（推荐）**

```java
import com.xiaohongshu.rdmind.cli.RDMindCli;
import com.xiaohongshu.rdmind.cli.transport.TransportOptions;
import com.xiaohongshu.rdmind.cli.protocol.data.PermissionMode;
import java.util.List;

public class RedocExample {
    public static void main(String[] args) {
        // 配置选项
        TransportOptions options = new TransportOptions()
            .setModel("qwen-max")                    // 使用视觉模型
            .setPermissionMode(PermissionMode.YOLO); // 自动执行工具
        
        // 发送查询
        String prompt = "请读取这个 Redoc 文档并总结内容: " +
                       "https://docs.xiaohongshu.com/doc/68f4d17d459edcb98b9423882768119e";
        
        List<String> result = RDMindCli.simpleQuery(prompt, options);
        
        // 打印结果
        result.forEach(System.out::println);
    }
}
```

**特点：**
- ✅ 最简单的方式
- ✅ AI 自动判断并调用 `redoc_fetch` 工具
- ✅ 返回 AI 分析后的结果
- ❌ 无法获取原始文档内容

#### ✅ **方式 B：流式处理 + 工具监听**

```java
import com.xiaohongshu.rdmind.cli.RDMindCli;
import com.xiaohongshu.rdmind.cli.transport.TransportOptions;
import com.xiaohongshu.rdmind.cli.protocol.data.PermissionMode;
import com.xiaohongshu.rdmind.cli.session.event.consumers.AssistantContentSimpleConsumers;
import com.xiaohongshu.rdmind.cli.protocol.data.AssistantContent.*;
import com.xiaohongshu.rdmind.cli.session.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class RedocStreamingExample {
    private static final Logger logger = LoggerFactory.getLogger(RedocStreamingExample.class);
    
    public static void main(String[] args) {
        TransportOptions options = new TransportOptions()
            .setModel("qwen-max")
            .setPermissionMode(PermissionMode.YOLO)
            .setIncludePartialMessages(true);  // 启用流式输出
        
        String prompt = "请读取文档 https://docs.xiaohongshu.com/doc/68f4d17d459edcb98b9423882768119e " +
                       "并分析其中的 AI 搜索架构，特别注意文档中的图片";
        
        RDMindCli.simpleQuery(prompt, options, new AssistantContentSimpleConsumers() {
            
            @Override
            public void onText(Session session, TextAssistantContent textContent) {
                logger.info("AI 回复: {}", textContent.getText());
            }
            
            @Override
            public void onToolUse(Session session, ToolUseAssistantContent toolUseContent) {
                // 监听工具调用
                logger.info("调用工具: {}", toolUseContent.getName());
                logger.info("工具参数: {}", toolUseContent.getInput());
                
                // 检查是否是 redoc_fetch 工具
                if ("redoc_fetch".equals(toolUseContent.getName())) {
                    logger.info("正在读取 Redoc 文档...");
                }
            }
            
            @Override
            public void onToolResult(Session session, ToolResultAssistantContent toolResultContent) {
                // 监听工具执行结果
                logger.info("工具执行完成");
                logger.info("工具ID: {}", toolResultContent.getToolUseId());
                // 注意：这里的 content 是传递给 AI 的内容，可能包含图片数据
                logger.info("返回内容长度: {}", toolResultContent.getContent().length());
            }
            
            @Override
            public void onUsage(Session session, AssistantUsage assistantUsage) {
                logger.info("Token 使用: Input={}, Output={}", 
                    assistantUsage.getUsage().getInputTokens(),
                    assistantUsage.getUsage().getOutputTokens());
            }
        });
        
        logger.info("文档分析完成");
    }
}
```

**特点：**
- ✅ 可以监听工具调用过程
- ✅ 实时查看 AI 的分析进度
- ✅ 可以看到 `redoc_fetch` 工具被调用
- ⚠️ `toolResultContent` 包含传递给 AI 的内容，但可能不适合直接解析
- ❌ 仍然无法直接获取结构化的文档数据

#### ✅ **方式 C：Session 级别控制**

```java
import com.xiaohongshu.rdmind.cli.RDMindCli;
import com.xiaohongshu.rdmind.cli.session.Session;
import com.xiaohongshu.rdmind.cli.transport.TransportOptions;
import com.xiaohongshu.rdmind.cli.protocol.data.PermissionMode;
import com.xiaohongshu.rdmind.cli.session.event.consumers.SessionEventSimpleConsumers;
import com.xiaohongshu.rdmind.cli.protocol.message.*;

public class RedocSessionExample {
    public static void main(String[] args) {
        TransportOptions options = new TransportOptions()
            .setModel("qwen-max")
            .setPermissionMode(PermissionMode.YOLO);
        
        // 创建 Session
        Session session = RDMindCli.newSession(options, new SessionEventSimpleConsumers() {
            @Override
            public void onAssistantMessage(Session sess, SDKAssistantMessage message) {
                System.out.println("AI 回复: " + message.getMessage().getContent());
            }
            
            @Override
            public void onResultMessage(Session sess, SDKResultMessage message) {
                System.out.println("会话结束: " + message.getSessionId());
            }
        });
        
        try {
            // 多轮对话
            session.sendPrompt("请读取这个文档: https://docs.xiaohongshu.com/doc/68f4d17d459edcb98b9423882768119e");
            session.sendPrompt("文档中有几张图片？");
            session.sendPrompt("请详细描述搜搜薯技术大图的内容");
            
        } finally {
            session.close();  // 确保关闭 Session
        }
    }
}
```

**特点：**
- ✅ 支持多轮对话
- ✅ 可以持续追问文档内容
- ✅ AI 会记住之前读取的文档内容
- ✅ 更灵活的会话控制

---

## 💡 **推荐方案**

### **场景 1：一次性读取并分析文档**

**推荐：方式 A（简单查询）**

```java
import com.xiaohongshu.rdmind.cli.RDMindCli;
import com.xiaohongshu.rdmind.cli.transport.TransportOptions;
import com.xiaohongshu.rdmind.cli.protocol.data.PermissionMode;
import java.util.List;

public class QuickRedocAnalysis {
    
    public static String analyzeRedocDocument(String docUrl, String question) {
        TransportOptions options = new TransportOptions()
            .setModel("qwen-max")                    // 视觉模型
            .setPermissionMode(PermissionMode.YOLO)  // 自动执行
            .setCwd("./");                           // 工作目录
        
        String prompt = String.format(
            "请使用 redoc_fetch 工具读取文档 %s，然后回答：%s",
            docUrl, question
        );
        
        List<String> results = RDMindCli.simpleQuery(prompt, options);
        
        // 合并结果
        return String.join("\n", results);
    }
    
    public static void main(String[] args) {
        String docUrl = "https://docs.xiaohongshu.com/doc/68f4d17d459edcb98b9423882768119e";
        
        // 示例 1: 总结文档
        String summary = analyzeRedocDocument(
            docUrl,
            "总结这个文档的主要内容"
        );
        System.out.println("=== 文档总结 ===");
        System.out.println(summary);
        
        // 示例 2: 分析图片
        String imageAnalysis = analyzeRedocDocument(
            docUrl,
            "文档中有多少张图片？请描述每张图片的内容"
        );
        System.out.println("\n=== 图片分析 ===");
        System.out.println(imageAnalysis);
        
        // 示例 3: 提取特定信息
        String specificInfo = analyzeRedocDocument(
            docUrl,
            "搜搜薯的技术框架包含哪些组件？"
        );
        System.out.println("\n=== 技术框架 ===");
        System.out.println(specificInfo);
    }
}
```

**输出示例：**
```
=== 文档总结 ===
根据读取的 Redoc 文档内容（包含 5 张图片），该文档主要介绍了 AI 搜索产品"搜搜薯"：

1. 传统搜索 vs AI 搜索的对比
   - 交互方式：关键词 vs 自然语言
   - 结果形态：蓝链列表 vs 结构化摘要
   ...

2. 搜搜薯的技术实现
   - 用户搜索路径分析（图片 1）
   - 线上链路架构（图片 2：2094x944）
   - 技术大图（图片 3：306x250）
   ...

=== 图片分析 ===
文档中共包含 5 张图片：

1. 用户搜索路径图（799x307）
   展示了用户从输入查询到获得答案的完整流程...

2. 搜搜薯线上链路（2094x944）
   详细的系统架构图，包含了前端、后端、搜索引擎等模块...

3. 搜搜薯技术大图（306x250）
   技术栈的概览图，显示了各个技术组件的关系...
...
```

---

### **场景 2：需要监控工具调用过程**

**推荐：方式 B（流式处理）**

```java
import com.xiaohongshu.rdmind.cli.RDMindCli;
import com.xiaohongshu.rdmind.cli.transport.TransportOptions;
import com.xiaohongshu.rdmind.cli.protocol.data.PermissionMode;
import com.xiaohongshu.rdmind.cli.session.event.consumers.AssistantContentSimpleConsumers;
import com.xiaohongshu.rdmind.cli.protocol.data.AssistantContent.*;
import com.xiaohongshu.rdmind.cli.session.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.concurrent.atomic.AtomicInteger;

public class RedocWithMonitoring {
    private static final Logger logger = LoggerFactory.getLogger(RedocWithMonitoring.class);
    
    public static void analyzeWithProgress(String docUrl, String question) {
        TransportOptions options = new TransportOptions()
            .setModel("qwen-max")
            .setPermissionMode(PermissionMode.YOLO)
            .setIncludePartialMessages(true);
        
        AtomicInteger imageCount = new AtomicInteger(0);
        StringBuilder fullResponse = new StringBuilder();
        
        String prompt = String.format(
            "请读取 Redoc 文档 %s，并回答：%s。" +
            "注意：文档可能包含多张图片，请结合图片内容进行分析。",
            docUrl, question
        );
        
        RDMindCli.simpleQuery(prompt, options, new AssistantContentSimpleConsumers() {
            
            @Override
            public void onText(Session session, TextAssistantContent textContent) {
                String text = textContent.getText();
                fullResponse.append(text);
                System.out.print(text);  // 实时输出
            }
            
            @Override
            public void onToolUse(Session session, ToolUseAssistantContent toolUse) {
                if ("redoc_fetch".equals(toolUse.getName())) {
                    logger.info("🔍 正在读取 Redoc 文档...");
                    logger.info("📄 文档 URL: {}", toolUse.getInput().get("url"));
                }
            }
            
            @Override
            public void onToolResult(Session session, ToolResultAssistantContent toolResult) {
                logger.info("✅ 文档读取完成");
                
                // 尝试从内容中提取图片数量信息
                String content = toolResult.getContent().toString();
                if (content.contains("images found")) {
                    logger.info("📊 文档包含图片");
                }
            }
            
            @Override
            public void onUsage(Session session, AssistantUsage usage) {
                logger.info("💰 Token 使用统计:");
                logger.info("  - 输入: {} tokens", usage.getUsage().getInputTokens());
                logger.info("  - 输出: {} tokens", usage.getUsage().getOutputTokens());
            }
        });
        
        System.out.println("\n\n=== 完整回复 ===");
        System.out.println(fullResponse.toString());
    }
    
    public static void main(String[] args) {
        analyzeWithProgress(
            "https://docs.xiaohongshu.com/doc/68f4d17d459edcb98b9423882768119e",
            "分析文档中 AI 搜索的技术架构，并说明各个架构图的作用"
        );
    }
}
```

**输出示例：**
```
[INFO] 🔍 正在读取 Redoc 文档...
[INFO] 📄 文档 URL: https://docs.xiaohongshu.com/doc/68f4d17d459edcb98b9423882768119e
[INFO] ✅ 文档读取完成
[INFO] 📊 文档包含图片

根据文档内容，AI 搜索的技术架构包含以下几个层次...
（实时流式输出）

[INFO] 💰 Token 使用统计:
[INFO]   - 输入: 12450 tokens
[INFO]   - 输出: 876 tokens
```

---

### **场景 3：多轮对话深度分析**

**推荐：方式 C（Session 控制）**

```java
import com.xiaohongshu.rdmind.cli.RDMindCli;
import com.xiaohongshu.rdmind.cli.session.Session;
import com.xiaohongshu.rdmind.cli.transport.TransportOptions;
import com.xiaohongshu.rdmind.cli.protocol.data.PermissionMode;
import com.xiaohongshu.rdmind.cli.session.event.consumers.AssistantContentSimpleConsumers;
import com.xiaohongshu.rdmind.cli.protocol.data.AssistantContent.*;

public class RedocInteractiveAnalysis {
    
    public static void interactiveAnalysis(String docUrl) {
        TransportOptions options = new TransportOptions()
            .setModel("qwen-max")
            .setPermissionMode(PermissionMode.YOLO)
            .setMaxSessionTurns(10);  // 最多 10 轮对话
        
        Session session = RDMindCli.newSession(options, new AssistantContentSimpleConsumers() {
            @Override
            public void onText(Session sess, TextAssistantContent text) {
                System.out.println("AI: " + text.getText());
            }
        });
        
        try {
            // 第 1 轮：读取文档
            System.out.println("\n=== 第 1 轮：读取文档 ===");
            session.sendPrompt(String.format(
                "请读取这个 Redoc 文档: %s",
                docUrl
            ));
            
            // 第 2 轮：询问图片数量
            System.out.println("\n=== 第 2 轮：图片信息 ===");
            session.sendPrompt("文档中有多少张图片？分别是什么内容？");
            
            // 第 3 轮：深入分析特定图片
            System.out.println("\n=== 第 3 轮：架构分析 ===");
            session.sendPrompt("请详细描述搜搜薯线上链路图（那张 2094x944 的大图）的内容");
            
            // 第 4 轮：对比分析
            System.out.println("\n=== 第 4 轮：对比分析 ===");
            session.sendPrompt("比较一下线上链路图和技术大图的区别，它们分别强调了什么？");
            
            // 第 5 轮：技术实现
            System.out.println("\n=== 第 5 轮：实现细节 ===");
            session.sendPrompt("根据文档和图片，总结一下实现 AI 搜索需要哪些核心技术？");
            
        } finally {
            session.close();
        }
    }
    
    public static void main(String[] args) {
        interactiveAnalysis("https://docs.xiaohongshu.com/doc/68f4d17d459edcb98b9423882768119e");
    }
}
```

**优势：**
- ✅ AI 会记住文档内容，无需重复读取
- ✅ 可以逐步深入分析
- ✅ 支持追问和澄清
- ✅ 更自然的交互方式

---

## 📊 **对比总结**

| 方案 | 实现难度 | 能否监控工具 | 能否多轮对话 | 能否实时输出 | 推荐度 |
|------|---------|------------|------------|------------|-------|
| **简单查询** | ⭐ 简单 | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| **流式处理** | ⭐⭐ 中等 | ✅ | ❌ | ✅ | ⭐⭐⭐⭐ |
| **Session 控制** | ⭐⭐⭐ 复杂 | ⚠️ 部分 | ✅ | ⚠️ 需配置 | ⭐⭐⭐⭐ |

---

## 🎯 **关键特性支持情况**

| 特性 | Java SDK 支持 | 说明 |
|------|-------------|------|
| **读取 Redoc 文档** | ✅ 完全支持 | 通过 AI 调用 `redoc_fetch` 工具 |
| **理解文档图片** | ✅ 完全支持 | 使用视觉模型（如 `qwen-max`） |
| **识别嵌套图片** | ✅ 完全支持 | 核心工具支持递归提取 |
| **保持图片顺序** | ✅ 完全支持 | 图片按文档原始位置排列 |
| **获取原始数据** | ❌ 不支持 | 只能获取 AI 分析结果 |
| **直接调用工具** | ❌ 不支持 | 需通过 AI 间接调用 |
| **监听工具调用** | ✅ 支持 | 通过 `onToolUse`/`onToolResult` |
| **多轮对话** | ✅ 支持 | 使用 `Session` API |
| **流式输出** | ✅ 支持 | 设置 `includePartialMessages` |

---

## 🚀 **完整示例项目结构**

```
src/main/java/com/example/redoc/
├── QuickRedocAnalysis.java        # 简单查询示例
├── RedocWithMonitoring.java       # 流式监控示例
├── RedocInteractiveAnalysis.java  # 多轮对话示例
└── RedocBatchProcessor.java       # 批量处理示例

pom.xml
└── <dependency>
        <groupId>com.xiaohongshu</groupId>
        <artifactId>rdmind-sdk</artifactId>
        <version>{$version}</version>
    </dependency>
```

---

## ⚠️ **注意事项**

### 1. **权限模式选择**

```java
// YOLO 模式：自动执行所有工具（适合 Redoc）
.setPermissionMode(PermissionMode.YOLO)

// AUTO_EDIT 模式：只自动执行编辑工具（Redoc 会被拦截）
.setPermissionMode(PermissionMode.AUTO_EDIT)  // ❌ 不推荐

// DEFAULT 模式：需要手动批准（不适合 SDK）
.setPermissionMode(PermissionMode.DEFAULT)    // ❌ 不推荐
```

### 2. **模型选择**

```java
// 推荐：使用视觉模型理解图片
.setModel("qwen-max")        // ✅ 支持视觉
.setModel("qwen-plus")       // ✅ 支持视觉

// 不推荐：纯文本模型无法理解图片
.setModel("qwen-turbo")      // ⚠️ 可能不支持视觉
```

### 3. **超时设置**

```java
import com.xiaohongshu.rdmind.cli.utils.Timeout;
import java.util.concurrent.TimeUnit;

// Redoc 读取可能较慢（需下载图片）
TransportOptions options = new TransportOptions()
    .setMessageTimeout(new Timeout(120L, TimeUnit.SECONDS))  // 消息超时 2 分钟
    .setTurnTimeout(new Timeout(300L, TimeUnit.SECONDS));    // 总超时 5 分钟
```

### 4. **资源管理**

```java
Session session = RDMindCli.newSession(options, consumers);
try {
    session.sendPrompt("...");
} finally {
    session.close();  // ⚠️ 必须关闭，否则子进程泄漏
}
```

---

## 💡 **最佳实践**

### **1. 使用工具级监控**

```java
@Override
public void onToolUse(Session session, ToolUseAssistantContent toolUse) {
    if ("redoc_fetch".equals(toolUse.getName())) {
        // 记录日志
        logger.info("开始读取 Redoc: {}", toolUse.getInput().get("url"));
        
        // 显示进度
        System.out.println("📖 正在下载文档...");
    }
}

@Override
public void onToolResult(Session session, ToolResultAssistantContent toolResult) {
    logger.info("✅ 文档读取完成");
    System.out.println("📊 开始分析...");
}
```

### **2. 错误处理**

```java
import com.xiaohongshu.rdmind.cli.session.exception.*;

try {
    List<String> result = RDMindCli.simpleQuery(prompt, options);
} catch (SessionControlException e) {
    logger.error("会话控制失败", e);
} catch (SessionSendPromptException e) {
    logger.error("发送提示失败", e);
} catch (Exception e) {
    logger.error("未知错误", e);
}
```

### **3. 批量处理文档**

```java
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.*;

public class RedocBatchProcessor {
    
    public static void processDocuments(List<String> docUrls) {
        ExecutorService executor = Executors.newFixedThreadPool(3);
        
        List<Future<String>> futures = docUrls.stream()
            .map(url -> executor.submit(() -> analyzeDocument(url)))
            .collect(Collectors.toList());
        
        futures.forEach(future -> {
            try {
                String result = future.get(5, TimeUnit.MINUTES);
                System.out.println(result);
            } catch (Exception e) {
                logger.error("处理失败", e);
            }
        });
        
        executor.shutdown();
    }
    
    private static String analyzeDocument(String url) {
        TransportOptions options = new TransportOptions()
            .setModel("qwen-max")
            .setPermissionMode(PermissionMode.YOLO);
        
        String prompt = "请读取并总结文档: " + url;
        List<String> results = RDMindCli.simpleQuery(prompt, options);
        return String.join("\n", results);
    }
}
```

---

## ✅ **总结**

### **Java SDK 调用 Redoc 的核心要点：**

1. ✅ **完全支持**：通过 AI 间接调用，无需额外配置
2. ✅ **图片理解**：使用视觉模型（`qwen-max`）可以理解文档中的所有图片
3. ✅ **简单易用**：`RDMindCli.simpleQuery()` 一行代码即可实现
4. ✅ **灵活监控**：通过 `AssistantContentConsumers` 监听工具调用
5. ✅ **多轮对话**：使用 `Session` API 支持持续交互

### **与 TypeScript SDK 的差异：**

| 特性 | TypeScript SDK | Java SDK |
|------|---------------|---------|
| **简单查询** | `query()` | `RDMindCli.simpleQuery()` |
| **流式输出** | 异步迭代器 | `AssistantContentConsumers` |
| **工具监听** | 消息类型判断 | `onToolUse`/`onToolResult` 回调 |
| **多轮对话** | AsyncIterable | `Session.sendPrompt()` |
| **MCP 扩展** | ✅ 支持 | ❌ 当前不支持 |

### **推荐使用场景：**

- **快速原型**：使用方式 A（简单查询）
- **生产环境**：使用方式 B（流式处理 + 监控）
- **复杂交互**：使用方式 C（Session 多轮对话）

**完整代码示例位置：**
- SDK README: `packages/sdk-java/README.md`
- 示例代码: `packages/sdk-java/src/test/java/com/xiaohongshu/rdmind/cli/example/`
