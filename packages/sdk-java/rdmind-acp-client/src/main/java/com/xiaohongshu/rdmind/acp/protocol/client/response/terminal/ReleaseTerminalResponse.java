package com.xiaohongshu.rdmind.acp.protocol.client.response.terminal;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Response;

import static com.xiaohongshu.rdmind.acp.protocol.client.response.terminal.ReleaseTerminalResponse.ReleaseTerminalResponseResult;

public class ReleaseTerminalResponse extends Response<ReleaseTerminalResponseResult> {
    public static class ReleaseTerminalResponseResult {
        // Empty result class as per schema
    }
}
