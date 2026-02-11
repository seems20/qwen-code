package com.xiaohongshu.rdmind.acp.protocol.client.response.terminal;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Response;

import static com.xiaohongshu.rdmind.acp.protocol.client.response.terminal.KillTerminalCommandResponse.KillTerminalCommandResponseResult;

public class KillTerminalCommandResponse extends Response<KillTerminalCommandResponseResult> {
    public static class KillTerminalCommandResponseResult {
        // Empty result class as per schema
    }
}
