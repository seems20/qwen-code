package com.xiaohongshu.rdmind.acp.protocol.domain.plan;

import java.util.List;

import com.xiaohongshu.rdmind.acp.protocol.jsonrpc.Meta;

public class Plan extends Meta {
    private List<PlanEntry> entries;

    // Getters and setters
    public List<PlanEntry> getEntries() {
        return entries;
    }

    public void setEntries(List<PlanEntry> entries) {
        this.entries = entries;
    }
}
