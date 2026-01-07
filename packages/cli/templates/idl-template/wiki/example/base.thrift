namespace java com.xiaohongshu.infra.rpc.base

/**
* rpc context that contains:
* 1: open tracing infomation
* 2: userID for log coloring
* 3: an expandable map for custom loads
*/
struct Context {
    /**
    * open tracing trace id
    **/
    1: string traceID;
    /**
    * the caller's host (IP or hostname)
    **/
    2: string clientHost;
    /**
    * open tracing baggae, can be used to carry custom loads
    **/
    3: map<string, string> baggage;
    /**
    * open tracing span id
    **/
    4: string spanID;
    /**
    * whether the very request is sampled
    **/
    5: bool sampled;
    /**
    * open tracing parent span ID
    **/
    6: string parentSpanID;
    /**
    * userID for log coloring
    **/
    7: string userID;
    /**
    * appID for multi-app
    **/
    8: string appID;
    /**
    * projectID for multi-app
    **/
    9: string projectID;
    /**
    * app build number
    **/
    10: i32 appBuild;
    /**
    * app platform
    **/
    11: string appPlatform;
    /**
    * user ip address
    **/
    12: string userIP;
    /**
    * session locale
    **/
    13: string locale;
}

/**
* multi-app 枚举类型
**/
enum ProjectType {
    XHS = 0
    TOP = 1
}

/**
* common result
*/
struct Result {
    1: required bool success,
    2: optional i32 code,
    3: optional string message
}

/**
* typedefs
*/
typedef i64 Timestamp

/**
* the BaseService is defined for management purpose, such as check alive.
**/
service BaseService {
    /**
    * for checking alive
    **/
    void ping()
}
