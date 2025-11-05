package com.xiaohongshu.sns.demo.common.metrics;

import com.dianping.cat.Cat;

import java.util.concurrent.TimeUnit;

/**
 * 指标打点 Demo
 * <p>
 * 参考 <a href="https://xray-doc.devops.xiaohongshu.com/docs/metric/prometheus-integration-new.html">CAT 集成 Prometheus（新版）</a>
 */
public class DemoMetrics {

    /**
     * Counter 用于持续递增的度量值，如网站访问次数，API 调用次数/QPS，对于业务系统而言比如订单数等，常搭配 increase()、rate() 函数使用
     */
    public static void counter() {
        Cat.counter("collection_number_total", "收款总笔数")
                .addTag("channel", "channel_1")
                .addTag("status", "true")
                .increment(10);
    }


    /**
     * Gauge 用于记录指标原始值，侧重于反应系统当前的状态，这类指标的样本数据可增可减。如系统中的线程数、CPU 使用率、内存使用率等
     */
    public static void gauge() {
        Cat.gauge("paying_timeout", "付款超时")
                .addTag("channel", "channel_1")
                .addTag("status", "true")
                .setValue(1);
    }

    /**
     * Summary 用于记录样本数据的分布情况，如响应时间、RPC 调用耗时等
     * Summary 一般会生成三种指标：分位值快照、总量、次数，其中分位值快照用于 Prometheus 的分位值查询，总量和次数用于计算平均值。
     */
    public static void summary() {
        // 不带分位值统计
        Cat.summary("rpc_calls", "RPC调用详情")
                .addTag("endpoint", "endpoint_1")
                .addTag("success", "true")
                .record(15.0);

        // 带分位值统计
        Cat.summary("rpc_calls", "RPC调用详情")
                .addTag("endpoint", "endpoint_1")
                .addTag("success", "true")
                .publishPercentiles(0.95, 0.99)
                .record(15.0);

        // 默认分位值 95/99/999
        Cat.summary("rpc_calls", "RPC调用详情")
                .addTag("endpoint", "endpoint_1")
                .addTag("success", "true")
                .publishDefaultPercentiles()
                .record(15.0);
    }

    /**
     * 类似于 Summary，Timer 用于测量短时间内的持续时间，以及跟踪这些测量的频率。它通常用于测量如 HTTP 请求响应时间等操作的时间。
     * Timer 一般会生成四种指标：分位值快照、总量、次数、最大值，其中分位值快照用于 Prometheus 的分位值查询，总量和次数用于计算平均值。
     */
    public static void timer() throws InterruptedException {
        // 不带分位值统计
        Cat.timer("http_request_duration", "HTTP调用耗时")
                .addTag("endpoint", "endpoint_1")
                .record(300, TimeUnit.MILLISECONDS);

        // 带分位值统计
        Cat.timer("http_request_duration", "HTTP调用耗时")
                .addTag("endpoint", "endpoint_1")
                .publishPercentiles(0.95, 0.99)
                .record(300, TimeUnit.MILLISECONDS);

        // 默认分位值 95/99/999
        Cat.timer("http_request_duration", "HTTP调用耗时")
                .addTag("endpoint", "endpoint_1")
                .publishDefaultPercentiles()
                .record(300, TimeUnit.MILLISECONDS);
    }
}
