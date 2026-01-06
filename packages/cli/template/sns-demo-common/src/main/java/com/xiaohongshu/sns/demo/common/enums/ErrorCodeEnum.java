package com.xiaohongshu.sns.demo.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;


/**
 * @author chenhuanjie
 */

@Getter
@AllArgsConstructor
public enum ErrorCodeEnum {

    // 通用错误码 1000 - 1999
    SYSTEM_ERROR(1000, "系统异常，请稍后再试"),
    PARAM_ERROR(1001, "参数错误，请检查"),
    PARAM_NULL(1002, "请求参数不能为空"),
    PARAM_BLANK(1003, "必填参数不能为空"),
    PARAM_INVALID(1004, "参数格式无效"),
    ;
    /**
     * 错误码
     */
    private final int code;
    /**
     * 错误信息
     */
    private final String msg;
}
