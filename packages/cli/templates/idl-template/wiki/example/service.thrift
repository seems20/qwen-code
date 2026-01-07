namespace java com.xiaohongshu.sns.angelosadmin.api.service

include "../base/base.thrift"
include "./req.thrift"
include "./res.thrift"
include "./common.thrift"

/**
  *  第一个参数约定传base.Context，请求打点使用。
  * base.BaseService接口继承ping方法，健康检查使用
  *
  */
service MessageTemplateService extends base.BaseService {
    /*    ====================================    消息模板接口      ====================================      */
    /**
     * 创建消息模板
     **/
    res.CreateMessageTemplateResponse createMessageTemplate(
        1: required base.Context context;
        2: required req.CreateMessageTemplateRequest request;
    )
    /**
     * 编辑消息模板
     **/
    res.UpdateMessageTemplateResponse updateMessageTemplate(
        1: required base.Context context;
        2: required req.UpdateMessageTemplateRequest request;
    )
    /**
     * 分页查询模板列表
     **/
    res.QueryMessageTemplatesResponse queryMessageTemplates(
        1: required base.Context context;
        2: required req.QueryMessageTemplatesRequest request;
    )
    /**
     * 根据模板key和version获取模板详情
     **/
    res.GetMessageTemplateResponse getMessageTemplate(
        1: required base.Context context;
        2: required req.GetMessageTemplateRequest request;
    )

}

/**
 * 运行时策略服务
 */
service RuntimeStrategyService extends base.BaseService {
    /**
     * 获取可运行的策略
     */
    res.GetRunnableStrategyResponse getRunnableStrategy(
        1: required base.Context context;
        2: required req.GetRunnableStrategyRequest request;
    )
}

/**
 * 消息策略服务
 */
service MessageStrategyService extends base.BaseService {
    /* ---------------------------- 控制面 【start】 ---------------------------------      */

    /**
     * 创建策略
     */
    res.CreateMessageReachStrategyResponse createMessageReachStrategy(
        1: required base.Context context;
        2: required req.CreateMessageReachStrategyRequest request;
    )

    /**
     * 更新策略信息
     */
    res.UpdateMessageReachStrategyResponse updateMessageReachStrategy(
        1: required base.Context context;
        2: required req.UpdateMessageReachStrategyRequest request;
    )

    /**
     * 更新策略状态
     */
    res.UpdateStrategyStatusResponse updateStrategyStatus(
        1: required base.Context context;
        2: required req.UpdateStrategyStatusRequest request;
    )

    /**
     * 查询策略
     */
    res.QueryMessageReachStrategyResponse queryMessageReachStrategy(
        1: required base.Context context;
        2: required req.QueryMessageReachStrategyRequest request;
    )


    res.GetUpsertParamsFromStrategyVOResponse getUpsertParamsFromStrategyVO(
        1: required base.Context context;
        2: required req.GetUpsertParamsFromStrategyVORequest request;
    )

    /* ---------------------------- 控制面-策略模块 【end】 ----------------------------      */
}



