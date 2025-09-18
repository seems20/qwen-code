# MyBatis代码生成规范

## 文件位置规范

### 文件生成位置

- `{Entity}Mapper.xml` → `infrastructure/resources/mapper/`
- `{Entity}Mapper.java` → `infrastructure/mapper/`
- `{Entity}DO.java` → `infrastructure/model/`

### 目录结构示例

```
infrastructure/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── xiaohongshu/
│   │   │           └── sns/
│   │   │               └── demo/
│   │   │                   └── infrastructure/
│   │   │                       ├── mapper/          ← Mapper.java
│   │   │                       └── model/           ← DO.java
│   │   └── resources/
│   │       └── mapper/                              ← Mapper.xml
```

---

## Mapper.java规范

### 强制要求

1. **注解标注**：必须使用 `@Mapper` 和 `@Repository` 注解
2. **方法命名**：使用业务语义命名，如 `findBy{Field}`、`selectBy{Field}`
3. **参数类型**：使用DO对象或基本类型，避免使用Map等不明确类型

### 代码示例

```java
@Mapper
@Repository
public interface CircleMapper {

    /**
     * 根据ID查询圈子
     */
    CircleDO findById(Long id);

    /**
     * 根据名称查询圈子
     */
    CircleDO findByName(String name);

    /**
     * 根据状态查询圈子列表
     */
    List<CircleDO> findByStatus(Integer status);

    /**
     * 插入圈子
     */
    int insert(CircleDO circle);

    /**
     * 更新圈子
     */
    int updateById(CircleDO circle);

    /**
     * 根据ID删除圈子
     */
    int deleteById(Long id);

    /**
     * 统计圈子数量
     */
    int count();

    /**
     * 根据状态统计圈子数量
     */
    int countByStatus(Integer status);
}
```

### 方法命名规范

- **基础CRUD**：`findById`、`insert`、`updateById`、`deleteById`
- **业务查询**：`findBy{Field}`、`findBy{Field}And{Field}`、`findBy{Field}Like`
- **分页查询**：`findBy{Field}AndPage`、`findByPage`
- **统计查询**：`count`、`countBy{Field}`、`existsBy{Field}`
- **批量操作**：`findBy{Field}s`、`deleteBy{Field}s`

---

## Mapper.xml规范

### 强制要求

1. **结果映射**：定义 `BaseResultMap` 覆盖全量字段，显式指定 `jdbcType`
2. **字段列表**：定义 `Base_Column_List`，查询通过 `<include refid="Base_Column_List"/>` 引用
3. **插入操作**：使用 `useGeneratedKeys="true" keyProperty="id"`
4. **查询条件**：使用 `<where>` + `<if>` 构造条件，防止全表扫描
5. **禁用`select *`**：必须显式引用字段列表

### 代码示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.xiaohongshu.sns.demo.infrastructure.mapper.CircleMapper">

    <!-- 结果映射 -->
    <resultMap id="BaseResultMap" type="com.xiaohongshu.sns.demo.infrastructure.model.CircleDO">
        <id column="id" jdbcType="BIGINT" property="id"/>
        <result column="name" jdbcType="VARCHAR" property="name"/>
        <result column="description" jdbcType="VARCHAR" property="description"/>
        <result column="status" jdbcType="TINYINT" property="status"/>
        <result column="create_time" jdbcType="TIMESTAMP" property="createTime"/>
        <result column="update_time" jdbcType="TIMESTAMP" property="updateTime"/>
    </resultMap>

    <!-- 字段列表 -->
    <sql id="Base_Column_List">
        id, name, description, status, create_time, update_time
    </sql>

    <!-- 根据ID查询 -->
    <select id="findById" parameterType="java.lang.Long" resultMap="BaseResultMap">
        SELECT
        <include refid="Base_Column_List"/>
        FROM circle
        WHERE id = #{id,jdbcType=BIGINT}
    </select>

    <!-- 根据名称查询 -->
    <select id="findByName" parameterType="java.lang.String" resultMap="BaseResultMap">
        SELECT
        <include refid="Base_Column_List"/>
        FROM circle
        WHERE name = #{name,jdbcType=VARCHAR}
    </select>

    <!-- 根据状态查询列表 -->
    <select id="findByStatus" parameterType="java.lang.Integer" resultMap="BaseResultMap">
        SELECT
        <include refid="Base_Column_List"/>
        FROM circle
        WHERE status = #{status,jdbcType=TINYINT}
    </select>

    <!-- 插入 -->
    <insert id="insert" parameterType="com.xiaohongshu.sns.demo.infrastructure.model.CircleDO" useGeneratedKeys="true" keyProperty="id">
        INSERT INTO circle (name, description, status, create_time, update_time)
        VALUES (#{name,jdbcType=VARCHAR}, #{description,jdbcType=VARCHAR}, #{status,jdbcType=TINYINT},
                #{createTime,jdbcType=TIMESTAMP}, #{updateTime,jdbcType=TIMESTAMP})
    </insert>

    <!-- 更新 -->
    <update id="updateById" parameterType="com.xiaohongshu.sns.demo.infrastructure.model.CircleDO">
        UPDATE circle
        <set>
            <if test="name != null">
                name = #{name,jdbcType=VARCHAR},
            </if>
            <if test="description != null">
                description = #{description,jdbcType=VARCHAR},
            </if>
            <if test="status != null">
                status = #{status,jdbcType=TINYINT},
            </if>
            update_time = #{updateTime,jdbcType=TIMESTAMP}
        </set>
        WHERE id = #{id,jdbcType=BIGINT}
    </update>

    <!-- 删除 -->
    <delete id="deleteById" parameterType="java.lang.Long">
        DELETE FROM circle
        WHERE id = #{id,jdbcType=BIGINT}
    </delete>

    <!-- 统计数量 -->
    <select id="count" resultType="java.lang.Integer">
        SELECT COUNT(1) FROM circle
    </select>

    <!-- 根据状态统计数量 -->
    <select id="countByStatus" parameterType="java.lang.Integer" resultType="java.lang.Integer">
        SELECT COUNT(1) FROM circle
        WHERE status = #{status,jdbcType=TINYINT}
    </select>

</mapper>
```

### 关键规范说明

#### 结果映射规范

- 必须定义 `BaseResultMap` 覆盖全量字段
- 显式指定 `jdbcType` 和 `property`
- 主键使用 `<id>` 标签，其他字段使用 `<result>` 标签

#### 字段列表规范

- 定义 `Base_Column_List` 包含所有字段
- 查询时通过 `<include refid="Base_Column_List"/>` 引用
- 禁止使用 `SELECT *`

#### 插入操作规范

- 使用 `useGeneratedKeys="true" keyProperty="id"`
- 显式指定字段列表
- 为每个参数指定 `jdbcType`

#### 更新操作规范

- 使用 `<set>` 和 `<if>` 构造动态更新
- 自动更新 `update_time` 字段
- 避免更新空值

---

## DO规范

### 强制要求

1. **字段对应**：字段与表结构严格对应
2. **中文注释**：必须带中文注释，来源于表字段注释
3. **Lombok注解**：必须使用 `@Data`、`@AllArgsConstructor`、`@NoArgsConstructor`

### 代码示例

```java
package com.xiaohongshu.sns.demo.infrastructure.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * 圈子数据对象
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
public class CircleDO {

    /**
     * 主键ID
     */
    private Long id;

    /**
     * 圈子名称
     */
    private String name;

    /**
     * 圈子描述
     */
    private String description;

    /**
     * 圈子状态：0-禁用，1-启用
     */
    private Integer status;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
```

### 字段类型映射

| 数据库类型   | Java类型        | 说明           |
| ------------ | --------------- | -------------- |
| **BIGINT**   | `Long`          | 主键ID、外键ID |
| **VARCHAR**  | `String`        | 字符串字段     |
| **TEXT**     | `String`        | 长文本字段     |
| **TINYINT**  | `Integer`       | 状态字段       |
| **INT**      | `Integer`       | 整数字段       |
| **DECIMAL**  | `BigDecimal`    | 金额字段       |
| **DATETIME** | `LocalDateTime` | 时间字段       |
| **DATE**     | `LocalDate`     | 日期字段       |

---

## 常见MyBatis错误

### 缺少注解错误

❌ **错误**：Mapper接口缺少必要的注解  
✅ **正确**：必须使用@Mapper和@Repository注解

**解决方案**：

```java
❌ 错误示例：
public interface CircleMapper { // 错误：缺少注解
    CircleDO findById(Long id);
}

✅ 正确示例：
@Mapper
@Repository
public interface CircleMapper { // 正确：包含必要注解
    CircleDO findById(Long id);
}
```

### 使用select \*错误

❌ **错误**：在Mapper.xml中使用SELECT \*  
✅ **正确**：必须显式引用字段列表

**解决方案**：

```xml
❌ 错误示例：
<select id="findById" resultMap="BaseResultMap">
    SELECT * FROM circle WHERE id = #{id}  <!-- 错误：使用SELECT * -->
</select>

✅ 正确示例：
<select id="findById" resultMap="BaseResultMap">
    SELECT
    <include refid="Base_Column_List"/>  <!-- 正确：引用字段列表 -->
    FROM circle WHERE id = #{id}
</select>
```

### 缺少jdbcType错误

❌ **错误**：参数缺少jdbcType指定  
✅ **正确**：必须为每个参数指定jdbcType

**解决方案**：

```xml
❌ 错误示例：
<select id="findById" resultMap="BaseResultMap">
    SELECT * FROM circle WHERE id = #{id}  <!-- 错误：缺少jdbcType -->
</select>

✅ 正确示例：
<select id="findById" resultMap="BaseResultMap">
    SELECT
    <include refid="Base_Column_List"/>
    FROM circle WHERE id = #{id,jdbcType=BIGINT}  <!-- 正确：指定jdbcType -->
</select>
```

### 缺少useGeneratedKeys错误

❌ **错误**：插入操作缺少useGeneratedKeys配置  
✅ **正确**：必须配置useGeneratedKeys和keyProperty

**解决方案**：

```xml
❌ 错误示例：
<insert id="insert" parameterType="CircleDO">
    INSERT INTO circle (name, description) VALUES (#{name}, #{description})  <!-- 错误：缺少useGeneratedKeys -->
</insert>

✅ 正确示例：
<insert id="insert" parameterType="CircleDO" useGeneratedKeys="true" keyProperty="id">  <!-- 正确：配置useGeneratedKeys -->
    INSERT INTO circle (name, description) VALUES (#{name,jdbcType=VARCHAR}, #{description,jdbcType=VARCHAR})
</insert>
```

---

## 质量检查清单

### MyBatis代码检查

- [ ] Mapper.java是否使用了@Mapper和@Repository注解？
- [ ] 方法命名是否遵循了业务语义规范？
- [ ] 是否避免了使用Map等不明确类型？
- [ ] Mapper.xml是否定义了BaseResultMap？
- [ ] 是否定义了Base_Column_List？
- [ ] 是否避免了使用SELECT \*？
- [ ] 是否为每个参数指定了jdbcType？
- [ ] 插入操作是否配置了useGeneratedKeys？
- [ ] 更新操作是否使用了动态SQL？
- [ ] DO类是否使用了Lombok注解？
- [ ] 字段类型是否与数据库类型对应？
- [ ] 是否添加了必要的中文注释？

### 数据库规范检查

- [ ] 是否生成了完整的MyBatis映射文件？
- [ ] 是否包含了必要的注释和校验？
- [ ] 是否实现了领域对象与DO的双向转换？
