package com.xiaohongshu.sns.demo.common.utils;

import com.xiaohongshu.infra.rpc.base.Result;
import org.junit.Test;
import static org.junit.Assert.*;

public class RpcResultUtilsTest {

    @Test
    public void success() {
        Result result = RpcResultUtils.success();
        
        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals(0, result.getCode());
        assertEquals("success", result.getMessage());
    }

    @Test
    public void failed() {
        String errorMsg = "test error";
        Result result = RpcResultUtils.failed(errorMsg);
        
        assertNotNull(result);
        assertFalse(result.isSuccess());
        assertEquals(-1, result.getCode());
        assertEquals(errorMsg, result.getMessage());
    }
}
