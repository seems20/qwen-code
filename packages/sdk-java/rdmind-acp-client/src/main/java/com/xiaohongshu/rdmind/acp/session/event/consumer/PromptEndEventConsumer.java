package com.xiaohongshu.rdmind.acp.session.event.consumer;

import com.xiaohongshu.rdmind.acp.protocol.agent.response.PromptResponse.PromptResponseResult;
import com.xiaohongshu.rdmind.acp.utils.Timeout;

/**
 * Prompt End Event Consumer Interface
 *
 * This interface defines methods for handling prompt completion events received from the AI agent.
 *
 * @author SkyFire
 * @version 0.0.1
 */
public interface PromptEndEventConsumer {
    /**
     * Handles prompt end events from the agent
     *
     * @param promptResponseResult Prompt response result indicating the end of a prompt
     */
    void onPromptEnd(PromptResponseResult promptResponseResult);

    /**
     * Gets timeout for prompt end event processing
     *
     * @param promptResponseResult Prompt response result
     * @return Timeout for processing the event
     */
    Timeout onPromptEndTimeout(PromptResponseResult promptResponseResult);
}
