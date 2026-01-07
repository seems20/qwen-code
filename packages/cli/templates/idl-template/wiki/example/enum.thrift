namespace java com.xiaohongshu.sns.angelosadmin.api.dto

/**
 * 客户端条件类型
 **/
enum ClientFilterType {
    HIT = 0,
    EXCLUDE = 1
}

/**
 * 客户端平台类型
 **/
enum ClientPlatformType {
    ANDROID_PHONE = 0,
    ANDROID_PAD = 1,
    IOS_PHONE = 2,
    IOS_PAD = 3,
    HARMONY_PHONE = 4,
    HARMONY_PAD = 5,
    WINDOWS_DESKTOP = 6,
    MAC_DESKTOP = 7,
    WEB = 8
}

/**
 * 字段类型
 **/
enum FieldType {
    STRING = 0,
    INTEGER = 1,
    LONG = 2,
    DOUBLE = 3,
    BOOLEAN = 4,
    LIST = 5,
    MAP = 6
}
