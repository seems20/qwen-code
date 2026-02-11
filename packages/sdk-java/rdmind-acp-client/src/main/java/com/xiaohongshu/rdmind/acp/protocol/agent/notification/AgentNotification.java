package com.xiaohongshu.rdmind.acp.protocol.agent.notification;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.MethodMessage;

public class AgentNotification<P> extends MethodMessage<P> {
    public AgentNotification() {
    }

    public AgentNotification(String method, P params) {
        super(method, params);
    }
}
