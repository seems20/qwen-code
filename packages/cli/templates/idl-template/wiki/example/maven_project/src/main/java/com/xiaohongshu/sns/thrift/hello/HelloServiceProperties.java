package com.xiaohongshu.sns.thrift.hello;

import com.xiaohongshu.infra.rpc.core.ThriftMethodConfig;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

@Data
@ConfigurationProperties("rpc.hello")
public class HelloServiceProperties {

    private String serviceName;
    private Integer rpcTimeout = 1000;
    private Integer connectionTimeout = 100;
    private Map<String, ThriftMethodConfig> methodConfig;

}
