# Redoc 文档图片支持

## 概述

`redoc_fetch` 工具支持自动识别和下载 Redoc 文档中的图片，并**按照文档中的原始顺序**将图片与文本一起发送给支持 vision 的 AI 模型进行理解。

## 功能特性

- ✅ **自动提取图片**：从 Redoc API 返回的 JSON content 中自动识别 `type: "image"` 的节点
- ✅ **保持原始顺序**：图片会插入到文档的原始位置，而不是全部放在最后
- ✅ **上下文感知**：模型可以理解图片与前后文本的关系
- ✅ **并行下载**：同时下载多张图片，提高效率（但保持原始顺序）
- ✅ **图片理解**：将图片转换为 Base64 并与文本交替发送给模型
- ✅ **错误容忍**：单张图片下载失败不影响整体处理，会显示占位符
- ✅ **大小限制**：单张图片最大 20MB，避免过大文件
- ✅ **超时控制**：图片下载 30 秒超时保护

## 工作原理

### 1. 文档结构识别与顺序保持

当 Redoc API 返回如下结构时：

```json
{
  "result": {
    "success": true,
    "code": 0,
    "message": "success"
  },
  "title": "用量",
  "content": "{\"children\":[
    {\"type\":\"title\",\"text\":\"用量\"},
    {\"type\":\"paragraph\",\"text\":\"12.18 21:02\"},
    {\"type\":\"image\",\"url\":\"https://xhs-doc.xhscdn.com/image1.png\",\"width\":966,\"height\":257},
    {\"type\":\"paragraph\",\"text\":\"说明文字\"},
    {\"type\":\"image\",\"url\":\"https://xhs-doc.xhscdn.com/image2.png\",\"width\":2330,\"height\":592}
  ]}"
}
```

工具会按顺序处理：
1. **遍历 `children` 数组**，按索引顺序处理每个节点
2. **遇到文本节点**（title, paragraph等）：累积到文本缓冲区
3. **遇到图片节点**：
   - 将缓冲区的文本作为一个 part 输出
   - 下载图片并转换为 Base64
   - 添加图片说明（位置、尺寸）
   - 添加图片数据作为 inlineData part
4. **继续处理**后续节点，保持相对顺序

### 2. 实际发送的内容结构

最终发送给模型的 parts 数组示例：

```javascript
[
  { text: "提示词：请分析以下文档..." },
  { text: "# 用量\n12.18 21:02\n" },  // 文本1
  { text: "\n[图片 1 (966x257)]\n" },   // 图片1说明
  { inlineData: { data: "base64...", mimeType: "image/png" } },  // 图片1数据
  { text: "说明文字\n" },                // 文本2
  { text: "\n[图片 2 (2330x592)]\n" },  // 图片2说明
  { inlineData: { data: "base64...", mimeType: "image/png" } },  // 图片2数据
  { text: "---\n请根据上述内容回答..." }
]
```

这样模型就能理解：
- **图片1** 是在 "12.18 21:02" 后面
- **图片2** 是在 "说明文字" 后面
- 图片与文本的上下文关系被完整保留

## 使用示例

### 基本用法

```bash
qwen chat
```

然后提问：
```
请帮我分析这个文档：https://docs.xiaohongshu.com/doc/abc123...
里面的图表显示了什么趋势？
```

### 支持的模型

只要模型本身支持 vision，就能使用这个功能：

- ✅ **Gemini** (gemini-2.0-flash-exp, gemini-pro-vision 等)
- ✅ **Kimi/Moonshot** (moonshot-v1-128k)
- ✅ **Qwen Vision** (vision-model, qwen-vl-plus 等)
- ✅ **GPT-4 Vision** (gpt-4-turbo, gpt-4o 等)
- ✅ 其他支持 vision 的 OpenAI 兼容模型

### 日志输出

启用 debug 模式可以看到详细的处理过程：

```bash
DEBUG=rdmind:* qwen chat
```

日志示例：
```
[RedocFetchTool] Found 3 images in document
[RedocFetchTool] Downloading 3 images...
[RedocFetchTool] Downloading image from: https://xhs-doc.xhscdn.com/image1.png
[RedocFetchTool] Successfully downloaded image: 0.18MB, type: image/png
[RedocFetchTool] Image 1/3 downloaded successfully
[RedocFetchTool] Image 2/3 downloaded successfully
[RedocFetchTool] Failed to download image 3/3: Timeout
```

## 配置选项

### 图片大小限制

默认单张图片最大 20MB，可以在代码中修改 `MAX_IMAGE_SIZE_MB` 常量：

```typescript
const MAX_IMAGE_SIZE_MB = 20; // 修改此值
```

### 下载超时

默认 30 秒超时，可以修改 `IMAGE_DOWNLOAD_TIMEOUT_MS` 常量：

```typescript
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30000; // 修改此值 (毫秒)
```

## 错误处理

### 单张图片失败

如果某张图片下载失败（超时、太大、网络错误等），不会影响其他图片和整体处理：

```
[RedocFetchTool] Warning: Failed to download image from https://...
[RedocFetchTool] Successfully processed with 2/3 images
```

### 所有图片失败

即使所有图片都下载失败，文本内容仍然会被发送给模型处理：

```
[RedocFetchTool] 0 images downloaded successfully
[RedocFetchTool] Processing with text only
```

## 性能考虑

### 并行下载

多张图片会并行下载，不会串行等待：

```javascript
const imagePromises = imageUrls.map(url => downloadImageAsBase64(url, signal));
const results = await Promise.all(imagePromises);
```

### Base64 开销

图片转换为 Base64 会增加约 33% 的数据量：
- 原始图片：1MB
- Base64 编码后：~1.33MB

### Token 消耗

图片会消耗额外的 tokens：
- 小图片 (< 100KB)：~100-300 tokens
- 中等图片 (100KB-1MB)：~300-1000 tokens
- 大图片 (1MB-20MB)：~1000-5000 tokens

## 安全考虑

### URL 白名单

目前只信任 Redoc API 返回的 URL，不会下载任意 URL。

### MIME 类型检查

只下载 `Content-Type: image/*` 的资源：

```javascript
if (!contentType.startsWith('image/')) {
  console.warn('URL does not return an image');
  return null;
}
```

### 大小限制

强制 20MB 限制避免：
- 内存溢出
- 下载时间过长
- Token 消耗过多

## 故障排查

### 图片顺序问题

**Q: 图片会保持文档中的原始顺序吗？**

A: **会的！** 新版本完全保持图片在文档中的原始位置。例如：

```
文本1
[图片1]
文本2
[图片2]
文本3
```

模型接收到的就是这个顺序，可以理解图片与前后文本的关系。

**Q: 旧版本是怎样的？**

A: 旧版本会把所有图片放在最后：

```
文本1
文本2
文本3
[图片1]
[图片2]
```

这会导致模型无法理解图片的上下文。

1. **检查网络**：确保能访问图片 URL
2. **检查防火墙**：某些 CDN 可能限制访问
3. **检查图片大小**：超过 20MB 的图片会被跳过
4. **查看日志**：启用 debug 模式查看详细错误

### 模型不理解图片

1. **确认模型支持 vision**：不是所有模型都支持图片
2. **检查图片格式**：某些格式可能不被支持
3. **图片质量**：太小或太模糊的图片可能无法识别

### 处理速度慢

1. **图片数量多**：每张图片都需要下载时间
2. **图片文件大**：大图片下载和编码都需要时间
3. **网络慢**：检查网络连接速度

## 未来改进

可能的增强方向：

- [ ] 支持图片压缩以减少 token 消耗
- [ ] 支持图片缓存避免重复下载
- [ ] 支持更多文档类型（不仅限于 Redoc）
- [ ] 支持视频截图
- [ ] 支持 PDF 中的图片提取

## 相关文档

- [图片支持总览](./image-support.md)
- [Vision 模型切换](./vision-auto-switch.md)
- [工具开发指南](../development/tools.md)
