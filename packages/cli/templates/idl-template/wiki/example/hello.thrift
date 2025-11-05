namespace java com.xiaohongshu.sns.rpc.hello

/*
   base.thrift 文件路径不要修改，打包过程会默认加入
   具体文件格式可以参看
   <groupId>com.xiaohongshu</groupId>
   <artifactId>thrift-rpc</artifactId>
 */
include "../base/base.thrift"

struct HelloRequest{

}

struct HelloResponse{

}

/*
    第一个参数约定传base.Context，请求打点使用。
    base.BaseService接口继承ping方法，健康检查使用
 */
service HelloService extends base.BaseService {

    HelloResponse sayHello(
        1: base.Context context
        2: HelloRequest request
    )
}