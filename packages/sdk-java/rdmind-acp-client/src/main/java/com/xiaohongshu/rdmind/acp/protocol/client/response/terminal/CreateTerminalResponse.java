package com.xiaohongshu.rdmind.acp.protocol.client.response.terminal;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Response;

import static com.xiaohongshu.rdmind.acp.protocol.client.response.terminal.CreateTerminalResponse.CreateTerminalResponseResult;

public class CreateTerminalResponse extends Response<CreateTerminalResponseResult> {
    public static class CreateTerminalResponseResult {
        private String terminalId;

        // Getters and setters
        public String getTerminalId() {
            return terminalId;
        }

        public void setTerminalId(String terminalId) {
            this.terminalId = terminalId;
        }
    }
}
