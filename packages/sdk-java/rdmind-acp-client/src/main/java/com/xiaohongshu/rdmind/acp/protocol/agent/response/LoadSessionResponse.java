package com.xiaohongshu.rdmind.acp.protocol.agent.response;

import com.xiaohongshu.rdmind.acp.protocol.domain.session.SessionModeState;
import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Response;

import static com.xiaohongshu.rdmind.acp.protocol.agent.response.LoadSessionResponse.LoadSessionResponseResult;

public class LoadSessionResponse extends Response<LoadSessionResponseResult> {
    public static class LoadSessionResponseResult {
        private SessionModeState modes;

        // Getters and setters
        public SessionModeState getModes() {
            return modes;
        }

        public void setModes(SessionModeState modes) {
            this.modes = modes;
        }
    }
}
