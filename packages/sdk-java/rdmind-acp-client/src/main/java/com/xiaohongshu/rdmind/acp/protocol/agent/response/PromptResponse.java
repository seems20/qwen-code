package com.xiaohongshu.rdmind.acp.protocol.agent.response;

import com.xiaohongshu.rdmind.acp.protocol.domain.session.StopReason;
import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Response;

import static com.xiaohongshu.rdmind.acp.protocol.agent.response.PromptResponse.PromptResponseResult;

public class PromptResponse extends Response<PromptResponseResult> {
    public static class PromptResponseResult {
        private StopReason stopReason;

        // Getters and setters
        public StopReason getStopReason() {
            return stopReason;
        }

        public void setStopReason(StopReason stopReason) {
            this.stopReason = stopReason;
        }
    }
}
