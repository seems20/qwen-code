# 递归图片提取 - 真实案例分析

## 问题复现

你提供的 Redoc 文档包含以下嵌套结构：

```json
{
  "children": [
    {"type": "title", "children": [{"text": "AI 搜索"}]},
    {"type": "h1", "children": [{"text": "传统搜索 vs AI搜索"}]},
    {"type": "table", "children": [...]},
    {"type": "h1", "children": [{"text": "搜搜薯怎么做的"}]},
    {"type": "h2", "children": [{"text": "用户搜索路径"}]},
    {"type": "image", "url": "https://xhs-doc.xhscdn.com/1040025031kfn1vu8i005f490cs?imageView2/2/w/1600"},
    {"type": "h2", "children": [{"text": "搜搜薯技术框架"}]},
    {
      "type": "columns",  // ← 嵌套容器
      "children": [
        {
          "type": "column",  // ← 第一栏
          "children": [
            {"type": "paragraph", "children": [{"text": "搜搜薯线上链路"}]},
            {
              "type": "image",  // ← 嵌套在 columns > column 中的图片
              "url": "https://xhs-doc.xhscdn.com/1040025031bkkisfe7u0222gi74?imageView2/2/w/1600",
              "width": 2094,
              "height": 944
            }
          ]
        },
        {
          "type": "column",  // ← 第二栏
          "children": [
            {"type": "paragraph", "children": [{"text": "搜搜薯技术大图"}]},
            {
              "type": "image",  // ← 嵌套在 columns > column 中的图片
              "url": "https://xhs-doc.xhscdn.com/1040025031bkkhvu9nu06ja5ql8?imageView2/2/w/1600",
              "width": 306,
              "height": 250
            }
          ]
        }
      ]
    },
    {"type": "h3", "children": [{"text": "通用问答生成"}]},
    {"type": "image", "url": "https://xhs-doc.xhscdn.com/1040025031kfousue2009ldrluo?imageView2/2/w/1600"}
  ]
}
```

## 问题分析

### 旧版本（只处理顶层）

```typescript
// 只遍历 contentObj.children
for (const child of contentObj.children) {
  if (child.type === 'image') {
    // 只能找到顶层图片
  }
}
```

**识别结果：**
- ✅ 图片1: 用户搜索路径图 (顶层)
- ❌ 图片2: 搜搜薯线上链路 (在 columns > column 中)
- ❌ 图片3: 搜搜薯技术大图 (在 columns > column 中)
- ✅ 图片4: 通用问答生成图 (顶层)
- ✅ 图片5: deep-searcher 架构图 (顶层)

**只找到 3/5 张图片！**

### 新版本（递归处理）

```typescript
const processNode = async (node: any, depth: number = 0): Promise<void> => {
  // 处理图片
  if (node.type === 'image' && node.url) {
    await downloadAndAddImage(node);
    return;
  }

  // 递归处理子节点
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      await processNode(child, depth + 1);  // 递归！
    }
  }
};
```

**识别结果：**
- ✅ 图片1: 用户搜索路径图 (depth=0)
- ✅ 图片2: 搜搜薯线上链路 (depth=2, columns>column>image)
- ✅ 图片3: 搜搜薯技术大图 (depth=2, columns>column>image)
- ✅ 图片4: 通用问答生成图 (depth=0)
- ✅ 图片5: deep-searcher 架构图 (depth=0)

**找到全部 5/5 张图片！**

## 实际输出效果

### 发送给模型的 parts 结构

```javascript
[
  { text: "提示词部分..." },
  { text: "# AI 搜索\n## 传统搜索 vs AI搜索\n[表格内容]\n## 搜搜薯怎么做的\n## 用户搜索路径\n" },
  { text: "\n[图片 1 (799x307)]\n" },
  { inlineData: { data: "base64...", mimeType: "image/png" } },  // 图片1
  { text: "## 搜搜薯技术框架\n[多栏布局]\n[栏目]\n搜搜薯线上链路\n" },
  { text: "\n[图片 2 (2094x944)]\n" },
  { inlineData: { data: "base64...", mimeType: "image/png" } },  // 图片2（嵌套）
  { text: "[栏目]\n搜搜薯技术大图\n" },
  { text: "\n[图片 3 (306x250)]\n" },
  { inlineData: { data: "base64...", mimeType: "image/png" } },  // 图片3（嵌套）
  { text: "### 通用问答生成\n" },
  { text: "\n[图片 4 (1502x296)]\n" },
  { inlineData: { data: "base64...", mimeType: "image/png" } },  // 图片4
  { text: "### 特殊答案生成\n# Perplexity\n...\n# 可参考的技术实现路径\n" },
  { text: "\n[图片 5 (526x439)]\n" },
  { inlineData: { data: "base64...", mimeType: "image/png" } },  // 图片5
  { text: "## 定义和提炼问题\n..." }
]
```

## 日志输出

启用 debug 后可以看到：

```
[RedocFetchTool] Downloading image 1 (depth 0): https://...kfn1vu8i005f490cs
[RedocFetchTool] Image 1 downloaded successfully
[RedocFetchTool] Downloading image 2 (depth 2): https://...bkkisfe7u0222gi74
[RedocFetchTool] Image 2 downloaded successfully
[RedocFetchTool] Downloading image 3 (depth 2): https://...bkkhvu9nu06ja5ql8
[RedocFetchTool] Image 3 downloaded successfully
[RedocFetchTool] Downloading image 4 (depth 0): https://...kfousue2009ldrluo
[RedocFetchTool] Image 4 downloaded successfully
[RedocFetchTool] Downloading image 5 (depth 0): https://...kfpdqlvi005lr861c
[RedocFetchTool] Image 5 downloaded successfully
[RedocFetchTool] Content parsed: 5 images found, 5 downloaded successfully
```

注意 `depth 2` 表示这些图片是嵌套在两层容器内的！

## 支持的嵌套结构

现在能正确处理的所有嵌套类型：

```typescript
// 1. 多栏布局 (columns/column)
{
  type: 'columns',
  children: [
    { type: 'column', children: [
      { type: 'image', url: '...' }  // ✅ 能识别
    ]}
  ]
}

// 2. 表格单元格 (table/tr/td/table-cell-block)
{
  type: 'table',
  children: [
    { type: 'tr', children: [
      { type: 'td', children: [
        { type: 'table-cell-block', children: [
          { type: 'image', url: '...' }  // ✅ 能识别
        ]}
      ]}
    ]}
  ]
}

// 3. 引用块 (block-quote)
{
  type: 'block-quote',
  children: [
    { type: 'image', url: '...' }  // ✅ 能识别
  ]
}

// 4. 任意深度嵌套
{
  type: 'container1',
  children: [
    { type: 'container2', children: [
      { type: 'container3', children: [
        { type: 'image', url: '...' }  // ✅ 能识别
      ]}
    ]}
  ]
}
```

## 对比总结

| 维度 | 旧版本 | 新版本 |
|------|--------|--------|
| **图片识别** | 只识别顶层 | 递归识别所有层级 |
| **你的例子** | 3/5 张图片 | 5/5 张图片 ✅ |
| **顺序保持** | ❌ 不保持 | ✅ 完全保持 |
| **嵌套支持** | ❌ 不支持 | ✅ 支持任意深度 |
| **文本提取** | 基础支持 | 支持 h1/h2/h3/table/columns 等 |
| **上下文理解** | ❌ 差 | ✅ 完整 |

## 模型理解效果

现在当模型看到你的文档时：

```
# AI 搜索

## 用户搜索路径
[图片 1 (799x307)]
<图片1数据>

## 搜搜薯技术框架
[多栏布局]
[栏目]
搜搜薯线上链路
[图片 2 (2094x944)]
<图片2数据>

[栏目]
搜搜薯技术大图
[图片 3 (306x250)]
<图片3数据>

### 通用问答生成
[图片 4 (1502x296)]
<图片4数据>

# 可参考的技术实现路径
[图片 5 (526x439)]
<图片5数据>
```

模型能清楚地知道：
- ✅ "搜搜薯线上链路" 这段文字对应的是图片2
- ✅ "搜搜薯技术大图" 这段文字对应的是图片3
- ✅ 两张图在多栏布局中并排显示
- ✅ 每张图片的位置和上下文关系
- ✅ deep-searcher 架构图在正确的位置

完美解决了嵌套图片识别问题！🎉
