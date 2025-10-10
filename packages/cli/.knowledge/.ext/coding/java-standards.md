# Java开发规范

## 值对象设计规范

### 重要约束

**重要：值对象必须有足够的业务语义和多个字段，单个字段的值对象应该直接使用原始类型**

### 值对象设计决策矩阵

| 字段数量    | 业务语义                   | 推荐方案                | 说明                         |
| ----------- | -------------------------- | ----------------------- | ---------------------------- |
| **1个字段** | 简单存储、标识、状态、计数 | ❌ **直接使用原始类型** | 避免为单个字段创建封装类     |
| **2个字段** | 相关概念组合               | ✅ **创建值对象**       | 当字段之间存在业务关联时     |
| **3+字段**  | 复杂业务概念               | ✅ **创建值对象**       | 当字段组合表达完整业务含义时 |

### 禁止创建的值对象类型

- ❌ **单字段封装**：任何只包含一个字段的封装类，无论字段类型
- ❌ **无业务逻辑封装**：仅为了封装而封装，不包含验证规则或业务行为
- ❌ **业务概念封装**：CircleName、CircleDescription、CircleAvatar等单字段封装

### 推荐使用的原始类型

- **基础数据类型**：`String`、`Integer`、`Long`、`Boolean`、`BigDecimal`
- **时间类型**：`LocalDateTime`、`LocalDate`、`LocalTime`
- **集合类型**：`List<T>`、`Set<T>`、`Map<K,V>`
- **枚举类型**：直接使用`enum`或`Integer`、`String`表示

---

## Lombok使用规范

### 强制要求

**重要：所有实体类和值对象必须使用Lombok注解，禁止手动实现getter、setter、toString等方法**

### 必须使用的Lombok注解

- **@Data**：自动生成getter、setter、toString、equals、hashCode方法
- **@AllArgsConstructor**：生成包含所有字段的构造函数
- **@NoArgsConstructor**：生成无参构造函数
- **@Builder**：生成Builder模式（可选，用于复杂对象）

### 禁止手动实现的方法

- ❌ **getter方法**：不要手动实现getName()、getId()等方法
- ❌ **setter方法**：不要手动实现setName()、setId()等方法
- ❌ **toString方法**：不要手动实现toString()方法
- ❌ **equals方法**：不要手动实现equals()方法
- ❌ **hashCode方法**：不要手动实现hashCode()方法

---

## 分层设计规范

### App层设计规范（强制要求）

**重要：App层必须设计为接口+实现类的模式，遵循依赖倒置原则**

#### App层接口设计

- **接口命名**：`{Entity}AppService`，定义业务操作接口
- **职责范围**：协调领域对象完成用户用例，处理事务
- **方法签名**：使用Thrift DTO作为参数和返回值
- **依赖关系**：依赖domain层接口，不依赖具体实现

#### App层实现类设计

- **实现类命名**：`{Entity}AppServiceImpl`，实现业务操作接口
- **注解标注**：使用`@Service`注解标记为Spring服务
- **依赖注入**：通过`@Resource`注入domain层服务
- **事务处理**：在方法级别处理事务边界

### Repository层设计规范（强制要求）

**重要：Repository层是领域对象存储的抽象，必须设计为接口+实现类模式**

#### Repository接口设计

- **接口命名**：`{Entity}Repository`，在Domain层定义
- **职责范围**：领域对象的存储和检索，提供领域友好的接口
- **方法命名**：使用业务语义命名，如`findByCircleId`、`existsByName`
- **返回类型**：返回领域对象或领域对象集合，不返回技术细节

#### Repository接口方法规范

- **基础CRUD**：`save`、`findById`、`deleteById`
- **业务查询**：`findBy{Field}`、`findBy{Field}And{Field}`、`findBy{Field}Like`
- **分页查询**：`findBy{Field}AndPage`、`findByPage`
- **统计查询**：`count`、`countBy{Field}`、`existsBy{Field}`
- **批量操作**：`findBy{Field}s`、`deleteBy{Field}s`

### DAO层设计规范（强制要求）

**重要：DAO层是数据访问的具体实现，负责与数据库的交互和异常处理**

#### DAO类设计

- **类命名**：`{Entity}Dao`，在Infrastructure层实现
- **注解标注**：使用`@Component`注解标记为Spring组件
- **职责范围**：数据库操作、参数校验、异常处理、日志记录
- **依赖关系**：依赖对应的Mapper接口，不依赖其他业务组件

#### DAO异常处理规范

- **参数校验异常**：记录warn级别日志，返回默认值
- **数据库异常**：记录error级别日志，返回默认值
- **返回值一致性**：查询方法异常返回null，删除方法异常返回false

---

## Java包路径规范

### 包路径格式

**标准格式：** `com.xiaohongshu.sns.{project}.{模块}.{子层}`

### 模块划分

- **app** - 应用服务层
- **common** - 通用组件层
- **domain** - 领域层
- **infrastructure** - 基础设施层
- **start** - 启动层

### 子层职责

- **service** - 业务服务
- **dao** - 数据访问对象
- **mapper** - MyBatis映射器
- **model** - 数据模型
- **repository** - 仓储接口和实现
- **config** - 配置类
- **constant** - 常量定义

---

## 常见Java错误

### 值对象设计错误

❌ **错误**：为单个字段创建封装类（如CircleName、CircleDescription）  
✅ **正确**：单个字段直接使用原始类型（String、Integer、Long等）

**解决方案**：

```java
❌ 错误示例：
public class CircleName {
    private String value;

    public CircleName(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}

✅ 正确示例：
public class Circle {
    private String name; // 直接使用String类型

    public Circle(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }
}
```

### 手动实现方法错误

❌ **错误**：手动实现getter、setter、toString等方法  
✅ **正确**：使用@Data注解自动生成这些方法

**解决方案**：

```java
❌ 错误示例：
public class Circle {
    private String name;

    public String getName() { // 错误：手动实现getter
        return name;
    }

    public void setName(String name) { // 错误：手动实现setter
        this.name = name;
    }

    @Override
    public String toString() { // 错误：手动实现toString
        return "Circle{name='" + name + "'}";
    }
}

✅ 正确示例：
@Data
@AllArgsConstructor
@NoArgsConstructor
public class Circle {
    private String name;
    // Lombok自动生成getter、setter、toString等方法
}
```

### 包路径不一致错误

❌ **错误**：包路径与目录结构不一致  
✅ **正确**：包路径必须与物理目录结构完全一致

**解决方案**：

```java
❌ 错误示例：
// 文件路径：src/main/java/com/xiaohongshu/sns/demo/Circle.java
package com.xiaohongshu.sns.circle; // 错误：包路径与目录不一致

✅ 正确示例：
// 文件路径：src/main/java/com/xiaohongshu/sns/demo/Circle.java
package com.xiaohongshu.sns.demo; // 正确：包路径与目录一致
```

### 模块选择错误

❌ **错误**：在错误的模块下生成代码  
✅ **正确**：必须根据业务逻辑选择正确的模块

**解决方案**：

```bash
❌ 错误示例：
# 在common模块下生成业务逻辑代码
common/src/main/java/com/xiaohongshu/sns/demo/service/CircleService.java

✅ 正确示例：
# 在app模块下生成业务逻辑代码
app/src/main/java/com/xiaohongshu/sns/demo/service/CircleService.java
```

---

## 文件操作规范

### Java项目目录结构规范（强制要求）

**重要：源代码必须放在正确的src目录下，绝对禁止在target目录下生成代码**

#### 正确的目录结构

```
{project}/
├── {module}/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/          ← ✅ 源代码目录
│   │   │   └── resources/     ← ✅ 资源文件目录
│   │   └── test/
│   │       └── java/          ← ✅ 测试代码目录
│   └── target/                ← ❌ 禁止在此目录生成代码
```

#### 源代码生成位置规范

| 文件类型       | 正确位置                     | 错误位置     |
| -------------- | ---------------------------- | ------------ |
| **Java类文件** | `src/main/java/`             | ❌ `target/` |
| **Mapper.xml** | `src/main/resources/mapper/` | ❌ `target/` |
| **SQL文件**    | `src/main/resources/sql/`    | ❌ `target/` |
| **配置文件**   | `src/main/resources/`        | ❌ `target/` |
| **测试文件**   | `src/test/java/`             | ❌ `target/` |

### 路径规范

- **绝对路径优先**：所有文件操作使用绝对路径
- **路径一致性**：确保不同工具的路径参数指向同一物理文件
- **src目录优先**：Java源代码必须放在src目录下

---

## 质量检查清单

### Java开发检查

- [ ] 值对象设计是否合理？（避免单字段无意义封装）
- [ ] 是否优先使用原始类型而非过度封装？
- [ ] 是否使用了@Data注解而非手动实现方法？
- [ ] 是否避免了CircleName、CircleDescription等单字段封装？
- [ ] App层是否设计为接口+实现类模式？
- [ ] App层实现类是否使用@Service注解？
- [ ] Repository层是否设计为接口+实现类模式？
- [ ] Repository接口是否在Domain层定义？
- [ ] DAO层是否使用@Component注解？
- [ ] DAO层是否包含完整的异常处理？
- [ ] 包路径是否与目录结构一致？
- [ ] 是否在正确的模块下生成代码？

### 文件操作检查

- [ ] 是否遵守了文件路径规范？
- [ ] Java代码是否放在正确的src目录下？
- [ ] 是否避开了target目录？
- [ ] 包路径是否与目录结构一致？
