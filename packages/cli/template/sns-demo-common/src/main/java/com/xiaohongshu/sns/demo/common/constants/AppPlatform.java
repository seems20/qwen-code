package com.xiaohongshu.sns.demo.common.constants;

import java.util.HashMap;
import java.util.Map;

/**
 * 客户端平台枚举
 *
 * @author RDMind
 */
public enum AppPlatform {

    /** IOS */
    IOS("ios"),

    /** Android */
    ANDROID("android"),

    /** 鸿蒙 */
    HARMONY("harmony"),

    /** Unknown */
    UNKNOWN("");

    private final String value;

    private static final Map<String, AppPlatform> VALUE_MAP = new HashMap<>();

    static {
        for (AppPlatform platform : AppPlatform.values()) {
            VALUE_MAP.put(platform.value(), platform);
        }
    }

    AppPlatform(String value) {
        this.value = value;
    }

    public String value() {
        return this.value;
    }

    public static boolean isIos(String platform) {
        return IOS.value.equalsIgnoreCase(platform);
    }

    public static boolean isAndroid(String platform) {
        return ANDROID.value.equalsIgnoreCase(platform);
    }

    public static AppPlatform findBy(String platform) {
        if (platform == null) {
            return UNKNOWN;
        }
        return VALUE_MAP.getOrDefault(platform.toLowerCase(), UNKNOWN);
    }
}
