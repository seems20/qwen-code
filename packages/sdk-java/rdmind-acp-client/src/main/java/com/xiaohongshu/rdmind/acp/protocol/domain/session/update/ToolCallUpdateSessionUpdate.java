package com.xiaohongshu.rdmind.acp.protocol.domain.session.update;

import com.xiaohongshu.rdmind.acp.protocol.domain.tool.ToolCallUpdate;
import com.alibaba.fastjson2.annotation.JSONField;
import com.alibaba.fastjson2.annotation.JSONType;

@JSONType(typeName = "tool_call_update")
public class ToolCallUpdateSessionUpdate extends SessionUpdate {
    @JSONField(unwrapped = true)
    ToolCallUpdate toolCallUpdate;
}
