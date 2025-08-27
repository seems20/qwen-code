/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
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
function parseImportArgs(args: string): { middleware: string; projectName?: string } | null {
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
 * 将 kebab-case 转换为 camelCase
 * 例如：sns-circle -> snsCircle, circle -> circle
 */
function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 递归查找包含 infrastructure 或 infra 的目录
 */
async function findInfraDirectoryRecursive(
  currentDir: string,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<string | null> {
  if (currentDepth >= maxDepth) {
    return null;
  }

  try {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(currentDir, entry.name);

        // 检查目录名是否包含 infrastructure 或 infra
        if (entry.name === 'infrastructure' || entry.name === 'infra') {
          return fullPath;
        }

        // 递归查找子目录
        const found = await findInfraDirectoryRecursive(fullPath, maxDepth, currentDepth + 1);
        if (found) {
          return found;
        }
      }
    }
  } catch {
    // 忽略读取权限错误等
  }

  return null;
}

/**
 * 查找项目中的 infra 或 infrastructure 目录
 */
async function findInfraDirectory(workspaceRoot: string): Promise<string | null> {
  // 首先检查常见的顶层目录
  const commonDirs = [
    path.join(workspaceRoot, 'infra'),
    path.join(workspaceRoot, 'infrastructure'),
  ];

  for (const dir of commonDirs) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      // 目录不存在，继续查找
    }
  }

  // 检查直接子目录
  try {
    const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subInfra = path.join(workspaceRoot, entry.name, 'infra');
        const subInfrastructure = path.join(workspaceRoot, entry.name, 'infrastructure');

        for (const dir of [subInfra, subInfrastructure]) {
          try {
            await fs.access(dir);
            return dir;
          } catch {
            // 继续查找
          }
        }
      }
    }
  } catch {
    // 忽略读取错误
  }

  // 递归查找更深层的 infrastructure 目录
  return await findInfraDirectoryRecursive(workspaceRoot);
}

/**
 * 递归查找包含 domain 的目录
 */
async function findDomainDirectoryRecursive(
  currentDir: string,
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<string | null> {
  if (currentDepth >= maxDepth) {
    return null;
  }

  try {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(currentDir, entry.name);

        // 检查目录名是否包含 domain
        if (entry.name === 'domain') {
          return fullPath;
        }

        // 递归查找子目录
        const found = await findDomainDirectoryRecursive(fullPath, maxDepth, currentDepth + 1);
        if (found) {
          return found;
        }
      }
    }
  } catch {
    // 忽略读取权限错误等
  }

  return null;
}

/**
 * 查找项目中的 domain 目录
 */
async function findDomainDirectory(workspaceRoot: string): Promise<string | null> {
  // 首先检查常见的顶层目录
  const commonDirs = [
    path.join(workspaceRoot, 'domain'),
  ];

  for (const dir of commonDirs) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      // 目录不存在，继续查找
    }
  }

  // 检查直接子目录
  try {
    const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDomain = path.join(workspaceRoot, entry.name, 'domain');

        try {
          await fs.access(subDomain);
          return subDomain;
        } catch {
          // 继续查找
        }
      }
    }
  } catch {
    // 忽略读取错误
  }

  // 递归查找更深层的 domain 目录
  return await findDomainDirectoryRecursive(workspaceRoot);
}

/**
 * 生成配置类代码
 */
function generateDataSourceConfigCode(
  packagePath: string,
  projectName: string,
  mapperPackagePath: string
): string {
  const camelCaseProjectName = kebabToCamelCase(projectName);

  return `package ${packagePath};

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
@MapperScan(basePackages = "${mapperPackagePath}",
        sqlSessionFactoryRef = "${camelCaseProjectName}SqlSessionFactory")
public class ${camelCaseProjectName}DataSourceConfig {

    @Bean(name = "${camelCaseProjectName}Datasource", initMethod = "init")
    @ConfigurationProperties(prefix = "spring.datasource.${projectName}")
    public GroupDataSource ${camelCaseProjectName}Datasource() {
        return DataSourceBuilder.create().type(GroupDataSource.class).build();
    }

    @Bean(name = "${camelCaseProjectName}SqlSessionFactory")
    public SqlSessionFactory ${camelCaseProjectName}SqlSessionFactory(@Qualifier("${camelCaseProjectName}Datasource") DataSource datasource)
            throws Exception {
        SqlSessionFactoryBean sqlSessionFactoryBean = new SqlSessionFactoryBean();
        sqlSessionFactoryBean.setDataSource(datasource);
        sqlSessionFactoryBean.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath:mapper/*.xml"));
        return sqlSessionFactoryBean.getObject();
    }

    @Bean(name="${camelCaseProjectName}JdbcTemplate")
    public JdbcTemplate jdbcTemplate(@Qualifier("${camelCaseProjectName}Datasource") DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
    
}`;
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查目录是否存在
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 读取并解析 pom.xml 文件
 */
async function readPomXml(pomPath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(pomPath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

/**
 * 检查 pom.xml 中是否存在指定的依赖
 */
function checkDependencyExists(pomContent: string, groupId: string, artifactId: string): boolean {
  // 使用正则表达式检查依赖是否存在
  const dependencyPattern = new RegExp(
    `<dependency[^>]*>\\s*` +
    `(?:[^<]*<[^>]+>[^<]*</[^>]+>\\s*)*` +
    `(?:<groupId>\\s*${groupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</groupId>\\s*` +
    `<artifactId>\\s*${artifactId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</artifactId>|` +
    `<artifactId>\\s*${artifactId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</artifactId>\\s*` +
    `<groupId>\\s*${groupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</groupId>)`,
    'is'
  );

  return dependencyPattern.test(pomContent);
}

/**
 * 检查 pom.xml 中是否存在 infra-root-pom 依赖
 */
function checkInfraRootPom(pomContent: string): boolean {
  // 检查 <artifactId>infra-root-pom</artifactId> 是否存在
  const infraRootPomPattern = /<artifactId>\s*infra-root-pom\s*<\/artifactId>/i;
  return infraRootPomPattern.test(pomContent);
}

/**
 * 查找项目中的配置文件
 */
async function findConfigFiles(workspaceRoot: string): Promise<string[]> {
  const configFiles = ['application-prod.yml', 'application-sit.yml', 'application-staging.yml'];
  const foundFiles: string[] = [];

  // 在可能的位置查找配置文件
  const possibleDirs = [
    path.join(workspaceRoot, 'src/main/resources'),
    path.join(workspaceRoot, 'resources'),
  ];

  // 查找子目录中的资源目录
  try {
    const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        possibleDirs.push(
          path.join(workspaceRoot, entry.name, 'src/main/resources'),
          path.join(workspaceRoot, entry.name, 'resources')
        );
      }
    }
  } catch {
    // 忽略读取错误
  }

  for (const dir of possibleDirs) {
    for (const configFile of configFiles) {
      const filePath = path.join(dir, configFile);
      try {
        await fs.access(filePath);
        foundFiles.push(filePath);
      } catch {
        // 文件不存在，继续查找
      }
    }
  }

  return foundFiles;
}

/**
 * 生成数据源配置内容
 */
function generateDataSourceYamlConfig(projectName: string): string {
  return `spring:
  datasource:
    ${projectName}:
      url: # TODO: 请填写数据库连接标识符`;
}

/**
 * 生成 RocketMQ 配置类代码
 */
function generateRocketMqConfigCode(packagePath: string): string {
  return `package ${packagePath};

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
}`;
}

/**
 * 生成 WrapperMqProducer 类代码
 */
function generateWrapperMqProducerCode(packagePath: string): string {
  return `package ${packagePath};

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
}`;
}

/**
 * 生成 MessageLifecycleListener 类代码
 */
function generateMessageLifecycleListenerCode(packagePath: string): string {
  return `package ${packagePath};

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
 *
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
}`;
}

/**
 * 生成 MqProcessor 类代码
 */
function generateMqProcessorCode(packagePath: string): string {
  return `package ${packagePath};

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
}`;
}

/**
 * 生成 RocketMqConsumerConfig 类代码
 */
function generateRocketMqConsumerConfigCode(packagePath: string, mqProcessorImportPath: string): string {
  return `package ${packagePath};

import com.xiaohongshu.events.client.consumer.EventsPushConsumer;
import ${mqProcessorImportPath};
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
}`;
}

/**
 * 生成完整的 MySQL 接入提示词（包含依赖添加、配置类生成和配置文件更新）
 */
function generateMySQLSetupPrompt(
  pomPath: string,
  pomContent: string,
  groupId: string,
  artifactId: string,
  infraDir: string | null,
  workspaceRoot: string,
  projectName: string,
  configFiles: string[],
  allDependenciesExist: boolean,
  missingDeps: string[],
  redsqlExists: boolean,
  mybatisExists: boolean,
  mybatisSpringExists: boolean,
  mapperDirExists: boolean,
  configDirExists: boolean,
  configFilePath: string
): string {
  // 构建包路径和目录结构
  let configPackage = '';
  let mapperPackage = '';
  let configDir = '';
  let mapperDir = '';

  if (infraDir) {
    // 从 infraDir 路径中提取包名
    // 例如: /Users/.../src/main/java/com/xiaohongshu/fls/sns/circle/infrastructure
    // 提取: com.xiaohongshu.fls.sns.circle.infrastructure
    const javaIndex = infraDir.indexOf('src/main/java/');
    if (javaIndex !== -1) {
      const packagePath = infraDir.substring(javaIndex + 'src/main/java/'.length).replace(/[/\\]/g, '.');
      configPackage = `${packagePath}.config`;
      mapperPackage = `${packagePath}.mysql.mapper`;
    } else {
      // 如果找不到标准的 src/main/java 结构，回退到基础包名
      configPackage = `com.xiaohongshu.${projectName}.infrastructure.config`;
      mapperPackage = `com.xiaohongshu.${projectName}.infrastructure.mysql.mapper`;
    }
    configDir = path.join(infraDir, 'config/mysql');
    mapperDir = path.join(infraDir, 'mysql/mapper');
  } else {
    // 回退方案：在当前目录创建
    configPackage = `com.xiaohongshu.${projectName}.infra.dal.mysql.config`;
    mapperPackage = `com.xiaohongshu.${projectName}.infra.dal.mysql.mapper`;
    configDir = path.join(workspaceRoot, 'src/main/java/com/xiaohongshu', projectName, 'infra/dal/mysql/config');
    mapperDir = path.join(workspaceRoot, 'src/main/java/com/xiaohongshu', projectName, 'infra/dal/mysql/mapper');
  }

  const configCode = generateDataSourceConfigCode(configPackage, projectName, mapperPackage);
  const yamlConfigContent = generateDataSourceYamlConfig(projectName);

  // 初始化任务编号和内容
  let dependencySection = '';
  let taskNumber = 1;

  if (!allDependenciesExist) {
    const dependencyTemplates = [];
    if (!redsqlExists) {
      dependencyTemplates.push(`        <dependency>
            <groupId>com.xiaohongshu.redsql</groupId>
            <artifactId>redsql-spring-boot-starter</artifactId>
        </dependency>`);
    }
    if (!mybatisExists) {
      dependencyTemplates.push(`        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis</artifactId>
        </dependency>`);
    }
    if (!mybatisSpringExists) {
      dependencyTemplates.push(`        <dependency>
            <groupId>org.mybatis</groupId>
            <artifactId>mybatis-spring</artifactId>
        </dependency>`);
    }
    
    // 如果有依赖需要添加，在最前面加上注释
    if (dependencyTemplates.length > 0) {
      dependencyTemplates.unshift(`        <!-- mysql -->`);
    }

    // 找到已存在的MySQL相关依赖位置
    let existingDependencyName = '';
    if (redsqlExists) existingDependencyName = 'redsql-spring-boot-starter';
    else if (mybatisExists) existingDependencyName = 'mybatis';
    else if (mybatisSpringExists) existingDependencyName = 'mybatis-spring';

    dependencySection = `
**任务${taskNumber}：在 infrastructure 模块添加 Maven 依赖**
文件：${pomPath}

**操作方式：使用 write_file 工具重写整个模块 pom.xml 文件**
${existingDependencyName ? `在已存在的 ${existingDependencyName} 依赖**正下方**追加以下缺失的依赖（包含注释）：` : '在 </dependencies> 标签正上方添加以下依赖（包含注释）：'}

${dependencyTemplates.join('\n')}

当前模块 pom.xml 的完整内容：
\`\`\`xml
${pomContent}
\`\`\`

**重要说明：请使用 write_file 工具重写整个文件，${existingDependencyName ? `确保新依赖（以<!-- mysql -->注释开头）紧跟在现有的 ${existingDependencyName} 依赖之后` : '确保新依赖（以<!-- mysql -->注释开头）在 </dependencies> 标签正上方'}，保持正确缩进，严禁添加version标签。**

`;
    taskNumber++;
  }

  // 只有当目录不存在时才生成创建目录的任务
  let mapperTaskSection = '';
  if (!mapperDirExists) {
    mapperTaskSection = `**任务${taskNumber}：创建 Mapper 目录**
创建目录：${mapperDir}

`;
    taskNumber++;
  }

  let configDirTaskSection = '';
  if (!configDirExists) {
    configDirTaskSection = `**任务${taskNumber}：创建配置类目录**
创建目录：${configDir}

`;
    taskNumber++;
  }

  const configTaskNum = taskNumber;

  let configFilesSection = '';
  if (configFiles.length > 0) {
    const yamlTaskNumber = configTaskNum + 1;
    // 只处理 application-sit.yml 文件
    const sitConfigFile = configFiles.find(file => file.includes('application-sit.yml'));
    
    if (sitConfigFile) {
      configFilesSection = `

**任务${yamlTaskNumber}：更新配置文件**

更新文件：${sitConfigFile}

**操作步骤：**
1. 使用 read_file 工具读取文件内容（参数：target_file="${sitConfigFile}", should_read_entire_file=true）
2. 使用 write_file 工具重写文件，在原内容末尾追加以下配置：

\`\`\`yaml
${yamlConfigContent}
\`\`\`

**写入要求：**
- 使用 write_file 工具（参数：target_file="${sitConfigFile}", content=组合后的完整内容）
- **保留文件中所有现有内容不变**
- 在原内容末尾添加两个换行符，然后追加新的数据源配置
- 组合格式：原始文件内容 + "\\n\\n" + 上述新数据源配置
- 确保现有配置项（如logging、apollo等）完全保持不变`;
    } else {
      configFilesSection = `

**任务${yamlTaskNumber}：配置文件说明**
未找到 application-sit.yml 文件，请手动在配置文件中添加以下数据源配置：

\`\`\`yaml
${yamlConfigContent}
\`\`\``;
    }
  }

  return `请为项目 "${projectName}" 完成 MySQL 接入配置，包含以下任务：
${dependencySection}${mapperTaskSection}${configDirTaskSection}**任务${configTaskNum}：创建配置类**
创建文件：${configFilePath}

**重要说明：请根据实际创建的文件路径推断正确的包名，不要使用模板中的包名**
例如：如果文件创建在 src/main/java/com/xiaohongshu/fls/sns/circle/infrastructure/config/mysql/
则包名应该是：com.xiaohongshu.fls.sns.circle.infrastructure.config.mysql

配置类内容模板（**请修正包名为实际路径对应的包名**）：
\`\`\`java
${configCode}
\`\`\`

${configFilesSection}

**重要说明：请严格按照上述任务编号顺序执行，每个任务只执行一次。**

**工具调用格式要求：**
- read_file: 参数 absolute_path="文件路径"
- write_file: 参数 file_path="文件路径", content="完整文件内容"  
- run_terminal_cmd: 参数 command="shell命令", is_background=false

**完成所有任务后，请告知用户：**
✅ MySQL 接入配置已完成！请参考接入文档进行标识符申请：
📖 文档链接：https://docs.xiaohongshu.com/doc/920c445ca92ebe2a964655e0ef3ec6ac`;
}

/**
 * 生成完整的 RocketMQ 接入提示词（包含依赖添加和配置类生成）
 */
function generateRocketMqSetupPrompt(
  pomPath: string,
  pomContent: string,
  infraDir: string | null,
  workspaceRoot: string,
  domainDir: string | null,
  eventsClientExists: boolean,
  configDirExists: boolean
): string {
  // 构建包路径和目录结构
  let configPackage = '';
  let domainPackage = '';
  let configDir = '';
  let eventsDir = '';
  
  // 配置类文件路径
  let rocketMqProducerConfigPath = '';
  let wrapperMqProducerPath = '';
  let messageLifecycleListenerPath = '';
  let rocketMqConsumerConfigPath = '';
  let mqProcessorPath = '';

  if (infraDir) {
    // 从 infraDir 路径中提取包名
    const javaIndex = infraDir.indexOf('src/main/java/');
    if (javaIndex !== -1) {
      const packagePath = infraDir.substring(javaIndex + 'src/main/java/'.length).replace(/[/\\]/g, '.');
      configPackage = `${packagePath}.config.mq`;
    } else {
      configPackage = `com.xiaohongshu.infrastructure.config.mq`;
    }
    configDir = path.join(infraDir, 'config/mq');
    rocketMqProducerConfigPath = path.join(configDir, 'RocketMqProducerConfig.java');
    wrapperMqProducerPath = path.join(configDir, 'WrapperMqProducer.java');
    messageLifecycleListenerPath = path.join(configDir, 'MessageLifecycleListener.java');
    rocketMqConsumerConfigPath = path.join(configDir, 'RocketMqConsumerConfig.java');
  } else {
    configPackage = `com.xiaohongshu.infra.config.mq`;
    configDir = path.join(workspaceRoot, 'src/main/java/com/xiaohongshu/infra/config/mq');
    rocketMqProducerConfigPath = path.join(configDir, 'RocketMqProducerConfig.java');
    wrapperMqProducerPath = path.join(configDir, 'WrapperMqProducer.java');
    messageLifecycleListenerPath = path.join(configDir, 'MessageLifecycleListener.java');
    rocketMqConsumerConfigPath = path.join(configDir, 'RocketMqConsumerConfig.java');
  }

  if (domainDir) {
    // 从 domainDir 路径中提取包名
    const javaIndex = domainDir.indexOf('src/main/java/');
    if (javaIndex !== -1) {
      const packagePath = domainDir.substring(javaIndex + 'src/main/java/'.length).replace(/[/\\]/g, '.');
      domainPackage = `${packagePath}.events`;
    } else {
      domainPackage = `com.xiaohongshu.domain.events`;
    }
    eventsDir = path.join(domainDir, 'events');
    mqProcessorPath = path.join(eventsDir, 'MqProcessor.java');
  } else {
    domainPackage = `com.xiaohongshu.domain.events`;
    eventsDir = path.join(workspaceRoot, 'src/main/java/com/xiaohongshu/domain/events');
    mqProcessorPath = path.join(eventsDir, 'MqProcessor.java');
  }

  // 生成各个配置类的代码
  const rocketMqProducerConfigCode = generateRocketMqConfigCode(configPackage);
  const wrapperMqProducerCode = generateWrapperMqProducerCode(configPackage);
  const messageLifecycleListenerCode = generateMessageLifecycleListenerCode(configPackage);
  const mqProcessorCode = generateMqProcessorCode(domainPackage);
  const rocketMqConsumerConfigCode = generateRocketMqConsumerConfigCode(configPackage, `${domainPackage}.MqProcessor`);

  // 初始化任务编号和内容
  let dependencySection = '';
  let taskNumber = 1;

  if (!eventsClientExists) {
    dependencySection = `
**任务${taskNumber}：在 domain 模块添加 RocketMQ 依赖**
文件：${pomPath}

**操作方式：使用 write_file 工具重写整个模块 pom.xml 文件**
在 </dependencies> 标签正上方添加以下依赖：

        <dependency>
            <groupId>com.xiaohongshu</groupId>
            <artifactId>events-client</artifactId>
        </dependency>

当前模块 pom.xml 的完整内容：
\`\`\`xml
${pomContent}
\`\`\`

**重要说明：请使用 write_file 工具重写整个文件，确保新依赖在 </dependencies> 标签正上方，保持正确缩进，严禁添加version标签。**

`;
    taskNumber++;
  }

  // 配置类目录任务
  let configDirTaskSection = '';
  if (!configDirExists) {
    configDirTaskSection = `**任务${taskNumber}：创建配置类目录**
创建目录：${configDir}

`;
    taskNumber++;
  }

  // events目录任务
  const eventsTaskNumber = taskNumber;
  taskNumber++;

  return `请完成 RocketMQ 接入配置，包含以下任务：
${dependencySection}${configDirTaskSection}**任务${eventsTaskNumber}：创建 events 目录并生成 MqProcessor 类**
创建目录：${eventsDir}
创建文件：${mqProcessorPath}

**重要说明：请根据实际创建的文件路径推断正确的包名**

MqProcessor 类内容模板（**请修正包名为实际路径对应的包名**）：
\`\`\`java
${mqProcessorCode}
\`\`\`

**任务${taskNumber}：创建 RocketMQ 生产者配置类**
创建文件：${rocketMqProducerConfigPath}

配置类内容模板（**请修正包名为实际路径对应的包名**）：
\`\`\`java
${rocketMqProducerConfigCode}
\`\`\`

**任务${taskNumber + 1}：创建 WrapperMqProducer 工具类**
创建文件：${wrapperMqProducerPath}

配置类内容模板（**请修正包名为实际路径对应的包名**）：
\`\`\`java
${wrapperMqProducerCode}
\`\`\`

**任务${taskNumber + 2}：创建 MessageLifecycleListener 类**
创建文件：${messageLifecycleListenerPath}

配置类内容模板（**请修正包名为实际路径对应的包名**）：
\`\`\`java
${messageLifecycleListenerCode}
\`\`\`

**任务${taskNumber + 3}：创建 RocketMQ 消费者配置类**
创建文件：${rocketMqConsumerConfigPath}

配置类内容模板（**请修正包名为实际路径对应的包名，并正确导入 MqProcessor 类**）：
\`\`\`java
${rocketMqConsumerConfigCode}
\`\`\`

**重要说明：请严格按照上述任务编号顺序执行，每个任务只执行一次。**

**工具调用格式要求：**
- read_file: 参数 absolute_path="文件路径"
- write_file: 参数 file_path="文件路径", content="完整文件内容"  
- run_terminal_cmd: 参数 command="shell命令", is_background=false

**完成所有任务后，请告知用户：**
✅ RocketMQ 接入配置已完成！包含生产者、消费者、消息处理器和生命周期管理器等完整配置。
📖 更详细的使用说明请参考：https://docs.xiaohongshu.com/doc/adc99c5ec0214993aed7771f866ecd58`;
}

/**
 * 查找 infrastructure 模块的 pom.xml 文件
 */
async function findModulePomFile(workspaceRoot: string): Promise<string | null> {
  // 在工作区根目录下查找包含 "infrastructure" 或 "infra" 的子目录
  const possibleModuleNames = ['infrastructure', 'infra'];
  
  try {
    const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirName = entry.name.toLowerCase();
        
        // 检查目录名是否包含 infrastructure 或 infra
        const isInfraModule = possibleModuleNames.some(name => 
          dirName.includes(name) || dirName.endsWith(`-${name}`) || dirName.startsWith(`${name}-`)
        );
        
        if (isInfraModule) {
          const modulePomPath = path.join(workspaceRoot, entry.name, 'pom.xml');
          try {
            await fs.access(modulePomPath);
            // 验证是否是模块 pom（包含 <parent> 和 <dependencies>）
            const pomContent = await fs.readFile(modulePomPath, 'utf-8');
            if (pomContent.includes('<parent>') && pomContent.includes('<dependencies>')) {
              return modulePomPath;
            }
          } catch {
            // 该目录下没有 pom.xml 或无法读取，继续查找
          }
        }
      }
    }
  } catch {
    // 读取目录失败
  }
  
  return null;
}

/**
 * 查找 domain 模块的 pom.xml 文件
 */
async function findDomainModulePomFile(workspaceRoot: string): Promise<string | null> {
  // 在工作区根目录下查找包含 "domain" 的子目录
  const possibleModuleNames = ['domain'];
  
  try {
    const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirName = entry.name.toLowerCase();
        
        // 检查目录名是否包含 domain
        const isDomainModule = possibleModuleNames.some(name => 
          dirName.includes(name) || dirName.endsWith(`-${name}`) || dirName.startsWith(`${name}-`)
        );
        
        if (isDomainModule) {
          const modulePomPath = path.join(workspaceRoot, entry.name, 'pom.xml');
          try {
            await fs.access(modulePomPath);
            // 验证是否是模块 pom（包含 <parent> 和 <dependencies>）
            const pomContent = await fs.readFile(modulePomPath, 'utf-8');
            if (pomContent.includes('<parent>') && pomContent.includes('<dependencies>')) {
              return modulePomPath;
            }
          } catch {
            // 该目录下没有 pom.xml 或无法读取，继续查找
          }
        }
      }
    }
  } catch {
    // 读取目录失败
  }
  
  return null;
}

/**
 * 处理 MySQL 导入逻辑
 */
async function handleMySQLImport(
  context: CommandContext,
  projectName?: string
): Promise<SlashCommandActionReturn | void> {
  const workspaceRoot = process.cwd();

  // 检查是否提供了项目名（生成配置类需要项目名）
  if (!projectName) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 请提供项目名称。\n\n使用格式：/import mysql <项目名>\n例如：/import mysql sns-circle`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `正在为 "${projectName}" 配置 MySQL 接入...\n当前工作目录: ${workspaceRoot}`,
    },
    Date.now(),
  );

  // 第一步：查找模块的 pom.xml 文件
  const pomPath = await findModulePomFile(workspaceRoot);
  if (!pomPath) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到 infrastructure 模块的 pom.xml 文件\n\n请确保项目中存在名称包含 "infrastructure" 或 "infra" 的模块目录`,
      },
      Date.now(),
    );
    return;
  }

  // 第二步：查找 infrastructure 目录（用于创建配置类）
  const infraDir = await findInfraDirectory(workspaceRoot);
  if (!infraDir) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到 infrastructure 或 infra 目录（Java包结构）`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 找到 infrastructure 模块 pom.xml: ${pomPath}`,
    },
    Date.now(),
  );

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 找到 infrastructure 目录: ${infraDir}`,
    },
    Date.now(),
  );

  // 第三步：检查顶层 pom.xml 中的 infra-root-pom 依赖
  const mainPomPath = path.join(workspaceRoot, 'pom.xml');
  if (!(await fileExists(mainPomPath))) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到顶层 pom.xml 文件: ${mainPomPath}`,
      },
      Date.now(),
    );
    return;
  }

  const mainPomContent = await readPomXml(mainPomPath);
  if (!mainPomContent) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 无法读取顶层 pom.xml 文件: ${mainPomPath}`,
      },
      Date.now(),
    );
    return;
  }

  if (!checkInfraRootPom(mainPomContent)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 顶层 pom.xml 中未检测到 infra-root-pom 依赖。\n\n请先接入 infra-root-pom，参考文档：https://docs.xiaohongshu.com/doc/2cc2c53888b7b1bc5b2d91f98a222d8b\n\n接入 infra-root-pom 后，再次运行此命令。`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 顶层 pom.xml 中检测到 infra-root-pom 依赖已存在`,
    },
    Date.now(),
  );

  // 读取模块 pom.xml 内容
  const pomContent = await readPomXml(pomPath);
  if (!pomContent) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 无法读取模块 pom.xml 文件: ${pomPath}`,
      },
      Date.now(),
    );
    return;
  }

  // 第四步：检查模块 pom.xml 中的 MySQL 相关依赖
  const redsqlGroupId = 'com.xiaohongshu.redsql';
  const redsqlArtifactId = 'redsql-spring-boot-starter';
  const mybatisGroupId = 'org.mybatis';
  const mybatisArtifactId = 'mybatis';
  const mybatisSpringArtifactId = 'mybatis-spring';

  const redsqlExists = checkDependencyExists(pomContent, redsqlGroupId, redsqlArtifactId);
  const mybatisExists = checkDependencyExists(pomContent, mybatisGroupId, mybatisArtifactId);
  const mybatisSpringExists = checkDependencyExists(pomContent, mybatisGroupId, mybatisSpringArtifactId);

  const allDependenciesExist = redsqlExists && mybatisExists && mybatisSpringExists;

  // infrastructure 目录已在前面找到并验证

  // 构建目录路径
  let configDir = '';
  let mapperDir = '';

  if (infraDir) {
    configDir = path.join(infraDir, 'config/mysql');
    mapperDir = path.join(infraDir, 'mysql/mapper');
  } else {
    configDir = path.join(workspaceRoot, 'src/main/java/com/xiaohongshu', projectName, 'infra/dal/mysql/config');
    mapperDir = path.join(workspaceRoot, 'src/main/java/com/xiaohongshu', projectName, 'infra/dal/mysql/mapper');
  }

  // 检查目录是否存在
  const mapperDirExists = await directoryExists(mapperDir);
  const configDirExists = await directoryExists(configDir);
  
  // 检查配置类文件是否已存在
  const camelCaseProjectName = kebabToCamelCase(projectName);
  const configFileName = `${camelCaseProjectName}DataSourceConfig.java`;
  const configFilePath = path.join(configDir, configFileName);
  
  let configFileExists = false;
  try {
    await fs.access(configFilePath);
    configFileExists = true;
  } catch {
    configFileExists = false;
  }
  
  if (configFileExists) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 配置类文件已存在: ${configFilePath}\n请使用不同的项目名或手动删除现有文件后重试。\n提示：可以尝试 /import mysql ${projectName}-db2 来创建第二个配置类`,
      },
      Date.now(),
    );
    return;
  }

  if (mapperDirExists) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ Mapper 目录已存在: ${mapperDir}`,
      },
      Date.now(),
    );
  } else {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `⚠️ 需要创建 Mapper 目录: ${mapperDir}`,
      },
      Date.now(),
    );
  }

  if (configDirExists) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ 配置类目录已存在: ${configDir}`,
      },
      Date.now(),
    );
  } else {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `⚠️ 需要创建配置类目录: ${configDir}`,
      },
      Date.now(),
    );
  }

  // 查找配置文件
  const configFiles = await findConfigFiles(workspaceRoot);
  if (configFiles.length > 0) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ 找到配置文件: ${configFiles.map(f => path.basename(f)).join(', ')}`,
      },
      Date.now(),
    );
  } else {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `⚠️ 未找到配置文件，请手动添加数据源配置`,
      },
      Date.now(),
    );
  }

  // 显示依赖检查结果
  const missingDeps = [];
  if (!redsqlExists) missingDeps.push('redsql-spring-boot-starter');
  if (!mybatisExists) missingDeps.push('mybatis');
  if (!mybatisSpringExists) missingDeps.push('mybatis-spring');

  if (allDependenciesExist) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ MySQL 相关依赖已全部存在，跳过依赖添加步骤`,
      },
      Date.now(),
    );
  } else {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `⚠️ 缺少以下依赖，将添加：${missingDeps.join(', ')}`,
      },
      Date.now(),
    );
  }

  // 使用大模型完成完整的 MySQL 接入配置
  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `RDMind正在接入MySQL...`,
    },
    Date.now(),
  );

  // 生成完整的 MySQL 接入提示词
  const prompt = generateMySQLSetupPrompt(
    pomPath,
    pomContent,
    redsqlGroupId,
    redsqlArtifactId,
    infraDir,
    workspaceRoot,
    projectName,
    configFiles,
    allDependenciesExist,
    missingDeps,
    redsqlExists,
    mybatisExists,
    mybatisSpringExists,
    mapperDirExists,
    configDirExists,
    configFilePath
  );

  return {
    type: 'submit_prompt',
    content: prompt,
  };
}

/**
 * 处理 Redis 导入逻辑
 */
async function handleRedisImport(
  context: CommandContext
): Promise<SlashCommandActionReturn | void> {
  const workspaceRoot = process.cwd();

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `正在为项目配置 Redis 接入...\n当前工作目录: ${workspaceRoot}`,
    },
    Date.now(),
  );

  // 第一步：查找模块的 pom.xml 文件
  const pomPath = await findModulePomFile(workspaceRoot);
  if (!pomPath) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到 infrastructure 模块的 pom.xml 文件\n\n请确保项目中存在名称包含 "infrastructure" 或 "infra" 的模块目录`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 找到 infrastructure 模块 pom.xml: ${pomPath}`,
    },
    Date.now(),
  );

  // 第二步：检查顶层 pom.xml 中的 infra-root-pom 依赖
  const mainPomPath = path.join(workspaceRoot, 'pom.xml');
  if (!(await fileExists(mainPomPath))) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到顶层 pom.xml 文件: ${mainPomPath}`,
      },
      Date.now(),
    );
    return;
  }

  const mainPomContent = await readPomXml(mainPomPath);
  if (!mainPomContent) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 无法读取顶层 pom.xml 文件: ${mainPomPath}`,
      },
      Date.now(),
    );
    return;
  }

  if (!checkInfraRootPom(mainPomContent)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 顶层 pom.xml 中未检测到 infra-root-pom 依赖。\n\n请先接入 infra-root-pom，参考文档：https://docs.xiaohongshu.com/doc/2cc2c53888b7b1bc5b2d91f98a222d8b\n\n接入 infra-root-pom 后，再次运行此命令。`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 顶层 pom.xml 中检测到 infra-root-pom 依赖已存在`,
    },
    Date.now(),
  );

  // 读取模块 pom.xml 内容
  const pomContent = await readPomXml(pomPath);
  if (!pomContent) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 无法读取模块 pom.xml 文件: ${pomPath}`,
      },
      Date.now(),
    );
    return;
  }

  // 第三步：检查模块 pom.xml 中的 Redis 相关依赖
  const redisGroupId = 'com.xiaohongshu.infra.midware';
  const redisArtifactId = 'redis-spring';

  const redisExists = checkDependencyExists(pomContent, redisGroupId, redisArtifactId);

  if (redisExists) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ Redis 依赖已存在，无需重复添加`,
      },
      Date.now(),
    );
    
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ Redis 接入配置已完成！请参考接入文档进行标识符申请：\n📖 文档链接：https://docs.xiaohongshu.com/doc/5ff2d7dadba283a5fb6e7bd6c6e53001`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `⚠️ 缺少 Redis 依赖，将添加：redis-spring`,
    },
    Date.now(),
  );

  // 使用大模型完成 Redis 接入配置
  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `RDMind正在接入Redis...`,
    },
    Date.now(),
  );

  // 生成 Redis 接入提示词
  const prompt = generateRedisSetupPrompt(pomPath, pomContent);

  return {
    type: 'submit_prompt',
    content: prompt,
  };
}

/**
 * 生成 Redis 接入提示词
 */
function generateRedisSetupPrompt(pomPath: string, pomContent: string): string {
  return `请为项目完成 Redis 接入配置：

**任务：在 infrastructure 模块添加 Redis 依赖**
文件：${pomPath}

**操作方式：使用 write_file 工具重写整个模块 pom.xml 文件**
在 </dependencies> 标签正上方添加以下依赖（包含注释）：

        <!-- Spring 环境通过连接符接入引入redis-spring -->
        <dependency>
            <groupId>com.xiaohongshu.infra.midware</groupId>
            <artifactId>redis-spring</artifactId>
        </dependency>

当前模块 pom.xml 的完整内容：
\`\`\`xml
${pomContent}
\`\`\`

**重要说明：请使用 write_file 工具重写整个文件，确保新依赖（以<!-- Spring 环境通过连接符接入引入redis-spring -->注释开头）在 </dependencies> 标签正上方，保持正确缩进，严禁添加version标签。**

**工具调用格式要求：**
- write_file: 参数 file_path="${pomPath}", content="完整文件内容"

**完成任务后，请告知用户：**
✅ Redis 接入配置已完成！请参考接入文档进行标识符申请：
📖 文档链接：https://docs.xiaohongshu.com/doc/5ff2d7dadba283a5fb6e7bd6c6e53001`;
}

/**
 * 处理 Apollo 导入逻辑
 */
async function handleApolloImport(
  context: CommandContext,
  appId?: string
): Promise<SlashCommandActionReturn | void> {
  const workspaceRoot = process.cwd();

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
    { type: MessageType.INFO, text: `正在为 "${appId}" 配置 Apollo 接入...\n当前工作目录: ${workspaceRoot}` },
    Date.now(),
  );

  context.ui.addItem(
    { type: MessageType.INFO, text: `RDMind正在接入Apollo...` },
    Date.now(),
  );

  // 生成 Apollo 配置提示词
  const prompt = `请完成 Apollo 接入配置：

**任务1：查找 app.properties 文件**
使用 FindFiles 工具查找 app.properties 文件（参数：pattern="**/app.properties"）

**任务2：更新 app.properties 文件**
找到 app.properties 文件后，执行以下操作：

**操作步骤：**
1. 使用 read_file 工具读取文件内容（参数：absolute_path="找到的文件路径"）
2. 查找文件中的 "app.id=sample" 行
3. 将 "sample" 替换为 "${appId}"
4. 使用 write_file 工具重写整个文件（参数：file_path="找到的文件路径", content=修改后的完整内容）

**注意事项：**
- 如果找不到 app.properties 文件，请告知用户文件不存在
- 保留文件中的所有其他内容不变
- 只修改 app.id 的值

**工具调用格式：**
- FindFiles: 参数 pattern="**/app.properties"
- read_file: 参数 absolute_path="文件路径"
- write_file: 参数 file_path="文件路径", content="完整文件内容"

**完成后，请告知用户：**
✅ Apollo 接入配置已完成！
📖 文档链接：https://docs.xiaohongshu.com/doc/98113484a8a9c92cbcfeddc10a310312`;

  return {
    type: 'submit_prompt',
    content: prompt,
  };
}

/**
 * 处理 RocketMQ 导入逻辑
 */
async function handleRocketMqImport(
  context: CommandContext
): Promise<SlashCommandActionReturn | void> {
  const workspaceRoot = process.cwd();

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `正在配置 RocketMQ 接入...\n当前工作目录: ${workspaceRoot}`,
    },
    Date.now(),
  );

  // 第一步：查找domain模块的 pom.xml 文件（用于添加依赖）
  const domainPomPath = await findDomainModulePomFile(workspaceRoot);
  if (!domainPomPath) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到 domain 模块的 pom.xml 文件\n\n请确保项目中存在名称包含 "domain" 的模块目录`,
      },
      Date.now(),
    );
    return;
  }

  // 第二步：查找模块的 pom.xml 文件（用于其他配置）
  const pomPath = await findModulePomFile(workspaceRoot);
  if (!pomPath) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到 infrastructure 模块的 pom.xml 文件\n\n请确保项目中存在名称包含 "infrastructure" 或 "infra" 的模块目录`,
      },
      Date.now(),
    );
    return;
  }

  // 第三步：查找 infrastructure 目录（用于创建配置类）
  const infraDir = await findInfraDirectory(workspaceRoot);
  if (!infraDir) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到 infrastructure 或 infra 目录（Java包结构）`,
      },
      Date.now(),
    );
    return;
  }

  // 第四步：查找 domain 目录（用于创建事件处理类）
  const domainDir = await findDomainDirectory(workspaceRoot);
  if (!domainDir) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到 domain 目录（Java包结构）`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 找到 domain 模块 pom.xml: ${domainPomPath}`,
    },
    Date.now(),
  );

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 找到 infrastructure 模块 pom.xml: ${pomPath}`,
    },
    Date.now(),
  );

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 找到 infrastructure 目录: ${infraDir}`,
    },
    Date.now(),
  );

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 找到 domain 目录: ${domainDir}`,
    },
    Date.now(),
  );

  // 第五步：检查顶层 pom.xml 中的 infra-root-pom 依赖
  const mainPomPath = path.join(workspaceRoot, 'pom.xml');
  if (!(await fileExists(mainPomPath))) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 未找到顶层 pom.xml 文件: ${mainPomPath}`,
      },
      Date.now(),
    );
    return;
  }

  const mainPomContent = await readPomXml(mainPomPath);
  if (!mainPomContent) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 无法读取顶层 pom.xml 文件: ${mainPomPath}`,
      },
      Date.now(),
    );
    return;
  }

  if (!checkInfraRootPom(mainPomContent)) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 顶层 pom.xml 中未检测到 infra-root-pom 依赖。\n\n请先接入 infra-root-pom，参考文档：https://docs.xiaohongshu.com/doc/2cc2c53888b7b1bc5b2d91f98a222d8b\n\n接入 infra-root-pom 后，再次运行此命令。`,
      },
      Date.now(),
    );
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `✅ 检测到 infra-root-pom 依赖`,
    },
    Date.now(),
  );

  // 第六步：读取 domain 模块 pom.xml 并检查 events-client 依赖
  const domainPomContent = await readPomXml(domainPomPath);
  if (!domainPomContent) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: `❌ 无法读取 domain 模块 pom.xml 文件: ${domainPomPath}`,
      },
      Date.now(),
    );
    return;
  }

  const eventsClientExists = checkDependencyExists(domainPomContent, 'com.xiaohongshu', 'events-client');

  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: eventsClientExists 
        ? `✅ events-client 依赖已存在` 
        : `⚠️ events-client 依赖不存在，将添加`,
    },
    Date.now(),
  );

  // 第七步：检查配置类目录
  const configDir = path.join(infraDir, 'config/mq');
  const configDirExists = await directoryExists(configDir);

  if (configDirExists) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `✅ 配置类目录已存在: ${configDir}`,
      },
      Date.now(),
    );
  } else {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: `⚠️ 需要创建配置类目录: ${configDir}`,
      },
      Date.now(),
    );
  }

  // 使用大模型完成完整的 RocketMQ 接入配置
  context.ui.addItem(
    {
      type: MessageType.INFO,
      text: `RDMind正在接入RocketMQ...`,
    },
    Date.now(),
  );

  // 生成完整的 RocketMQ 接入提示词
  const prompt = generateRocketMqSetupPrompt(
    domainPomPath,
    domainPomContent,
    infraDir,
    workspaceRoot,
    domainDir,
    eventsClientExists,
    configDirExists
  );

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
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn | void> => {
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
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn | void> => {
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
  action: async (context: CommandContext, _args: string): Promise<SlashCommandActionReturn | void> => 
    await handleRedisImport(context),
};

/**
 * RocketMQ 子命令
 */
const rocketMqCommand: SlashCommand = {
  name: 'rocketmq',
  description: '为Java项目接入RocketMQ消息中间件',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, _args: string): Promise<SlashCommandActionReturn | void> => 
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
  action: async (context: CommandContext, args: string): Promise<SlashCommandActionReturn | void> => {
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
