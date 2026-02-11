package com.xiaohongshu.rdmind.acp.protocol.client.response;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Response;

import static com.xiaohongshu.rdmind.acp.protocol.client.response.WriteTextFileResponse.WriteTextFileResponseResult;

public class WriteTextFileResponse extends Response<WriteTextFileResponseResult> {
    public static class WriteTextFileResponseResult {
        // Empty result class as per schema
    }
}
