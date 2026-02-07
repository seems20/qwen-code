# Microsoft AI Foundry - Create Response (Foundry V1) 协议规范

本文档记录了基于 [Microsoft AI Foundry 官方文档](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/latest?view=foundry-classic#create-response) 的 **Create Response (Foundry V1)** 协议核心规范。

## 1. 基础信息

- **接口端点**: `POST {endpoint}/openai/v1/responses?api-version=v1`
- **内容类型**: `Content-Type: application/json`
- **认证方式**:
  - `api-key: {your-api-key}` (Header)
  - 或 `Authorization: Bearer {token}` (Header)

## 2. 请求参数 (Request Body)

Foundry V1 协议与 OpenAI 标准 Chat API 有显著差异，采用更具任务导向的结构。

| 字段名                     | 类型                | 说明                                                | 对应 OpenAI 标准字段    |
| :------------------------- | :------------------ | :-------------------------------------------------- | :---------------------- |
| **`model`**                | `string`            | 模型部署 ID (Required)                              | `model`                 |
| **`input`**                | `string` \| `array` | 对话历史/输入。**替代 messages**。支持多模态。      | `messages`              |
| **`instructions`**         | `string`            | 系统指令。**类似于 system message**。               | `messages[role=system]` |
| **`previous_response_id`** | `string`            | 用于多轮对话。引用前一个响应 ID 以维持上下文。      | - (有状态设计)          |
| **`max_output_tokens`**    | `integer`           | **替代 max_tokens** 或 `max_completion_tokens`。    | `max_completion_tokens` |
| **`reasoning`**            | `object`            | 推理配置。包含 `effort` (`low`, `medium`, `high`)。 | `reasoning_effort`      |
| **`stream`**               | `boolean`           | 是否开启流式响应 (SSE)。                            | `stream`                |
| **`temperature`**          | `number`            | 采样温度。                                          | `temperature`           |
| **`top_p`**                | `number`            | 核采样概率。                                        | `top_p`                 |
| **`truncation`**           | `string`            | 截断策略：`auto` 或 `disabled`。                    | -                       |
| **`store`**                | `boolean`           | 是否在服务端存储此响应（以便后续引用）。            | -                       |

## 3. 响应结构 (Response Body)

### 3.1 非流式 (Non-Streaming)

```json
{
  "id": "res_...",
  "object": "model.response",
  "created": 123456789,
  "model": "gpt-5-codex",
  "status": "completed",
  "output": [
    {
      "type": "message",
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      }
    }
  ],
  "usage": {
    "total_tokens": 100,
    "prompt_tokens": 40,
    "completion_tokens": 60
  }
}
```

### 3.2 流式 (Streaming - SSE)

- 数据格式：`data: { ... }`
- 最后一个有效数据块（在 `data: [DONE]` 之前）会包含完整的 `usage` 信息。
- 内容增量通常位于 `output[0].delta.content` 或 `output[0].message.content`。

## 4. 关键差异点汇总

1. **参数更名**: `messages` -> `input`, `max_tokens` -> `max_output_tokens`。
2. **结构嵌套**: 生成的内容被包裹在 `output` 数组中，而不是 `choices`。
3. **推理字段**: `reasoning` 是一个对象，而不仅仅是字符串。
4. **有状态引用**: 通过 `previous_response_id` 实现原生上下文追踪，减少重复传输历史记录。
