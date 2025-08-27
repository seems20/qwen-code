package com.xiaohongshu.sns.demo.common.utils;

import com.xiaohongshu.infra.rpc.base.Result;


public final class RpcResultUtils {
    public static Result success() {
        Result result = new Result();
        result.setSuccess(true);
        result.setCode(0);
        result.setMessage("success");
        return result;
    }

    public static Result failed(String msg) {
        Result result = new Result();
        result.setSuccess(false);
        result.setCode(-1);
        result.setMessage(msg);
        return result;
    }
}
