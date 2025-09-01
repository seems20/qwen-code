/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
  type SlashCommandActionReturn,
} from './types.js';
import { MessageType } from '../types.js';

/**
 * 解析 import 命令参数
 */
function parseImportArgs(args: string): {
  middleware: string;
  projectName?: string;
} | null {
  const trimmedArgs = args.trim();
  const parts = trimmedArgs.split(/\s+/);

  if (parts.length === 1 && parts[0]) {
    // /import MySQL
    return {
      middleware: parts[0].toLowerCase(),
    };
  } else if (parts.length === 2) {
    // /import MySQL 项目名
    return {
      middleware: parts[0].toLowerCase(),
      projectName: parts[1],
    };
  }

  return null;
}

/**
 * 处理 MySQL 导入逻辑
 */
async function handleMySQLImport(
  context: CommandContext,
  projectName?: string,
): Promise<SlashCommandActionReturn | void> {
  const workspaceRoot = process.cwd();

  // 检查是否提供了项目名（生成配置类需要项目名）
  if (!projectName) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 请提供项目名称。\n\n使用格式：/import mysql <项目名>\n例如：/import mysql sns-demo`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `RDMind正在接入MySQL...`,
    },
    Date.now(),
  );

  // 生成简化的 MySQL 接入提示词，让大模型自己管理整个流程
  const prompt = generateSimpleMySQLSetupPrompt(workspaceRoot, projectName);

  return {
    type: 'submit_prompt',
    content: prompt,
  };
}

/**
 * 处理 Redis 导入逻辑
 */
async function handleRedisImport(
  context: CommandContext,
): Promise<SlashCommandActionReturn | void> {
  const workspaceRoot = process.cwd();

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `RDMind正在接入Redis...`,
    },
    Date.now(),
  );

  // 生成完整的 Redis 接入提示词，让大模型处理所有步骤
  const prompt = generateCompleteRedisSetupPrompt(workspaceRoot);

  return {
    type: 'submit_prompt',
    content: prompt,
  };
}

/**
 * 生成简化的 Apollo 接入提示词
 */
function generateSimpleApolloSetupPrompt(appId: string): string {
  return `请为Java项目完成 Apollo 接入配置，AppId："${appId}"。这是一个简单的配置文件更新任务，请创建todo列表来跟踪进度。

**优化执行策略：**

**第一步：查找 app.properties 文件**
使用 file_search 工具查找 app.properties 文件：
参数：pattern="**/app.properties"

**第二步：更新 app.properties 文件**
1. 使用 read_file 工具读取文件内容
2. 查找文件中的 "app.id=sample" 行或类似的 app.id 配置
3. 将现有的 app.id 值替换为 "${appId}"
4. 使用 edit_file 工具更新文件内容（保持文件中的所有其他内容不变）

**严格执行约束：**
- 只能修改 app.id 的值，其他内容必须保持原样
- 如果找不到 app.properties 文件，立即报告错误并停止
- 如果文件中没有 app.id 配置，添加 app.id=${appId} 到文件末尾
- 使用 edit_file 而不是 write_file 来确保更精确的修改

**成功完成后告知用户：**
✅ Apollo 接入配置已完成！
📖 文档链接：https://docs.xiaohongshu.com/doc/98113484a8a9c92cbcfeddc10a310312

**错误处理：**
- 找不到 app.properties 文件：提示用户确保项目中存在该文件
- 文件读取失败：报告具体的错误信息`;
}

/**
 * 生成优化的 MySQL 接入提示词
 */
function generateSimpleMySQLSetupPrompt(
  workspaceRoot: string,
  projectName: string,
): string {
  return `请为Java项目 "${projectName}" 完成 MySQL 接入配置。这是一个需要系统化执行的多步骤任务，请创建todo列表来跟踪进度。

**项目工作目录：** ${workspaceRoot}
**项目名称：** ${projectName}

**优化执行策略：**

**第一步：项目结构探测（严格按此执行）**
1. 使用 list_directory 工具，参数：path="${workspaceRoot}" 
2. 从返回的目录列表中找到包含 "infrastructure" 或 "infra" 的目录名
3. 使用 read_file 读取该目录下的 pom.xml，确认是模块文件
4. 使用 list_directory 列出该目录下的 src/main/java 路径，找到包结构

**第二步：检查 infra-root-pom 依赖**
1. 使用 read_file 读取工作区根目录的 pom.xml
2. 检查是否包含 <artifactId>infra-root-pom</artifactId> 依赖
3. 如果缺少 infra-root-pom，立即提示用户并终止

**第三步：目录创建（必须完成两个目录）**
基于已确定的 infrastructure Java包路径，必须创建以下两个目录：
1. {infrastructure包路径}/config/mysql - 用于配置类
2. {infrastructure包路径}/mysql/mapper - 用于Mapper接口
使用 run_terminal_cmd 工具，命令格式：mkdir -p {完整路径}

**第四步：检查配置类文件是否存在**
根据项目名 "${projectName}" 生成配置类文件名。
转换规则：将 kebab-case 转为 CamelCase（如 sns-demo → SnsDemo）
配置类文件路径：{infrastructure包路径}/config/mysql/{CamelCaseProjectName}DataSourceConfig.java
使用 file_search 工具检查文件是否已存在，pattern="**/{CamelCaseProjectName}DataSourceConfig.java"
如果找到文件，提示用户使用不同项目名

**第五步：MySQL依赖检查和添加**
1. 使用 read_file 读取 infrastructure 模块的 pom.xml
2. 检查是否已存在以下MySQL依赖：
   - com.xiaohongshu.redsql:redsql-spring-boot-starter
   - org.mybatis:mybatis  
   - org.mybatis:mybatis-spring
3. 如果缺少任何依赖，使用 edit_file 在 </dependencies> 标签前添加缺失的依赖（严格按此格式）：
\`\`\`xml
        <!-- mysql -->
        <dependency>
            <groupId>com.xiaohongshu.redsql</groupId>
            <artifactId>redsql-spring-boot-starter</artifactId>
        </dependency>
        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis</artifactId>
        </dependency>
        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis-spring</artifactId>
        </dependency>
\`\`\`
4. 如果所有依赖都已存在，跳过添加步骤

**第六步：生成数据源配置类（严格使用此模板）**
使用 edit_file 创建配置类文件，内容必须严格按照以下模板（替换占位符）：

文件路径：{infrastructure包路径}/config/mysql/{CamelCaseProjectName}DataSourceConfig.java

文件内容（**必须完全按照此模板，只替换占位符**）：
\`\`\`java
package {实际包路径}.config.mysql;

import javax.sql.DataSource;

import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;

import com.xiaohongshu.redsql.group.jdbc.GroupDataSource;

@Configuration
@MapperScan(basePackages = "{实际包路径}.mysql.mapper",
        sqlSessionFactoryRef = "{camelCaseProjectName}SqlSessionFactory")
public class {CamelCaseProjectName}DataSourceConfig {

    @Bean(name = "{camelCaseProjectName}Datasource", initMethod = "init")
    @ConfigurationProperties(prefix = "spring.datasource.{projectName}")
    public GroupDataSource {camelCaseProjectName}Datasource() {
        return DataSourceBuilder.create().type(GroupDataSource.class).build();
    }

    @Bean(name = "{camelCaseProjectName}SqlSessionFactory")
    public SqlSessionFactory {camelCaseProjectName}SqlSessionFactory(@Qualifier("{camelCaseProjectName}Datasource") DataSource datasource)
            throws Exception {
        SqlSessionFactoryBean sqlSessionFactoryBean = new SqlSessionFactoryBean();
        sqlSessionFactoryBean.setDataSource(datasource);
        sqlSessionFactoryBean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/*.xml"));
        return sqlSessionFactoryBean.getObject();
    }

    @Bean(name="{camelCaseProjectName}JdbcTemplate")
    public JdbcTemplate jdbcTemplate(@Qualifier("{camelCaseProjectName}Datasource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
}
\`\`\`

**第七步：更新 application-sit.yml 配置文件**
1. 使用 file_search 查找 "**/application-sit.yml" 文件
2. 使用 read_file 读取文件内容  
3. 使用 edit_file 在文件末尾添加以下内容（严格按此格式）：
\`\`\`yaml

spring:
  datasource:
    ${projectName}:
      url: # TODO: 请填写数据库连接标识符
\`\`\`

**严格执行约束：**
- 禁止使用多次 list_directory 或重复的文件查找操作
- 第一步必须只使用一次 list_directory，参数：path="${workspaceRoot}"
- 第三步必须同时创建两个目录：config/mysql 和 mysql/mapper  
- 第四步使用 file_search 检查文件存在性，不要使用 read_file（会报错）
- 配置类和YAML配置必须严格按照提供的模板，禁止修改格式
- 依赖标签中严禁添加 version 元素
- 每一步只允许使用指定的工具，不得偏离
- 如果某步骤失败，立即报告错误并停止执行

**成功完成后告知用户：**
✅ MySQL 接入配置已完成！请参考接入文档进行标识符申请：
📖 文档链接：https://docs.xiaohongshu.com/doc/920c445ca92ebe2a964655e0ef3ec6ac

**错误处理：**
- 找不到 infrastructure 模块：提示用户确保项目存在相应模块
- 缺少 infra-root-pom：提示先接入 infra-root-pom
- 配置类已存在：提示使用不同项目名`;
}

/**
 * 生成简化的 RocketMQ 接入提示词
 */
function generateSimpleRocketMqSetupPrompt(workspaceRoot: string): string {
  return `请为Java项目完成 RocketMQ 接入配置。这是一个需要系统化执行的多步骤任务，请创建todo列表来跟踪进度。

**项目工作目录：** ${workspaceRoot}

**优化执行策略：**

**第一步：项目结构探测（一次性完成）**
使用 list_directory 工具列出工作区根目录，寻找：
- 包含 "domain" 的目录（用于添加依赖）
- 包含 "infrastructure" 或 "infra" 的目录（用于创建配置类）
- 对应的包结构目录

**第二步：检查 infra-root-pom 依赖**
1. 使用 read_file 读取工作区根目录的 pom.xml
2. 检查是否包含 <artifactId>infra-root-pom</artifactId> 依赖
3. 如果缺少，立即提示用户并终止

**第三步：events-client 依赖检查和添加**
1. 使用 read_file 读取 domain 模块的 pom.xml
2. 检查是否已存在 com.xiaohongshu:events-client 依赖
3. 如果缺少，使用 edit_file 在 </dependencies> 标签前添加：
\`\`\`xml
        <dependency>
            <groupId>com.xiaohongshu</groupId>
            <artifactId>events-client</artifactId>
        </dependency>
\`\`\`

**第四步：创建目录结构**
在 infrastructure Java包路径下创建以下目录：
1. config/mq - 用于配置类
2. events - 用于事件处理类（在domain包下）
使用 run_terminal_cmd，命令：mkdir -p {完整路径}

**第五步：生成配置类文件（使用以下固定模板）**
根据实际的包路径，创建以下配置类文件（严格按照模板，只替换包名）：

**1. RocketMqProducerConfig.java** - 配置类目录
\`\`\`java
package {实际包路径}.config.mq;

import com.xiaohongshu.events.client.producer.EventsProducer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RocketMqProducerConfig {

    @Bean
    public EventsProducer eventsProducer() {
        EventsProducer eventsProducer = new EventsProducer();
        eventsProducer.setEnableXrayTrace(true);
        eventsProducer.start();
        return eventsProducer;
    }
}
\`\`\`

**2. WrapperMqProducer.java** - 配置类目录
\`\`\`java
package {实际包路径}.config.mq;

import com.xiaohongshu.events.client.DelayMessage;
import com.xiaohongshu.events.client.Message;
import com.xiaohongshu.events.client.producer.EventsProducer;
import com.xiaohongshu.events.client.producer.SendResult;
import com.xiaohongshu.events.client.producer.SendStatus;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;

@Component
@Slf4j
public class WrapperMqProducer {

    @Resource
    private EventsProducer eventsProducer;

    public boolean send(String topic, String tag, String key, byte[] body) {
        if (StringUtils.isEmpty(topic)) {
            log.error("sendMq topic is null, topic:{}, tag:{}, body:{}", topic, tag, new String(body));
            return false;
        }

        if (StringUtils.isEmpty(tag)) {
            log.error("sendMq tag is null, topic:{}, tag:{}, body:{}", topic, tag, new String(body));
            return false;
        }

        try {
            Message message = new Message();
            message.setTopic(topic);
            message.setTags(tag);
            message.setKey(key);
            message.setBody(body);
            SendResult sendResult = eventsProducer.send(message);
            if (sendResult == null) {
                log.error("sendMq result is null, topic:{}, tag:{}, body:{}", topic, tag, new String(body));
                return false;
            }

            if (sendResult.getSendStatus() != SendStatus.SUCCESS) {
                log.error("sendMq failed, topic:{}, tag:{}, body:{}", topic, tag, new String(body));
                return false;
            }
            log.info("sendMq success, topic:{}, tag:{}, key:{}, outputMqId:{}", topic, tag, key, sendResult.getMsgId());
            return true;
        } catch (Exception e) {
            log.error("send mq error", e);
        }
        return false;
    }

    public boolean sendDelay(String topic, String tag, String key, byte[] body, long delayTime) {
        if (StringUtils.isEmpty(topic)) {
            log.error("sendMq topic is null, topic:{}, tag:{}, body:{}", topic, tag, new String(body));
            return false;
        }

        if (StringUtils.isEmpty(tag)) {
            log.error("sendMq tag is null, topic:{}, tag:{}, body:{}", topic, tag, new String(body));
            return false;
        }

        try {
            DelayMessage message = new DelayMessage();
            message.setTopic(topic);
            message.setTags(tag);
            message.setKey(key);
            message.setBody(body);
            //消息投递时间：秒级单位
            message.setDeliverTime(delayTime / 1000);
            SendResult sendResult = eventsProducer.sendDelay(message);
            if (sendResult == null) {
                log.error("sendDelay result is null, topic:{}, tag:{}, body:{}", topic, tag, new String(body));
                return false;
            }

            if (sendResult.getSendStatus() != SendStatus.SUCCESS) {
                log.error("sendDelay failed, topic:{}, tag:{}, body:{}", topic, tag, new String(body));
                return false;
            }
            log.info("sendDelay success, topic:{}, tag:{}, key:{}, outputMqId:{}", topic, tag, key, sendResult.getMsgId());
            return true;
        } catch (Exception e) {
            log.error("sendDelay mq error", e);
        }
        return false;
    }
}
\`\`\`

**3. MessageLifecycleListener.java** - 配置类目录
\`\`\`java
package {实际包路径}.config.mq;

import com.xiaohongshu.events.client.consumer.AbstractConsumer;
import com.xiaohongshu.events.client.producer.AbstractProducer;
import com.xiaohongshu.events.common.life.LifeCycleException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeansException;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.context.SmartLifecycle;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 用于控制消息生产者和消费者的启动和关闭，避免实例在依赖未启动完成前进行生产或消费
 */
@Slf4j
public class MessageLifecycleListener implements SmartLifecycle, ApplicationContextAware {

    private final AtomicBoolean started = new AtomicBoolean(false);

    private ApplicationContext applicationContext;

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        this.applicationContext = applicationContext;
    }

    @Override
    public void start() {
        if (started.compareAndSet(false, true)) {
            startup();
        }
    }

    @Override
    public void stop() {
        if (started.compareAndSet(true, false)) {
            shutdown();
        }
    }

    @Override
    public boolean isRunning() {
        return started.get();
    }

    private void startup() {
        log.info("开始启动消息生产者和消费者");
        // 启动消费者
        applicationContext.getBeansOfType(AbstractConsumer.class)
                .values()
                .stream()
                .forEach(this::startConsumer);

        // 启动生产者
        applicationContext.getBeansOfType(AbstractProducer.class)
                .values()
                .stream()
                .forEach(this::startProducer);
    }

    private void shutdown() {
        log.info("开始关闭消息生产者和消费者");
        if (Objects.isNull(applicationContext)) {
            return;
        }

        // 关闭生产者
        applicationContext.getBeansOfType(AbstractProducer.class)
                .values()
                .stream()
                .forEach(this::shutdownProducer);

        // 关闭消费者
        applicationContext.getBeansOfType(AbstractConsumer.class)
                .values()
                .stream()
                .forEach(this::shutdownConsumer);
    }

    private void startConsumer(AbstractConsumer consumer) {
        try {
            if (!consumer.isStarted()) {
                consumer.start();
            }
        } catch (LifeCycleException e) {
            log.error("启动消费者 topic: {}, group: {} 失败: {}", consumer.getTopic(), consumer.getGroup(), e.getMessage(), e);
        }
    }

    private void startProducer(AbstractProducer producer) {
        try {
            if (!producer.isStarted()) {
                producer.start();
            }
        } catch (LifeCycleException e) {
            log.error("启动生产者: [{}] 失败: {}", producer.getTopics(), e.getMessage(), e);
        }
    }

    private void shutdownConsumer(AbstractConsumer consumer) {
        try {
            if (consumer.isStarted()) {
                consumer.shutdown();
            }
        } catch (LifeCycleException e) {
            log.error("关闭消费者 topic: {}, group: {} 失败: {}", consumer.getTopic(), consumer.getGroup(), e.getMessage(), e);
        }
    }

    private void shutdownProducer(AbstractProducer producer) {
        try {
            if (producer.isStarted()) {
                producer.shutdown();
            }
        } catch (LifeCycleException e) {
            log.error("关闭生产者: [{}] 失败: {}", producer.getTopics(), e.getMessage(), e);
        }
    }
}
\`\`\`

**4. RocketMqConsumerConfig.java** - 配置类目录
\`\`\`java
package {实际包路径}.config.mq;

import com.xiaohongshu.events.client.consumer.EventsPushConsumer;
import {domain包路径}.events.MqProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.Resource;

@Configuration
public class RocketMqConsumerConfig {

    @Resource
    private MqProcessor mqProcessor;

    @Bean
    public MessageLifecycleListener eventOrderConfiguration() {
        return new MessageLifecycleListener();
    }

    @Bean
    public EventsPushConsumer mqConsumer() {
        EventsPushConsumer consumer = new EventsPushConsumer();
        consumer.setTopic("");
        consumer.setGroup("");
        consumer.setEnableXrayTrace(true);
        consumer.setMessageProcessor(mqProcessor);
        return consumer;
    }
}
\`\`\`

**5. MqProcessor.java** - domain/events目录
\`\`\`java
package {domain包路径}.events;

import com.xiaohongshu.events.client.MessageExt;
import com.xiaohongshu.events.client.api.MessageProcessor;
import com.xiaohongshu.events.client.consumer.ConsumeContext;
import com.xiaohongshu.events.client.consumer.ConsumeStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class MqProcessor implements MessageProcessor {
    @Override
    public ConsumeStatus process(MessageExt messageExt, ConsumeContext consumeContext) {
        return null;
    }
}
\`\`\`

**严格执行约束：**
- 禁止使用多次 list_directory 调用
- 配置类必须严格按照上述模板，只替换包名占位符，不得修改代码内容
- 严禁在依赖中添加 version 标签
- 如果某步骤失败，立即报告错误并停止

**成功完成后告知用户：**
✅ RocketMQ 接入配置已完成！包含生产者、消费者、消息处理器和生命周期管理器等完整配置。
📖 更详细的使用说明请参考：https://docs.xiaohongshu.com/doc/adc99c5ec0214993aed7771f866ecd58

**错误处理：**
- 找不到 domain 或 infrastructure 模块：提示用户确保项目存在相应模块
- 缺少 infra-root-pom：提示先接入 infra-root-pom`;
}

/**
 * 生成完整的 Redis 接入提示词
 */
function generateCompleteRedisSetupPrompt(workspaceRoot: string): string {
  return `请为Java项目完成 Redis 接入配置。这是一个需要系统化执行的多步骤任务，请创建todo列表来跟踪进度。

**项目工作目录：** ${workspaceRoot}

**完整任务流程：**

1. **查找 infrastructure 模块的 pom.xml 文件**
   - 在工作区根目录下查找包含 "infrastructure" 或 "infra" 的子目录
   - 验证该目录下是否存在 pom.xml 文件
   - 确认是模块 pom（包含 <parent> 和 <dependencies>）

2. **检查顶层 pom.xml 中的 infra-root-pom 依赖**
   - 读取工作区根目录的 pom.xml 文件
   - 检查是否包含 <artifactId>infra-root-pom</artifactId> 依赖
   - 如果不存在，提示用户先接入 infra-root-pom

3. **检查模块 pom.xml 中的 Redis 相关依赖**
   - 读取 infrastructure 模块的 pom.xml 内容
   - 检查是否已存在 groupId: com.xiaohongshu.infra.midware, artifactId: redis-spring 的依赖
   - 如果已存在，直接完成并告知用户

4. **添加 Redis 依赖到 infrastructure 模块**
   - 在 infrastructure 模块的 pom.xml 文件中添加 Redis 依赖
   - 在 </dependencies> 标签正上方添加以下内容：
   
   \`\`\`xml
   <!-- Spring 环境通过连接符接入引入redis-spring -->
   <dependency>
       <groupId>com.xiaohongshu.infra.midware</groupId>
       <artifactId>redis-spring</artifactId>
   </dependency>
   \`\`\`

**重要说明：**
- 使用 file_search 或 list_dir 工具查找文件和目录
- 使用 read_file 工具读取文件内容
- 使用 edit_file 工具编辑 pom.xml 文件
- 保持正确的XML缩进，严禁添加version标签
- 如果任何步骤失败，提供清晰的错误信息和解决建议

**成功完成后告知用户：**
✅ Redis 接入配置已完成！请参考接入文档进行标识符申请：
📖 文档链接：https://docs.xiaohongshu.com/doc/5ff2d7dadba283a5fb6e7bd6c6e53001

**错误情况处理：**
- 如果找不到 infrastructure 模块：提示用户确保项目中存在相应模块目录
- 如果没有 infra-root-pom 依赖：提示用户先接入 infra-root-pom
- 如果 Redis 依赖已存在：告知用户无需重复添加`;
}

/**
 * 处理 Apollo 导入逻辑
 */
async function handleApolloImport(
  context: CommandContext,
  appId?: string,
): Promise<SlashCommandActionReturn | void> {
  if (!appId) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 请提供 AppId 参数\n\n使用格式：/import apollo <appid>\n\n示例：/import apollo my-app-id`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    { type: MessageType.INFO, text: `RDMind正在接入Apollo...` },
    Date.now(),
  );

  // 生成简化的 Apollo 接入提示词
  const prompt = generateSimpleApolloSetupPrompt(appId);

  return {
    type: 'submit_prompt',
    content: prompt,
  };
}

/**
 * 处理 RocketMQ 导入逻辑
 */
async function handleRocketMqImport(
  context: CommandContext,
): Promise<SlashCommandActionReturn | void> {
  const workspaceRoot = process.cwd();

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `RDMind正在接入RocketMQ...`,
    },
    Date.now(),
  );

  // 生成简化的 RocketMQ 接入提示词
  const prompt = generateSimpleRocketMqSetupPrompt(workspaceRoot);

  return {
    type: 'submit_prompt',
    content: prompt,
  };
}

/**
 * MySQL 子命令
 */
const mysqlCommand: SlashCommand = {
  name: 'mysql',
  description: '为Java项目接入MySQL中间件',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const projectName = args.trim() || undefined;
    return await handleMySQLImport(context, projectName);
  },
};

/**
 * Apollo 子命令
 */
const apolloCommand: SlashCommand = {
  name: 'apollo',
  description: '为Java项目接入Apollo配置中心',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const appId = args.trim() || undefined;
    return await handleApolloImport(context, appId);
  },
};

/**
 * Redis 子命令
 */
const redisCommand: SlashCommand = {
  name: 'redis',
  description: '为Java项目接入Redis中间件',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    _args: string,
  ): Promise<SlashCommandActionReturn | void> =>
    await handleRedisImport(context),
};

/**
 * RocketMQ 子命令
 */
const rocketMqCommand: SlashCommand = {
  name: 'rocketmq',
  description: '为Java项目接入RocketMQ消息中间件',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    _args: string,
  ): Promise<SlashCommandActionReturn | void> =>
    await handleRocketMqImport(context),
};

/**
 * 主 import 命令
 */
export const importCommand: SlashCommand = {
  name: 'import',
  description: '为工作区的Java项目导入中间件',
  kind: CommandKind.BUILT_IN,
  subCommands: [mysqlCommand, redisCommand, apolloCommand, rocketMqCommand],
  action: async (
    context: CommandContext,
    args: string,
  ): Promise<SlashCommandActionReturn | void> => {
    const parsedArgs = parseImportArgs(args);

    if (!parsedArgs) {
      context.ui.addItem(
        {
          type: MessageType.ERROR,
          text: '❌ 命令格式错误。请使用以下格式：\n• /import <中间件类型> [项目名]\n\n支持的中间件类型：\n• MySQL - 接入MySQL数据库中间件（需要项目名）\n• Redis - 接入Redis缓存中间件\n• Apollo - 接入Apollo配置中心（需要应用ID）\n• RocketMQ - 接入RocketMQ消息中间件\n\n示例：\n• /import MySQL my-project\n• /import Redis\n• /import Apollo my-app-id\n• /import RocketMQ',
        },
        Date.now(),
      );
      return;
    }

    const { middleware, projectName } = parsedArgs;

    // 根据中间件类型调用相应的处理函数
    switch (middleware) {
      case 'mysql':
        return await handleMySQLImport(context, projectName);
      case 'redis':
        return await handleRedisImport(context);
      case 'apollo':
        return await handleApolloImport(context, projectName);
      case 'rocketmq':
        return await handleRocketMqImport(context);
      default:
        context.ui.addItem(
          {
            type: MessageType.ERROR,
            text: `❌ 不支持的中间件类型：${middleware}\n\n当前支持的中间件类型：MySQL, Redis, Apollo, RocketMQ`,
          },
          Date.now(),
        );
        return;
    }
  },
};
