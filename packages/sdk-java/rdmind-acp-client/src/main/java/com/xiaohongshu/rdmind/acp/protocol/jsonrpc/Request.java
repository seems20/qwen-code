package com.xiaohongshu.rdmind.acp.protocol.jsonrpc;

public class Request<P> extends MethodMessage<P> {
    public Request() {
    }

    public Request(String method, P params) {
        super(method, params);
    }
}
