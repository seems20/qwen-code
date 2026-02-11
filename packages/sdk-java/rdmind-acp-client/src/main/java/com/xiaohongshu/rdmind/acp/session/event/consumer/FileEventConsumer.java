package com.xiaohongshu.rdmind.acp.session.event.consumer;

import com.xiaohongshu.rdmind.acp.protocol.agent.request.ReadTextFileRequest;
import com.xiaohongshu.rdmind.acp.protocol.agent.request.WriteTextFileRequest;
import com.xiaohongshu.rdmind.acp.protocol.client.response.ReadTextFileResponse.ReadTextFileResponseResult;
import com.xiaohongshu.rdmind.acp.protocol.client.response.WriteTextFileResponse.WriteTextFileResponseResult;
import com.xiaohongshu.rdmind.acp.session.event.consumer.exception.EventConsumeException;
import com.xiaohongshu.rdmind.acp.utils.Timeout;

/**
 * File Event Consumer Interface
 *
 * This interface defines methods for handling file-related events received from the AI agent,
 * such as reading and writing text files.
 *
 * @author SkyFire
 * @version 0.0.1
 */
public interface FileEventConsumer {
    /**
     * Handles read text file requests from the agent
     *
     * @param request Read text file request from the agent
     * @return Result of reading the file
     * @throws EventConsumeException Thrown when an error occurs during event processing
     */
    ReadTextFileResponseResult onReadTextFileRequest(ReadTextFileRequest request) throws EventConsumeException;

    /**
     * Handles write text file requests from the agent
     *
     * @param request Write text file request from the agent
     * @return Result of writing the file
     * @throws EventConsumeException Thrown when an error occurs during event processing
     */
    WriteTextFileResponseResult onWriteTextFileRequest(WriteTextFileRequest request) throws EventConsumeException;

    /**
     * Gets timeout for read text file request processing
     *
     * @param message Read text file request message
     * @return Timeout for processing the request
     */
    Timeout onReadTextFileRequestTimeout(ReadTextFileRequest message);

    /**
     * Gets timeout for write text file request processing
     *
     * @param message Write text file request message
     * @return Timeout for processing the request
     */
    Timeout onWriteTextFileRequestTimeout(WriteTextFileRequest message);
}
