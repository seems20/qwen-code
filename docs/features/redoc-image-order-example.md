# Redoc 图片顺序保持示例

## 示例文档结构

假设 Redoc 文档的 JSON 结构如下：

```json
{
  "children": [
    {
      "type": "title",
      "children": [{"text": "数据趋势分析"}]
    },
    {
      "type": "paragraph",
      "children": [{"text": "以下是12月18日的用量数据："}]
    },
    {
      "type": "image",
      "url": "https://xhs-doc.xhscdn.com/usage-dec18.png",
      "width": 966,
      "height": 257
    },
    {
      "type": "paragraph",
      "children": [{"text": "从图中可以看出，用量在18日出现了明显上升。"}]
    },
    {
      "type": "paragraph",
      "children": [{"text": "对比12月22日的数据："}]
    },
    {
      "type": "image",
      "url": "https://xhs-doc.xhscdn.com/usage-dec22.png",
      "width": 2330,
      "height": 592
    },
    {
      "type": "paragraph",
      "children": [{"text": "22日的用量进一步增长，达到了新高。"}]
    }
  ]
}
```

## 旧版本实现（图片在最后）

```javascript
// 旧版本：先处理所有文本，然后下载所有图片
const parts = [
  {
    text: `# 数据趋势分析
以下是12月18日的用量数据：
从图中可以看出，用量在18日出现了明显上升。
对比12月22日的数据：
22日的用量进一步增长，达到了新高。

[包含2张图片，已附在下方]`
  },
  { inlineData: { ... } },  // 图片1
  { inlineData: { ... } },  // 图片2
]
```

**问题：**
- 模型看不出图片1对应的是 "12月18日的数据"
- 模型看不出图片2对应的是 "12月22日的数据"
- 无法理解 "从图中可以看出" 指的是哪张图
- 图片与文本的上下文关系丢失

## 新版本实现（保持原始顺序）

```javascript
// 新版本：遍历文档结构，按顺序插入文本和图片
const parts = [
  {
    text: `提示词部分...

---`
  },
  {
    text: `# 数据趋势分析
以下是12月18日的用量数据：`
  },
  {
    text: `\n[图片 1 (966x257)]\n`
  },
  {
    inlineData: {
      data: "base64编码的图片1数据...",
      mimeType: "image/png"
    }
  },
  {
    text: `从图中可以看出，用量在18日出现了明显上升。
对比12月22日的数据：`
  },
  {
    text: `\n[图片 2 (2330x592)]\n`
  },
  {
    inlineData: {
      data: "base64编码的图片2数据...",
      mimeType: "image/png"
    }
  },
  {
    text: `22日的用量进一步增长，达到了新高。`
  },
  {
    text: `---

请根据上述内容回答...`
  }
]
```

**优势：**
- ✅ 模型明确知道图片1是 "12月18日的数据"
- ✅ 模型明确知道图片2是 "12月22日的数据"
- ✅ "从图中可以看出" 指的是**前面的图片1**
- ✅ 图片与文本的上下文关系完整保留
- ✅ 模型可以进行前后对比分析

## 实际对话效果

### 旧版本

**用户：** 请分析这个文档，两个日期的用量有什么变化趋势？

**AI（看不到顺序）：** 
我看到文档中提到了12月18日和12月22日的数据，以及两张图片。但我无法确定哪张图对应哪个日期，因为图片都在最后。根据文本描述，用量在18日上升，22日进一步增长达到新高。

### 新版本

**用户：** 请分析这个文档，两个日期的用量有什么变化趋势？

**AI（能看到顺序和上下文）：**
我分析了文档中的两张图表：

1. **12月18日（第一张图）**：从966x257的图表中可以看到，用量曲线开始上升，峰值约为XXX。

2. **12月22日（第二张图）**：从2330x592的大图表中可以清楚看到，用量继续增长，峰值达到YYY，比18日增长了约ZZ%。

**变化趋势：**
- 整体呈上升趋势
- 从第一张图到第二张图，增长幅度显著
- 正如文档所述，22日确实达到了新高

## 代码实现细节

### 顺序保持的关键

```typescript
// buildContentWithImages 方法按顺序处理
for (let i = 0; i < contentObj.children.length; i++) {
  const child = contentObj.children[i];

  if (child.type === 'image' && child.url) {
    // 遇到图片：先输出前面累积的文本
    if (textBuffer.length > 0) {
      parts.push({ text: textBuffer.join('\n') });
      textBuffer = [];
    }
    
    // 下载并添加图片
    const imageData = await downloadImageAsBase64(child.url, signal);
    parts.push({ text: `\n[图片 ${imageCount}]\n` });
    parts.push({ inlineData: imageData });
    
  } else {
    // 文本节点：累积到 buffer
    textBuffer.push(extractTextFromNode(child));
  }
}

// 最后输出剩余文本
if (textBuffer.length > 0) {
  parts.push({ text: textBuffer.join('\n') });
}
```

### 并行下载 vs 顺序输出

虽然图片是**并行下载**的（提高速度），但输出时会**按原始索引顺序**排列：

```typescript
// 错误做法：按下载完成顺序
const imagePromises = imageUrls.map(url => download(url));
const results = await Promise.all(imagePromises);
// ❌ 快的图片先完成，慢的后完成，顺序乱了

// 正确做法：边遍历边下载
for (let i = 0; i < children.length; i++) {
  if (child.type === 'image') {
    const imageData = await download(child.url);  // 按顺序等待
    parts.push(imageData);
  }
}
// ✅ 保持原始顺序
```

## 性能考虑

### 是否会变慢？

**理论上：** 是的，因为图片是按顺序下载的，不能完全并行。

**实际上：** 影响很小，因为：
1. 大部分时间花在网络 I/O 上
2. 节点遍历和文本处理非常快
3. 用户更关心准确性而非速度
4. 通常一个文档只有 2-5 张图片

### 优化空间

如果文档包含大量图片（>10张），可以考虑：

```typescript
// 提前批量下载所有图片，但按顺序输出
const imageMap = new Map();
const imagePromises = imageUrls.map(async (url, index) => {
  const data = await download(url);
  imageMap.set(index, data);
});
await Promise.all(imagePromises);  // 并行下载

// 然后按顺序输出
for (const child of children) {
  if (child.type === 'image') {
    const data = imageMap.get(child.index);
    parts.push(data);
  }
}
```

## 总结

新版本通过**保持图片在文档中的原始位置**，让 AI 模型能够：
- 理解图片与前后文本的关系
- 正确引用和分析特定图片
- 进行基于位置的对比分析
- 提供更准确的回答

这是一个重要的改进，特别是对于包含多张图表的技术文档、数据报告等场景。
