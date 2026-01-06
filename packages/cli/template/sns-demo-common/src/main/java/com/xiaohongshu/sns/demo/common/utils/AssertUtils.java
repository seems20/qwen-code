package com.xiaohongshu.sns.demo.common.utils;

import com.xiaohongshu.sns.demo.common.enums.ErrorCodeEnum;
import com.xiaohongshu.sns.demo.common.exception.AppBizException;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.MapUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.Collection;
import java.util.Map;
import java.util.function.Supplier;


/**
 * @author chenhuanjie
 */
public final class AssertUtils {
    private AssertUtils() {
        // 私有构造函数，防止实例化
    }

    /**
     * 断言为true
     *
     * @param condition
     * @param code
     * @param supplier
     */
    public static void isTrue(boolean condition, int code, Supplier<String> supplier) {
        if (!condition) {
            throw new AppBizException(code, supplier.get());
        }
    }

    public static void isTrue(boolean condition, ErrorCodeEnum error) {
        if (!condition) {
            throw new AppBizException(error.getCode(), error.getMsg());
        }
    }

    /**
     * 断言为false
     *
     * @param condition
     * @param code
     * @param supplier
     */
    public static void isFalse(boolean condition, int code, Supplier<String> supplier) {
        if (condition) {
            throw new AppBizException(code, supplier.get());
        }
    }

    public static void isFalse(boolean condition, ErrorCodeEnum error) {
        if (condition) {
            throw new AppBizException(error.getCode(), error.getMsg());
        }
    }

    /**
     * 断言为字符串非空
     *
     * @param s
     * @param code
     * @param supplier
     */
    public static void notBlank(String s, int code, Supplier<String> supplier) {
        if (StringUtils.isBlank(s)) {
            throw new AppBizException(code, supplier.get());
        }
    }

    public static void notBlank(String s, ErrorCodeEnum error) {
        if (StringUtils.isBlank(s)) {
            throw new AppBizException(error.getCode(), error.getMsg());
        }
    }


    /**
     * 断言为集合非空
     *
     * @param c
     * @param code
     * @param supplier
     */
    public static void notEmpty(Collection c, int code, Supplier<String> supplier) {
        if (CollectionUtils.isEmpty(c)) {
            throw new AppBizException(code, supplier.get());
        }
    }

    public static void notEmpty(Collection m, ErrorCodeEnum error) {
        if (CollectionUtils.isEmpty(m)) {
            throw new AppBizException(error.getCode(), error.getMsg());
        }
    }

    /**
     * 断言map非空
     *
     * @param m
     * @param code
     * @param supplier
     */
    public static void notEmpty(Map m, int code, Supplier<String> supplier) {
        if (MapUtils.isEmpty(m)) {
            throw new AppBizException(code, supplier.get());
        }
    }

    public static void notEmpty(Map m, ErrorCodeEnum error) {
        if (MapUtils.isEmpty(m)) {
            throw new AppBizException(error.getCode(), error.getMsg());
        }
    }


    /**
     * 断言为对象非空
     *
     * @param o
     * @param code
     * @param supplier
     */
    public static void notNull(Object o, int code, Supplier<String> supplier) {
        if (o == null) {
            throw new AppBizException(code, supplier.get());
        }
    }

    public static void notNull(Object o, ErrorCodeEnum error) {
        if (o == null) {
            throw new AppBizException(error.getCode(), error.getMsg());
        }
    }
}
