package com.xiaohongshu.sns.thrift.test;

import com.xiaohongshu.infra.rpc.core.registry.consul.ThriftServerAddressConsulManager;
import com.xiaohongshu.sns.rpc.hello.HelloService;
import com.xiaohongshu.sns.thrift.hello.HelloServiceAutoConfiguration;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.springframework.beans.factory.NoSuchBeanDefinitionException;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.mock.env.MockPropertySource;


public class AutoConfigureTest {

    private AnnotationConfigApplicationContext context;

    @Before
    public void setUp() {
        this.context = new AnnotationConfigApplicationContext();
        StandardEnvironment environment = new StandardEnvironment();
        MutablePropertySources propertySources = environment.getPropertySources();
        MockPropertySource propertySource = new MockPropertySource();
        propertySource.setProperty("rpc.hello.serviceName", "xxx");
        propertySources.addFirst(propertySource);
        context.setEnvironment(environment);
        context.register(ThriftServerAddressConsulManager.class);
        context.register(HelloServiceAutoConfiguration.class);
        context.refresh();
    }

    @After
    public void tearDown() {
        if (this.context != null) {
            this.context.close();
        }
    }

    @Test
    public void testBeanRegistration() {
        try {
            HelloService.Iface client = this.context.getBean("helloClient", HelloService.Iface.class);
            client.ping();
        } catch (NoSuchBeanDefinitionException e) {
            Assert.fail(e.getMessage());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
