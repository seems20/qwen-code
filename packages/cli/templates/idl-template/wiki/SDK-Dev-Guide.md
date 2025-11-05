# SDK开发指南

## 工程结构

关键文件目录如下（以[example](example)为例）：

```
├── .gitlab-ci.yml // 必须，Gitlab CI配置文件
├── maven_project  // Java项目必须，实际打包的基础目录，结构遵循maven约定
│   ├── pom.xml     // 必须指定sdk的maven坐标和依赖等
│   ├── src         // java源文件的存放目录
├── hello.thrift  // 必须，thrift idl文件
└── sdk-spec.yml  // 必须，sdk配置文件，包括依赖版本和编译选项等

```

sdk-spec.yml:

```
dependencies:
  sns-idls/base: 1.1.7      # 依赖sns-idls/base项目，tag为1.1.7
build:
  go:
    enabled: true           # 是否开启go编译 [gosdk](https://wiki.xiaohongshu.com/pages/viewpage.action?pageId=43487207)
  recurse: true or false    # 是否递归编译引用的thrift文件（默认会将com.xiaohongshu.infra.rpc.base包删除）
                            # 使用recurse参数，需要将build:go的image升级为docker-reg.devops.xiaohongshu.com/shequ/sns-gosdk-ci:feature-onlyGo-20211222-345b8798

```

thrift idl开发参考[Thrift IDL开发规范](./README.md)

## 发布

1. `commit push`和`tag`都会触发gitlab ci自动编译、打包、发布，过程可在Pipelines->Jobs中查看。
2. `commit push`会发布SNAPSHOT版本，artifact version为：`分支名-SNAPSHOT`（**分支名中的`'/'`会替换为`'-'`**）。
3. `tag`会发布RELEASE版本，artifact version为：`${tag_name}`（**${tag_name}必须符合正则表达式：`/^\d+\.\d+\.\d+$/`，如`1.2.3`**）。

如：

- 分支`feature/add-field` ，对应version为`feature-add-field-SNAPSHOT`。
- tag`1.2.3`，对应version为`1.2.3`。

## 工作流

1. 开发阶段，sdk项目检出开发分支，项目中使用SNAPSHOT版本的sdk依赖。
2. 开发完毕，将开发分支合入master，打tag（如`$ git tag -a 1.2.3 -m 'my version 1.2.3'`），项目中改为使用RELEASE版本的sdk依赖。

## 定制化

Java sdk会以`maven_project`目录作为打包的基础目录，因此可以在目录中添加代码来定制sdk的功能。

例如，使用[SpringBoot AutoConfiguration](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-developing-auto-configuration.html)为sdk开发自动配置功能，参考[例子](example)。

## 常见问题

1. Invalid remote: origin

   The project you were looking for could not be found.

   原因是CI任务没有该项目的权限，需要开启 CI Deploy Key:
   项目首页 -> Settings -> Repository -> Deploy Keys -> enable deploy key: sns-sdk-ci-base & sns-sdk-ci
