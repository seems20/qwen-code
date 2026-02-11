package com.xiaohongshu.rdmind.acp.protocol.agent.response;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Response;

import static com.xiaohongshu.rdmind.acp.protocol.agent.response.AuthenticateResponse.AuthenticateResponseResult;

public class AuthenticateResponse extends Response<AuthenticateResponseResult> {
    public static class AuthenticateResponseResult {
        // Empty result class as per schema
    }
}
