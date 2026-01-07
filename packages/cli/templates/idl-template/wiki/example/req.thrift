namespace java com.xiaohongshu.sns.angelosadmin.api.req

include "./dto.thrift"
include "./common.thrift"

/**
 * 创建模板请求
 */
struct CreateMessageTemplateRequest {
    /**
     * 模板唯一key
     **/
    1: optional string templateKey,
    /**
     * 模板名称
     **/
    2: optional string templateName,
    /**
     * 模板描述
     **/
    3: optional string templateDesc,
    /**
     * 模板内容
     **/
    4: optional string templateContent,
    /**
     * 模板内容类型
     **/
    5: optional i32 templateContentType,
    /**
     * 该消息的数据schema
     **/
    6: optional list<dto.FieldPropertiesInfo> schema
}

/**
 * 编辑模板请求
 */
struct UpdateMessageTemplateRequest {
    /**
     * 模板ID
     **/
    1: optional string templateKey,
    /**
     * 模板名称
     **/
    2: optional string templateName,
    /**
     * 模板描述
     **/
    3: optional string templateDesc,
    /**
     * 模板内容
     **/
    4: optional string templateContent,
    /**
     * 当前版本号
     **/
    5: optional i32 version,
    /**
     * 该消息的数据schema
     **/
    6: optional list<dto.FieldPropertiesInfo> schema,
    /**
     * 模板内容类型
     **/
    7: optional i32 templateContentType
}

/**
 * 分页查询模板列表请求
 */
struct QueryMessageTemplatesRequest {
    /**
     * 模板ID
     **/
    1: optional string templateKey,
    /**
     * 模板名称（模糊查询）
     **/
    2: optional string templateName,
    /**
     * 分页参数
     **/
    3: optional common.PageParam pageParam
}

/**
 * 根据模板key和version获取模板详情请求
 */
struct GetMessageTemplateRequest {
    /**
     * 模板唯一key
     **/
    1: optional string templateKey,
    /**
     * 模板版本
     **/
    2: optional i32 version
}

struct GetRunnableStrategyRequest {
    1: optional i32 snapshotVersion;
}

/**
 * 创建策略请求
 */
struct CreateMessageReachStrategyRequest {
    /** 策略信息 */
    1: required dto.UpsertMessageReachStrategyParam strategyParam;
}

/**
 * 更新策略请求
 */
struct UpdateMessageReachStrategyRequest {
    /** 策略信息 */
    1: required dto.UpsertMessageReachStrategyParam strategyParam;
}

/**
 * 更新策略状态请求
 */
struct UpdateStrategyStatusRequest {
    /** 策略ID */
    1: required i32 strategyId;
    /** 目标状态 (StrategyStatusEnum: DRAFT, ONLINE, DELETED) */
    2: required string targetStatus;
}

/**
 * 查询策略请求
 */
struct QueryMessageReachStrategyRequest {
    /** 策略ID列表 */
    1: optional list<i32> strategyIdList;
    /** 策略状态 */
    2: optional string status;
    /** 分页参数 */
    3: optional common.PageParam pageParam;
}


/**
 * 查询策略请求
 */
struct GetUpsertParamsFromStrategyVORequest {
    1: required dto.MessageReachStrategyVO vo
}