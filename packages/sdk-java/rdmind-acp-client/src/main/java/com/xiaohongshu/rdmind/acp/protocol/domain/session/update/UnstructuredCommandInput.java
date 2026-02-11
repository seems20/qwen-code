package com.xiaohongshu.rdmind.acp.protocol.domain.session.update;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Meta;

public class UnstructuredCommandInput extends Meta {
    private String hint;

    // Getters and setters
    public String getHint() {
        return hint;
    }

    public void setHint(String hint) {
        this.hint = hint;
    }
}
