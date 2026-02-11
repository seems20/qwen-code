package com.xiaohongshu.rdmind.acp.protocol.jsonrpc;

import java.util.UUID;

import com.xiaohongshu.rdmind.acp.protocol.agent.notification.SessionNotification;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.AuthenticateRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.ReadTextFileRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.RequestPermissionRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.WriteTextFileRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.terminal.CreateTerminalRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.terminal.KillTerminalCommandRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.terminal.ReleaseTerminalRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.terminal.TerminalOutputRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.terminal.WaitForTerminalExitRequest;
import com.xiaohongshu.rdmind.acp.protocol.client.request.InitializeRequest;
import com.xiaohongshu.rdmind.acp.protocol.client.request.LoadSessionRequest;
import com.xiaohongshu.rdmind.acp.protocol.client.request.NewSessionRequest;
import com.xiaohongshu.rdmind.acp.protocol.client.request.PromptRequest;
import com.xiaohongshu.rdmind.acp.protocol.client.request.SetSessionModeRequest;
import com.alibaba.fastjson2.annotation.JSONType;

import org.apache.commons.lang3.Validate;

@JSONType(typeKey = "method", seeAlso = {
        AuthenticateRequest.class,
        ReadTextFileRequest.class,
        RequestPermissionRequest.class,
        WriteTextFileRequest.class,
        CreateTerminalRequest.class,
        KillTerminalCommandRequest.class,
        ReleaseTerminalRequest.class,
        TerminalOutputRequest.class,
        WaitForTerminalExitRequest.class,
        InitializeRequest.class,
        LoadSessionRequest.class,
        NewSessionRequest.class,
        PromptRequest.class,
        SetSessionModeRequest.class,
        SessionNotification.class,
})
public class MethodMessage<P> extends Message {
    protected String method;
    protected P params;

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public P getParams() {
        return params;
    }

    public void setParams(P params) {
        this.params = params;
    }

    public MethodMessage() {
        this.id = UUID.randomUUID().toString();
    }

    public MethodMessage(String method, P params) {
        this();
        Validate.notEmpty(method, "method can not be empty");
        this.method = method;
        Validate.notNull(params, "params can not be null");
        this.params = params;
    }
}
