namespace java com.xiaohongshu.sns.angelosadmin.api.res

include "../base/base.thrift"
include "./dto.thrift"
include "./common.thrift"

/**
 * 创建模板响应
 */
struct CreateMessageTemplateResponse {
    /**
     * 基础响应
     **/
    1: required base.Result result,
    /**
     * 模板唯一key
     **/
    2: optional string templateKey
}

/**
 * 编辑模板响应
 */
struct UpdateMessageTemplateResponse {
    /**
     * 基础响应
     **/
    1: required base.Result result,
    /**
     * 模板唯一key
     **/
    2: optional string templateKey
}

/**
 * 分页查询模板列表响应
 */
struct QueryMessageTemplatesResponse {
    /**
     * 基础响应
     **/
    1: required base.Result result,
    /**
     * 模板列表
     **/
    2: optional list<dto.MessageDataTemplate> templates,
    /**
     * 分页信息
     **/
    3: optional common.PageResp pageResp
}

/**
 * 根据模板key和version获取模板详情响应
 */
struct GetMessageTemplateResponse {
    /**
     * 基础响应
     **/
    1: required base.Result result,
    /**
     * 模板详情
     **/
    2: optional dto.MessageDataTemplate template
}

struct GetRunnableStrategyResponse {
    1: required base.Result result
    2: optional string strategyListRawData;
    3: optional list<dto.BizFrequencyConfig>  frequencyConfig;
}

/**
 * 创建策略响应
 */
struct CreateMessageReachStrategyResponse {
    1: required base.Result result;
    /** 创建成功的策略ID */
    2: optional i32 strategyId;
}

/**
 * 更新策略响应
 */
struct UpdateMessageReachStrategyResponse {
    1: required base.Result result;
}

/**
 * 更新策略状态响应
 */
struct UpdateStrategyStatusResponse {
    1: required base.Result result;
}

/**
 * 查询策略响应
 */
struct QueryMessageReachStrategyResponse {
    1: required base.Result result;
    /** 策略列表 */
    2: optional list<dto.MessageReachStrategyVO> strategyList;
    /** 分页结果 */
    3: optional common.PageResp pageResp;
}


struct GetUpsertParamsFromStrategyVOResponse {
    1: required base.Result result;
    2: optional dto.UpsertMessageReachStrategyParam param
}