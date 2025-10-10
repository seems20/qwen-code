# SQL建表规范

## 基本要求

在 `infra` 模块的 `resources/sql` 目录中，依据业务描述生成对应的 `.sql` 建表文件。

---

## 标准字段

### 必须包含的字段

```sql
id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
```

### 字段说明

- **id**：主键ID，使用BIGINT UNSIGNED AUTO_INCREMENT
- **create_time**：创建时间，自动设置为当前时间
- **update_time**：更新时间，自动更新为当前时间

---

## 字段规范

### 字段定义规则

- **非空约束**：除自增主键或业务确需可空字段外，字段应尽量声明 `NOT NULL`
- **默认值**：数值`0`、字符串`''`、布尔`TINYINT(1) DEFAULT 0`
- **索引约束**：**禁止**在字段定义中直接添加PRIMARY KEY、UNIQUE、INDEX等约束
- **字段定义**：字段定义只包含数据类型、非空约束、默认值和注释

### 字段类型规范

| 数据类型            | 使用场景       | 示例                                                      |
| ------------------- | -------------- | --------------------------------------------------------- |
| **BIGINT UNSIGNED** | 主键ID、外键ID | `id BIGINT UNSIGNED AUTO_INCREMENT`                       |
| **VARCHAR(n)**      | 字符串字段     | `name VARCHAR(100) NOT NULL`                              |
| **TEXT**            | 长文本字段     | `description TEXT`                                        |
| **TINYINT(1)**      | 布尔字段       | `status TINYINT(1) NOT NULL DEFAULT 0`                    |
| **INT**             | 整数字段       | `count INT NOT NULL DEFAULT 0`                            |
| **DECIMAL(p,s)**    | 金额字段       | `amount DECIMAL(10,2) NOT NULL DEFAULT 0.00`              |
| **DATETIME**        | 时间字段       | `create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` |

---

## 索引定义规范

### 强制要求

**重要：所有索引必须在建表语句末尾单独定义，不得在字段上直接约束**

### 索引定义位置

```sql
CREATE TABLE {table_name} (
    -- 字段定义（不包含索引约束）
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    name VARCHAR(100) NOT NULL COMMENT '名称',
    status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '状态',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 索引定义（单独在末尾定义）
    PRIMARY KEY (id),
    UNIQUE KEY uk_name (name),
    KEY idx_status (status),
    KEY idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='表注释';
```

### 索引命名规范

- **主键索引**：`PRIMARY KEY (id)` - 不命名
- **唯一索引**：`UNIQUE KEY uk_{field_name} ({field_name})`
- **普通索引**：`KEY idx_{field_name} ({field_name})`
- **复合索引**：`KEY idx_{field1}_{field2} ({field1}, {field2})`
- **外键索引**：`KEY idx_{field_name} ({field_name})`

### 索引创建策略

基于常用查询和性能因素，考虑创建以下索引：

1. **主键索引**：必须创建，通常为id字段
2. **唯一索引**：业务唯一字段（如用户名、邮箱、手机号等）
3. **查询索引**：高频查询字段（如状态、类型、创建时间等）
4. **排序索引**：经常用于排序的字段（如创建时间、更新时间等）
5. **复合索引**：多字段组合查询（如状态+类型+时间范围等）
6. **外键索引**：关联查询字段（如用户ID、分类ID等）

### 索引性能考虑

- **选择性**：优先为选择性高的字段创建索引
- **查询模式**：根据实际查询SQL创建合适的索引
- **更新频率**：避免为频繁更新的字段创建过多索引
- **索引数量**：单表索引数量控制在5个以内
- **复合索引顺序**：遵循最左前缀原则

---

## 技术标准

### 数据库标准

- 遵循 MySQL 5.7 语法
- 统一使用 InnoDB 存储引擎
- 统一使用 utf8mb4 字符集
- 统一使用 utf8mb4_general_ci 排序规则

### 建表语句模板

```sql
CREATE TABLE {table_name} (
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    -- 业务字段定义
    name VARCHAR(100) NOT NULL COMMENT '名称',
    status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '状态',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    -- 索引定义
    PRIMARY KEY (id),
    UNIQUE KEY uk_name (name),
    KEY idx_status (status),
    KEY idx_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='表注释';
```

---

## 常见SQL错误

### 索引定义错误

❌ **错误**：在字段定义中直接添加索引约束  
✅ **正确**：在建表语句末尾单独定义索引

**解决方案**：

```sql
❌ 错误示例：
CREATE TABLE circle (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, -- 错误：在字段上直接约束
    name VARCHAR(100) NOT NULL UNIQUE,             -- 错误：在字段上直接约束
    status TINYINT(1) NOT NULL DEFAULT 0
);

✅ 正确示例：
CREATE TABLE circle (
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    name VARCHAR(100) NOT NULL COMMENT '名称',
    status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '状态',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (id),
    UNIQUE KEY uk_name (name),
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='圈子表';
```

### 缺少标准字段错误

❌ **错误**：缺少create_time和update_time字段  
✅ **正确**：必须包含标准字段

**解决方案**：

```sql
❌ 错误示例：
CREATE TABLE circle (
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    name VARCHAR(100) NOT NULL COMMENT '名称'
    -- 缺少create_time和update_time字段
);

✅ 正确示例：
CREATE TABLE circle (
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    name VARCHAR(100) NOT NULL COMMENT '名称',
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
);
```

### 索引命名错误

❌ **错误**：索引命名不规范  
✅ **正确**：遵循索引命名规范

**解决方案**：

```sql
❌ 错误示例：
CREATE TABLE circle (
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    name VARCHAR(100) NOT NULL COMMENT '名称',
    status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '状态',

    PRIMARY KEY (id),
    UNIQUE KEY name_unique (name),    -- 错误：命名不规范
    KEY status_index (status)         -- 错误：命名不规范
);

✅ 正确示例：
CREATE TABLE circle (
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    name VARCHAR(100) NOT NULL COMMENT '名称',
    status TINYINT(1) NOT NULL DEFAULT 0 COMMENT '状态',

    PRIMARY KEY (id),
    UNIQUE KEY uk_name (name),        -- 正确：遵循命名规范
    KEY idx_status (status)           -- 正确：遵循命名规范
);
```

### 字符集错误

❌ **错误**：使用错误的字符集或存储引擎  
✅ **正确**：使用标准的技术配置

**解决方案**：

```sql
❌ 错误示例：
CREATE TABLE circle (
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    name VARCHAR(100) NOT NULL COMMENT '名称'
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='圈子表'; -- 错误：使用MyISAM和utf8

✅ 正确示例：
CREATE TABLE circle (
    id BIGINT UNSIGNED AUTO_INCREMENT COMMENT '主键ID',
    name VARCHAR(100) NOT NULL COMMENT '名称'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='圈子表'; -- 正确：使用InnoDB和utf8mb4
```

---

## 质量检查清单

### SQL建表检查

- [ ] 是否包含了标准字段（id、create_time、update_time）？
- [ ] 是否在字段定义中避免了索引约束？
- [ ] 是否在建表语句末尾单独定义了索引？
- [ ] 是否遵循了索引命名规范？
- [ ] 是否使用了正确的数据类型？
- [ ] 是否设置了合适的默认值？
- [ ] 是否使用了InnoDB存储引擎？
- [ ] 是否使用了utf8mb4字符集？
- [ ] 是否添加了必要的注释？
- [ ] 是否考虑了索引性能？

### 数据库规范检查

- [ ] 是否遵循了MySQL 5.7语法？
- [ ] 是否使用了InnoDB存储引擎？
- [ ] 是否使用了utf8mb4字符集？
- [ ] 是否使用了utf8mb4_general_ci排序规则？
