namespace java com.xiaohongshu.sns.angelosadmin.api.common

include "../base/base.thrift"

/**
* 分页-请求对象
**/
struct PageParam {
    /**
    * 页码
    **/
    1:optional i32 pageNo;
    /**
    * 分页大小
    **/
    2:optional i32 pageSize;
}

/**
* 分页-返回对象
**/
struct PageResp {
    /**
    * 当前页
    **/
    1:optional i32 currentPage;
    /**
    * 分页大小
    **/
    2:optional i32 pageSize;
    /**
    * 总页数
    **/
    3:optional i32 totalPages;
    /**
    * 总条数
    **/
    4:optional i32 totalCount;
}

/**
* 登录用户信息
**/
struct UserInfo {
    /**
    * 用户工作邮箱
    **/
    1:optional string userEmail;
    /**
    * 名称
    **/
    2:optional string name;
    /**
    * 显示名
    **/
    3:optional string displayName;
}

/**
* 基础响应
**/
struct BaseResponse {
    /**
    * 基础返回结果
    **/
    1: required base.Result result;
    /**
    * 基础分页返回结果
    **/
    2: optional PageResp pageResp;
}