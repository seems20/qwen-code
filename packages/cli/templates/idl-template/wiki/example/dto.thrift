namespace java com.xiaohongshu.sns.demo.api.dto

include "enum.thrift"

/**
 * 客户端版本条件限制
 **/
struct ClientVersionFilter {
    /**
     * 客户端平台
     **/
    1: required enum.ClientPlatformType platform;
    /**
     * 适用的最低版本
     **/
    2: optional string minVer;
    /**
     * 适用的最高版本
     **/
    3: optional string maxVer;
}

/**
 * 实验过滤
 **/
struct RacingFilter {
    /**
     * 实验标识
     **/
    1: optional string flag;
    /**
     * 实验值
     **/
    2: optional i64 value;
}

/**
 * 触达的客户端资源位
 */
struct ResourceInfo {
    /** 全局唯一的 key  */
    1: string resourceKey;
    /** name */
    2: string resourceName;
    /** 描述 */
    3: string resourceDesc;
    /** 所属页面 */
    4: string pageInstance
}

/**
 * 客户端版本条件限制
 */
struct ClientCondition {
    /** 客户端平台 (iOS, Android 等) */
    2: string platform;
    /** 适用的最低版本, 例如 9.13.1 */
    3: string minVer;
    /** 适用的最高版本, 例如 9.14.1 */
    4: string maxVer;
}

/**
 * 触达渠道配置
 */
struct SimpleReachChannelInfo {
    /** 数字越小，优先级约高 */
    1: required i32 priority;
    /** 触达的渠道 (ReachChannelEnum: none, longlink_push, http, offsite_push, sms) */
    2: required string channel;
    /** 该渠道的消息数据模版 */
    3: required string templateKey;
    4: required i32 templateVersion;
    // 渠道能否下发数据的条件判断
    5: optional FilterInfo filter;
    // 渠道的频控
    6: optional MessageFrequencyRule frequencyRule;

}

struct EnrichReachChannelInfo {
    /** 数字越小，优先级约高 */
    1: required i32 priority;
    /** 触达的渠道 (ReachChannelEnum: none, longlink_push, http, offsite_push, sms) */
    2: required string channel;
    /** 该渠道的消息数据模版 */
    3: optional MessageDataTemplate messageTemplate;
    // 渠道能否下发数据的条件判断
    4: optional FilterInfo filter;
    // 渠道的频控
    5: optional MessageFrequencyRule frequencyRule;
}

struct MessageFrequencyRule{
    // 自定义频控策略
    1: optional list<CustomFrequencyRule> customRules;
}

struct CustomFrequencyRule{
    1: required list<string> fieldKeys;
    2: required i32 ttlInSeconds
    3: required i32 totalLimit;
}

/**
 * 渠道调度策略
 * 定义消息在多渠道间的流转规则及优先级
 */
struct SimpleReachChannelRule {
    /** 渠道调度模式 */
    1: required string channelTriggerType;
    /** 按照优先级排列的渠道列表 */
    2: required list<SimpleReachChannelInfo> reachChannelInfos;
    /** 消息消失类型 */
    3: required i32 messageDisappearType
}

struct EnrichReachChannelRule {
    /** 渠道调度模式 (ChannelScheduleModeEnum: SINGLE_CONTINUE, SINGLE_BLOCK, ALL) */
    1: required string channelTriggerType;
    /** 按照优先级排列的渠道列表 */
    2: required list<EnrichReachChannelInfo> reachChannelInfos;
    /** 消息消失类型 */
    3: required i32 messageDisappearType
}

/**
 * 缓存配置详情
 */
struct MessageCacheConfig {
    /** 是否启用 */
    1: bool enabled;
    /** 过期时间(秒) */
    2: i64 ttlSeconds;
}

/**
 * 消息持久化策略
 */
struct MessageCacheRule {
    /** 服务端缓存配置 */
    1: MessageCacheConfig server;
    /** 客户端缓存配置 */
    2: MessageCacheConfig client;
}


/**
 * 消息触达策略（for 前端控制面使用）
 */
struct UpsertMessageReachStrategyParam {
    // ------------------------ 1、基础字段 -----------------------
    1: optional i32 id;
    /** 触达策略名称 */
    2: required string name;
    /** 策略描述 */
    3: optional string description;
    /** 业务方 */
    4: required string bizKey;

    // ----------------------- 2、触达的客户端资源位 -------------------
    /** 触达的客户端资源位 */
    5:  required string resourceKey;

    // ----------------------- 3、触达渠道以及下发消息格式 --------------
    /** 渠道调度策略 */
    6: required SimpleReachChannelRule channelRule;

    /** 消息持久化策略 */
    7: required MessageCacheRule cacheRule;

    /** 是否客户端冷启动加载 */
    8: optional bool coolStartLoad;
    // ----------------------- 4、其他的一些配置  -----------------------
    /** 其他扩展配置 */
    9: string extra;
}

/**
 * 消息触达策略（for 前端控制面使用）
 */
struct MessageReachStrategyVO {
    // ------------------------ 1、基础字段 -----------------------
    1: required i32 id;
    /** 触达策略名称 */
    2: required string name;
    /** 策略描述 */
    3: optional string description;
    /** 业务方 */
    4: required string bizKey;
    /** 策略状态 (StrategyStatusEnum: DRAFT, ONLINE, DELETED) */
    5: required string status;
    /** 创建时间 */
    6: optional string createTime;
    /** 更新时间 */
    7: optional string updateTime;

    // ----------------------- 2、触达的客户端资源位 -------------------
    /** 触达的客户端资源位 */
    8:  required ResourceInfo resource;

    // ----------------------- 3、触达渠道以及下发消息格式 --------------
    /** 渠道调度策略 */
    9: required EnrichReachChannelRule channelRule;

    /** 消息持久化策略 */
    10: required MessageCacheRule cacheRule;

    /** 是否客户端冷启动加载 */
    11: optional bool coolStartLoad;

    // ----------------------- 4、其他的一些配置  -----------------------
    /** 其他扩展配置 */
    12: string extra;

    13: string createUser;
    14: string updateUser;
}


/**
 * 资源频次配置
 */
struct ResourceFrequency {
    /** 客户端资源位key, 例如: searchResult_gloablWindow */
    1: string resourceKey;
    /** 每日最大发送次数限制 */
    2: i32 dailyMaxCnt;
}

/**
 * 频次配置详情
 */
struct FrequencyConfig {
    /** 一个用户最多每天收到该业务的通知数 */
    1: i32 dailyMaxCnt;
    /** 该业务使用 resource 每天给用户发送的数量限制 */
    2: list<ResourceFrequency> resourceFrequency;
}

/**
 * 业务频次配置
 */
struct BizFrequencyConfig {
    /** 业务名, 例如: search */
    1: string bizName;
    /** 频次配置 */
    2: FrequencyConfig frequencyConfig;
}

/**
 * 客户端过滤信息
 **/
struct FilterInfo {
    /**
     * 版本过滤器列表
     **/
    1: optional list<ClientVersionFilter> versionFilters;
    /**
     * 实验过滤器
     **/
    2: optional RacingFilter racingFilter;
}

/**
 * 字段属性信息
 **/
struct FieldPropertiesInfo {
    /**
     * 字段名称
     **/
    1: optional string fieldKey;
    /**
     * 字段类型
     **/
    2: optional enum.FieldType fieldType;
    /**
     * 字段描述
     **/
    3: optional string fieldDesc;
    /**
     * 字段默认值, 可选
     **/
    4: optional string fieldDefaultValue;
    /**
     * 是否必填
     **/
    5: optional bool isRequired;
}

/**
 * 消息数据模板
 **/
struct MessageDataTemplate {
    /**
     * 模板唯一key
     **/
    1: optional string templateKey;
    /**
     * 模板名称
     **/
    2: optional string templateName;
    /**
     * 模板描述
     **/
    3: optional string templateDesc;
    /**
     * 该消息的数据schema
     **/
    4: optional list<FieldPropertiesInfo> schema;
    /**
     * 变更版本号
     **/
    5: optional i32 version;
    /**
     * 创建人
     **/
    6: optional string creator;
    /**
     * 更新时间
     **/
    7: optional i64 updateTime;
    /**
     * 模板内容
     **/
    8: optional string templateContent;
    /**
     * 模板内容类型
     **/
    9: optional i32 templateContentType;
}
