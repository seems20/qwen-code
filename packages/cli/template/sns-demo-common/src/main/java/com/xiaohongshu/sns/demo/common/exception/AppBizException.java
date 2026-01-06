package com.xiaohongshu.sns.demo.common.exception;



import com.xiaohongshu.sns.demo.common.enums.ErrorCodeEnum;
import lombok.Getter;


/**
 * @author chenhuanjie
 */
@Getter
public class AppBizException extends RuntimeException {

    private int errCode;

    private String errMessage;

    public AppBizException(int errCode, String message) {
        super(message);
        this.errCode = errCode;
        this.errMessage = message;
    }

    public AppBizException(ErrorCodeEnum err) {
        super(err.getMsg());
        this.errCode = err.getCode();
        this.errMessage = err.getMsg();
    }

    public AppBizException(ErrorCodeEnum err, Throwable cause) {
        super(err.getMsg(), cause);
        this.errCode = err.getCode();
        this.errMessage = err.getMsg();
    }


    public AppBizException(int errCode, String message, Throwable cause) {
        super(message, cause);
        this.errCode = errCode;
        this.errMessage = message;
    }

    @Override
    public String toString() {
        return "AppBizException{" +
                "errCode=" + errCode +
                ", errMessage='" + errMessage + '\'' +
                '}';
    }
}
