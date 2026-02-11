package com.xiaohongshu.rdmind.acp.protocol.client.notification;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.MethodMessage;

public class ClientNotification<P> extends MethodMessage<P> {
    public ClientNotification() {
        super();
    }

    public ClientNotification(String method, P params) {
        super(method, params);
    }
}
