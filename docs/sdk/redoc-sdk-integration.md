# SDK 调用 Redoc 功能分析

## 📋 **结论：支持，但需要通过 AI 间接调用**

当前项目的 SDK **不支持直接调用** Redoc 工具，但可以通过 **让 AI 自动调用** Redoc 工具来间接实现读取 Redoc 文档的功能。

---

## 🔍 **当前架构分析**

### 1. **Redoc 工具状态** ✅

Redoc 功能已经完整实现并注册到核心工具系统：

```typescript
// packages/core/src/config/config.ts
import { RedocFetchTool } from '../tools/redoc-fetch.js';

// 在工具注册部分
registerCoreTool(RedocFetchTool, this);
```

**工具能力：**
- ✅ 支持从小红书内部 Redoc 系统读取文档
- ✅ 支持提取文档中的文本内容
- ✅ 支持识别和下载文档中的图片（包括嵌套在 columns 等结构中的图片）
- ✅ 支持将图片以 Base64 编码的方式传递给视觉模型
- ✅ 保持文本和图片的原始顺序

**工具接口：**
```typescript
{
  name: 'redoc_fetch',
  parameters: {
    url: string,      // Redoc 文档 URL (https://docs.xiaohongshu.com/doc/{doc_id})
    prompt: string    // 用户想了解的信息，如"总结文档"、"分析图片"等
  }
}
```

### 2. **SDK 能力分析**

SDK 提供了两种工具扩展方式：

#### ✅ **方式 A：通过 MCP 添加自定义工具（SDK-embedded）**

```typescript
import { z } from 'zod';
import { query, tool, createSdkMcpServer } from '@rdmind/sdk';

// 创建自定义工具
const myTool = tool(
  'my_tool_name',
  'Tool description',
  { param1: z.string(), param2: z.number() },
  async (args) => ({
    content: [{ type: 'text', text: 'result' }]
  })
);

// 创建 MCP server
const server = createSdkMcpServer({
  name: 'my-server',
  tools: [myTool]
});

// 使用 server
const result = query({
  prompt: 'Use my custom tool',
  options: {
    mcpServers: {
      'my-server': server
    }
  }
});
```

**特点：**
- ✅ 可以创建完全自定义的工具
- ✅ 工具在 SDK 进程内运行
- ❌ 需要手动实现工具逻辑
- ❌ 无法直接复用现有的核心工具（如 RedocFetchTool）

#### ✅ **方式 B：通过提示词让 AI 调用核心工具**

```typescript
import { query } from '@rdmind/sdk';

const result = query({
  prompt: '请帮我读取这个 Redoc 文档并总结内容: https://docs.xiaohongshu.com/doc/abc123',
  options: {
    cwd: '/path/to/project',
    permissionMode: 'yolo',  // 自动批准工具调用
  }
});

for await (const message of result) {
  if (message.type === 'assistant') {
    console.log(message.message.content);
  }
}
```

**特点：**
- ✅ 直接使用现有的核心工具
- ✅ AI 自动判断何时调用 `redoc_fetch` 工具
- ✅ 无需编写额外代码
- ❌ 依赖 AI 的判断，可能需要明确提示
- ❌ 无法获取工具调用的原始结果（只能看到 AI 的总结）

#### ❌ **方式 C：直接调用核心工具（不支持）**

SDK 目前 **不提供** 类似以下的 API：

```typescript
// ❌ 这种方式不存在
import { RedocFetchTool } from '@rdmind/sdk';

const result = await RedocFetchTool.execute({
  url: 'https://docs.xiaohongshu.com/doc/abc123',
  prompt: '总结文档'
});
```

---

## 💡 **推荐方案**

### **场景 1：只需要文档内容 + AI 分析**

**推荐：方式 B（提示词调用）**

```typescript
import { query } from '@rdmind/sdk';

async function analyzeRedocDoc(url: string, question: string) {
  const result = query({
    prompt: `请使用 redoc_fetch 工具读取文档 ${url}，然后回答：${question}`,
    options: {
      permissionMode: 'yolo',  // 自动执行工具
    }
  });

  let answer = '';
  for await (const message of result) {
    if (message.type === 'assistant') {
      answer = message.message.content;
    }
  }
  
  return answer;
}

// 使用
const summary = await analyzeRedocDoc(
  'https://docs.xiaohongshu.com/doc/abc123',
  '总结文档中关于 AI 搜索的技术架构'
);
console.log(summary);
```

**优点：**
- ✅ 代码简单，直接复用现有功能
- ✅ AI 会自动提取文档内容并理解图片
- ✅ 返回的是经过 AI 分析后的结果

**缺点：**
- ❌ 无法获取原始文档内容
- ❌ 依赖 AI 理解你的意图

### **场景 2：需要原始文档内容 + 自定义处理**

**推荐：方式 A（创建包装工具）**

如果你需要直接获取文档的原始内容（文本 + 图片），可以创建一个 MCP 工具包装 Redoc API：

```typescript
import { z } from 'zod';
import { query, tool, createSdkMcpServer } from '@rdmind/sdk';

// 创建 Redoc 读取工具（复制核心逻辑）
const redocReaderTool = tool(
  'read_redoc_document',
  'Read and extract content from Xiaohongshu Redoc documents',
  {
    url: z.string().url(),
    includeImages: z.boolean().optional(),
  },
  async (args) => {
    // 1. 调用 Redoc API 获取文档
    const docId = extractDocId(args.url);
    const response = await fetch('https://athena-next.devops.xiaohongshu.com/api/media/query/redoc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId }),
    });
    
    const data = await response.json();
    const content = JSON.parse(data.data.content);
    
    // 2. 提取文本和图片
    const textParts = [];
    const images = [];
    
    // 递归处理节点（参考 RedocFetchTool 的实现）
    function processNode(node: any) {
      if (node.type === 'image' && node.url) {
        images.push({ url: node.url, width: node.width, height: node.height });
      }
      // ... 提取文本逻辑
      if (node.children) {
        node.children.forEach(processNode);
      }
    }
    
    content.children.forEach(processNode);
    
    // 3. 返回结果
    const result = {
      title: data.data.title,
      text: textParts.join('\n'),
      imageCount: images.length,
      images: args.includeImages ? images : [],
    };
    
    return {
      content: [
        { type: 'text', text: JSON.stringify(result, null, 2) }
      ]
    };
  }
);

// 创建 MCP server
const redocServer = createSdkMcpServer({
  name: 'redoc-reader',
  tools: [redocReaderTool],
});

// 使用
const result = query({
  prompt: 'Read this document: https://docs.xiaohongshu.com/doc/abc123',
  options: {
    permissionMode: 'yolo',
    mcpServers: {
      'redoc-reader': redocServer,
    }
  }
});
```

**优点：**
- ✅ 可以获取原始文档数据
- ✅ 可以自定义返回格式
- ✅ 可以在工具层面做额外处理

**缺点：**
- ❌ 需要复制核心工具的逻辑（代码重复）
- ❌ 需要维护两份代码
- ❌ 图片理解功能需要手动实现（传递给 AI）

---

## 🚀 **建议扩展方向**

如果需要频繁从 SDK 调用 Redoc，建议以下改进：

### **方案 1：暴露核心工具 API**

在 `@rdmind/sdk` 中导出核心工具的执行接口：

```typescript
// packages/sdk-typescript/src/tools/index.ts
export { RedocFetchTool } from '@rdmind/rdmind-core/tools/redoc-fetch';

// 用户代码
import { RedocFetchTool } from '@rdmind/sdk/tools';

const tool = new RedocFetchTool(config);
const result = await tool.execute({
  url: 'https://docs.xiaohongshu.com/doc/abc123',
  prompt: '总结文档'
});
```

**优点：**
- ✅ 直接调用，无需 AI 中间层
- ✅ 可以获取原始结果
- ✅ 复用现有代码，无重复

**缺点：**
- ❌ 需要修改 SDK 架构
- ❌ 需要处理工具依赖（Config、Gemini client 等）

### **方案 2：提供工具结果监听**

增强 SDK 的消息类型，允许监听工具调用结果：

```typescript
const result = query({
  prompt: '读取 Redoc 文档',
  options: {
    includeToolResults: true,  // 新增选项
  }
});

for await (const message of result) {
  if (message.type === 'tool_result') {
    // 新增消息类型
    console.log('Tool:', message.toolName);
    console.log('Result:', message.result);
  }
}
```

**优点：**
- ✅ 既能让 AI 调用工具，又能获取原始结果
- ✅ 不破坏现有架构
- ✅ 灵活性高

**缺点：**
- ❌ 需要修改协议和消息格式

---

## 📊 **对比总结**

| 方案 | 实现难度 | 是否需要修改 SDK | 能否获取原始结果 | 能否理解图片 | 推荐度 |
|------|---------|----------------|----------------|------------|-------|
| **方式 B：提示词调用** | ⭐ 简单 | ❌ 不需要 | ❌ 只有 AI 总结 | ✅ 是 | ⭐⭐⭐⭐⭐ |
| **方式 A：MCP 包装** | ⭐⭐⭐ 中等 | ❌ 不需要 | ✅ 是 | ⚠️ 需手动处理 | ⭐⭐⭐ |
| **扩展-暴露 API** | ⭐⭐⭐⭐ 复杂 | ✅ 需要 | ✅ 是 | ✅ 是 | ⭐⭐⭐⭐ |
| **扩展-结果监听** | ⭐⭐⭐⭐ 复杂 | ✅ 需要 | ✅ 是 | ✅ 是 | ⭐⭐⭐⭐⭐ |

---

## 💻 **实际使用示例**

### **场景：分析 Redoc 文档中的 AI 搜索架构**

```typescript
import { query } from '@rdmind/sdk';

async function analyzeAISearchDoc() {
  const docUrl = 'https://docs.xiaohongshu.com/doc/abc123';
  
  const result = query({
    prompt: `
请读取这个文档：${docUrl}

然后回答以下问题：
1. 搜搜薯的技术框架是什么？
2. 文档中有哪些架构图？请描述这些图片展示的内容
3. 传统搜索和 AI 搜索的主要区别是什么？

注意：文档中可能包含图片，请结合图片内容进行分析。
    `,
    options: {
      cwd: process.cwd(),
      permissionMode: 'yolo',  // 自动执行 redoc_fetch
      model: 'qwen-max',       // 使用视觉模型
    }
  });

  console.log('正在分析文档...\n');
  
  for await (const message of result) {
    if (message.type === 'assistant') {
      console.log('AI 分析结果：');
      console.log(message.message.content);
      console.log('\n---\n');
    } else if (message.type === 'result') {
      console.log('任务完成！');
      console.log('Session ID:', message.sessionId);
    }
  }
}

analyzeAISearchDoc();
```

**预期输出：**
```
正在分析文档...

AI 分析结果：
我已经读取了文档内容，包括文档中的 5 张图片。以下是分析结果：

1. 搜搜薯的技术框架包含以下组件：
   - 用户搜索路径分析
   - 线上链路系统（如图 2 所示的架构图）
   - 技术大图（如图 3 展示的模块关系）
   ...

2. 文档中包含 5 张图片：
   - 图片 1: 用户搜索路径流程图，展示了...
   - 图片 2: 搜搜薯线上链路架构（2094x944），显示了...
   - 图片 3: 搜搜薯技术大图（306x250），包含了...
   ...

3. 传统搜索 vs AI 搜索的区别：
   根据文档中的对比表格...

---

任务完成！
Session ID: xxx-xxx-xxx
```

---

## ✅ **最终建议**

**对于当前需求（2026-01-31）：**

1. **短期方案（推荐）**：使用 **方式 B（提示词调用）**
   - 适合大部分场景
   - 零修改，立即可用
   - AI 会自动理解文档和图片

2. **中期优化**：如果需要原始数据，考虑 **扩展-结果监听**
   - 增强 SDK 消息协议
   - 支持 `includeToolResults` 选项
   - 既能让 AI 处理，又能获取原始数据

3. **长期规划**：考虑 **暴露核心工具 API**
   - 将常用工具导出到 SDK
   - 提供更灵活的调用方式
   - 类似 LangChain 的 Tools 系统

**示例代码仓库位置：**
- Redoc 工具实现：`packages/core/src/tools/redoc-fetch.ts`
- SDK 工具扩展：`packages/sdk-typescript/src/mcp/`
- 集成测试示例：`integration-tests/sdk-typescript/`
