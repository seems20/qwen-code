package com.xiaohongshu.rdmind.acp.protocol.domain.session.update;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Meta;
import com.alibaba.fastjson2.annotation.JSONType;

@JSONType(typeKey = "sessionUpdate", typeName = "session_update",
        seeAlso = {AgentMessageChunkSessionUpdate.class,
                AvailableCommandsUpdateSessionUpdate.class,
                CurrentModeUpdateSessionUpdate.class,
                PlanSessionUpdate.class,
                ToolCallSessionUpdate.class,
                ToolCallUpdateSessionUpdate.class})
public class SessionUpdate extends Meta {
    String sessionUpdate;

    public String getSessionUpdate() {
        return sessionUpdate;
    }

    public void setSessionUpdate(String sessionUpdate) {
        this.sessionUpdate = sessionUpdate;
    }
}
