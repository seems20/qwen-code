package com.xiaohongshu.sns.demo.infrastructure.config.threadpool;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.xiaohongshu.infra.concurrent.PlatformExecutors;

@Configuration
public class ExecutorConfig {
    @Bean(name = "demoExecutor")
    public ExecutorService demoExecutor() {
        /**
        * 创建一个能够通过治理平台下发配置的线程池。
        * 该线程池和 MoreExecutors2.dynamicExecutorService 一样，能够确保上下文传递的过程中不会丢失。
        * 线程池名规范: 只包含小写字母和数字,否则无法做动态配置
        */
        return PlatformExecutors.dynamicExecutor("executor00", 32, 32, 4000, false,
                new ThreadPoolExecutor.CallerRunsPolicy());
    }

}
