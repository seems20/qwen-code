namespace java com.xiaohongshu.sns.demo.api.common

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
