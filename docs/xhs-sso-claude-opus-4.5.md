# XHS SSO Claude Opus 4.5 集成

## 概述

本次更新为 XHS SSO 认证方式新增了对 Claude Opus 4.5 模型的支持。该模型通过小红书内部的 Vertex AI Anthropic 代理端点访问。

## 新增内容

### 1. 模型配置

在 `packages/cli/src/config/xhsSsoProviders.ts` 中新增了 Claude Opus 4.5 模型:

```typescript
{
  id: 'claude-opus-4-5@20251101',
  displayName: 'Claude Opus 4.5',
  baseUrl: 'https://runway.devops.rednote.life/openai/google/anthropic/v1',
  contextWindow: '200K',
  description: 'Anthropic 最强大的模型,擅长复杂推理和代码生成',
}
```

### 2. 新的 Content Generator

创建了 `VertexAnthropicContentGenerator` 类 (`packages/core/src/core/vertexAnthropicContentGenerator.ts`),专门处理 Vertex AI 格式的 Anthropic API 调用。

**关键特性:**

- 支持 Vertex AI 的 `:rawPredict` 和 `:streamRawPredict` 端点
- 使用 `api-key` header 进行认证
- 自动转换 Gemini 请求格式到 Vertex Anthropic 格式
- 支持流式和非流式响应
- 完整的遥测和错误处理

### 3. API 端点

- **非流式:** `https://runway.devops.rednote.life/openai/google/anthropic/v1:rawPredict`
- **流式:** `https://runway.devops.rednote.life/openai/google/anthropic/v1:streamRawPredict`

### 4. Token 限制

- **Context Window:** 200K tokens (配置中)
- **实际限制:** 1M tokens (按照 Claude Opus 4 系列的标准)

## 使用方法

### 通过 XHS SSO 认证

1. 完成 XHS SSO 认证流程
2. 在模型选择界面选择 "Claude Opus 4.5"
3. 系统会自动调用 API 获取模型 API Key
4. 系统会自动使用正确的 API 端点和认证方式

**注意**: 模型 ID 为 `claude-opus-4-5@20251101`，但调用 API 获取 Key 时会自动去除版本后缀 `@20251101`，只使用 `claude-opus-4-5`。

### API 请求格式

请求体遵循 Vertex AI Anthropic API 格式:

```json
{
  "anthropic_version": "vertex-2023-10-16",
  "messages": [
    {
      "role": "user",
      "content": "你的问题"
    }
  ],
  "max_tokens": 10000,
  "stream": false,
  "temperature": 1.0
}
```

### 响应格式

响应会被自动转换为 Gemini 格式,以保持与现有代码的兼容性。

## 技术细节

### 模型名称预处理

为了正确获取模型的 API Key，系统会对不同类型的模型名称进行预处理：

#### Gemini 模型

- 原始名称: `gemini-3-pro-preview(low)`
- 处理后: `gemini-3-pro-preview`
- 规则: 去除括号内的思考等级后缀

#### Claude 模型

- 原始名称: `claude-opus-4-5@20251101`
- 处理后: `claude-opus-4-5`
- 规则: 去除 `@` 符号及后面的版本号

这个预处理逻辑在 `packages/core/src/config/modelKeyFetcher.ts` 中实现。

### 架构决策

选择创建 `VertexAnthropicContentGenerator` 而不是直接使用 `AnthropicContentGenerator` 的原因:

1. **API 格式差异:** Vertex AI 使用的是 Google 风格的 API 端点 (`:rawPredict`, `:streamRawPredict`),而不是标准的 Anthropic Messages API
2. **认证方式:** 使用 `api-key` header 而不是 `x-api-key`
3. **请求格式:** 需要 `anthropic_version` 字段
4. **隔离性:** 保持 XHS 内部实现与标准 Anthropic SDK 的隔离

### 代码流程

```
用户选择 Claude Opus 4.5
    ↓
XHS SSO 认证
    ↓
contentGenerator.ts 检测模型名称以 "claude" 开头
    ↓
创建 VertexAnthropicContentGenerator 实例
    ↓
转换请求格式 (Gemini → Vertex Anthropic)
    ↓
调用内部代理端点
    ↓
转换响应格式 (Vertex Anthropic → Gemini)
    ↓
返回给用户
```

## 测试

运行以下命令测试新功能:

```bash
# 单元测试
npm test -- vertexAnthropicContentGenerator

# Token 限制测试
npm test -- tokenLimits
```

## 参考资料

- [Google Vertex AI Claude 文档](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude/use-claude?hl=zh_cn)
- [Anthropic Messages API](https://docs.anthropic.com/claude/reference/messages_post)
- [内部 Runway 代理文档](https://runway.devops.rednote.life/docs)

## 注意事项

1. Claude Opus 4.5 仅在 XHS SSO 认证方式下可用
2. 需要有效的内部 API Key
3. 模型 ID 必须使用完整的版本后缀: `claude-opus-4-5@20251101`
4. 该实现仅用于小红书内部环境,不适用于外部 Vertex AI 或 Anthropic API

## 未来改进

- [ ] 添加更多 Claude 模型 (Sonnet, Haiku)
- [ ] 支持工具调用 (Function Calling)
- [ ] 支持提示缓存 (Prompt Caching)
- [ ] 优化 token 计数的准确性
- [ ] 添加更完整的错误处理和重试机制
