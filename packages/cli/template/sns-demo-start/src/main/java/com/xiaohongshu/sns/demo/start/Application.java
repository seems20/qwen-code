package com.xiaohongshu.sns.demo.start;

import com.ctrip.framework.apollo.spring.annotation.EnableApolloConfig;
import com.xiaohongshu.infra.rpc.annotation.EnableRedRPC;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

@SpringBootApplication(
        scanBasePackages = {"com.xiaohongshu.infra", "com.xiaohongshu.sns"}
)
@EnableApolloConfig
@EnableAspectJAutoProxy
@EnableRedRPC(scanBasePackages = {"com.xiaohongshu.sns"})
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
