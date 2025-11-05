package com.xiaohongshu.sns.thrift.hello;


import com.xiaohongshu.infra.rpc.core.client.NettyClientProxyFactory;
import com.xiaohongshu.infra.rpc.core.registry.eds.MultiRegionsEdsThriftAddressSubscriberProvider;
import com.xiaohongshu.sns.rpc.hello.HelloService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

@Configuration
@ConditionalOnProperty(prefix = "rpc.hello", name = "service-name")
@ConditionalOnClass(HelloService.class)
@ConditionalOnBean(MultiRegionsEdsThriftAddressSubscriberProvider.class)
@EnableConfigurationProperties(com.xiaohongshu.sns.thrift.hello.HelloServiceProperties.class)
public class HelloServiceAutoConfiguration {

    private MultiRegionsEdsThriftAddressSubscriberProvider thriftServerMultiRegionEdsSubscriber;
    private com.xiaohongshu.sns.thrift.hello.HelloServiceProperties properties;

    public HelloServiceAutoConfiguration (MultiRegionsEdsThriftAddressSubscriberProvider thriftServerMultiRegionEdsSubscriber,
            com.xiaohongshu.sns.thrift.hello.HelloServiceProperties properties) {
        this.thriftServerMultiRegionEdsSubscriber = thriftServerMultiRegionEdsSubscriber;
        this.properties = properties;
    }

    @Lazy
    @Bean
    @ConditionalOnMissingBean(name = "helloClient")
    public NettyClientProxyFactory helloClient() {
        NettyClientProxyFactory factory = new NettyClientProxyFactory();
        factory.setServerAddressProvider(this.thriftServerMultiRegionEdsSubscriber);
        factory.setThriftClass(HelloService.class);
        factory.setServiceName(this.properties.getServiceName());
        factory.setRpcTimeout(this.properties.getRpcTimeout());
        factory.setConnectTimeout(this.properties.getConnectionTimeout());
        factory.setMethodConfigMap(this.properties.getMethodConfig());
        return factory;
    }

}
