# DDD架构规范

## 架构分层

### 分层结构

| 层级               | 职责                             | 依赖关系                              |
| ------------------ | -------------------------------- | ------------------------------------- |
| **start**          | 应用启动入口、Thrift协议暴露     | 依赖 app 层                           |
| **app**            | 应用服务层、协调领域对象完成用例 | 依赖 domain 层，可依赖 Thrift DTO     |
| **domain**         | 领域层、核心业务逻辑             | **不依赖任何外部DTO，只使用领域对象** |
| **infrastructure** | 基础设施层、技术细节实现         | 依赖 domain 层接口                    |
| **common**         | 通用组件层、工具类和常量         | 无外部依赖                            |

### 分层职责详解

#### Start层（启动层）

- **职责**：应用启动、Thrift服务暴露、请求路由
- **特点**：只负责协议转换，不包含业务逻辑
- **依赖**：仅依赖App层

#### App层（应用服务层）

- **职责**：协调领域对象完成用户用例、事务管理
- **特点**：可以依赖Thrift DTO，负责DTO与领域对象转换
- **依赖**：依赖Domain层接口

#### Domain层（领域层）

- **职责**：核心业务逻辑、领域规则、业务概念
- **特点**：纯业务逻辑，无外部技术依赖
- **依赖**：不依赖任何外部技术

#### Infrastructure层（基础设施层）

- **职责**：数据持久化、外部服务调用、技术实现
- **特点**：实现Domain层定义的接口
- **依赖**：依赖Domain层接口

#### Common层（通用组件层）

- **职责**：工具类、常量、通用组件
- **特点**：无业务逻辑，可被各层使用
- **依赖**：无外部依赖

---

## 依赖关系约束

### 核心原则

**严格遵循依赖倒置原则，确保领域层不被外部技术细节污染**

### 依赖规则

- **domain 层**：核心业务逻辑，**绝对不允许**依赖 Thrift DTO、外部API、数据库等
- **app 层**：可以依赖 Thrift DTO（如 `xxxReq`、`xxxResp`），负责DTO与领域对象的转换
- **infra 层**：实现 domain 层定义的接口，不能反向依赖 domain 层
- **start 层**：只依赖 app 层，不直接调用 domain 层

### 依赖方向图

```
Start层 → App层 → Domain层 ← Infrastructure层
   ↓        ↓        ↑
Common层 ← Common层 ← Common层
```

---

## 分层实现规范

### 实现顺序（必须遵循）

1. **第一优先级**：实现 domain 层（核心业务逻辑，无外部依赖）
2. **第二优先级**：实现 infra 层（实现 domain 层接口）
3. **第三优先级**：实现 app 层（协调 domain 层，依赖 infra 层）
4. **第四优先级**：实现 start 层（依赖 app 层，暴露 Thrift 接口）

### 依赖处理策略

**当需要调用下层依赖或外部依赖时，必须先生成TODO说明，而不是立即实现**

```java
// TODO标记规范
// TODO: 依赖 [模块名].[类名].[方法名]
// 说明：此方法需要调用[具体描述]
// 实现时机：在[具体层]实现完成后实现
// 当前状态：等待依赖实现
```

### 分层调用流程

```
Start层 (Thrift DTO) → App层 (DTO转换) → Domain层 (领域对象) → Infrastructure层
```

---

## 常见架构错误

### Domain层依赖错误

❌ **错误**：Domain层直接使用Thrift DTO  
✅ **正确**：Domain层只使用领域对象，App层负责DTO转换

**解决方案**：

```java
// ❌ 错误示例
public class CircleDomainService {
    public void createCircle(CreateCircleReq request) { // 错误：直接使用Thrift DTO
        // 业务逻辑
    }
}

// ✅ 正确示例
public class CircleDomainService {
    public void createCircle(Circle circle) { // 正确：使用领域对象
        // 业务逻辑
    }
}
```

### App层DTO创建错误

❌ **错误**：App层创建新的入参/出参DTO  
✅ **正确**：App层直接使用Thrift DTO，不创建新对象

**解决方案**：

```java
// ❌ 错误示例
public class CircleAppServiceImpl {
    public CreateCircleResult createCircle(CreateCircleRequest request) { // 错误：创建新DTO
        // 业务逻辑
    }
}

// ✅ 正确示例
public class CircleAppServiceImpl {
    public CreateCircleResp createCircle(CreateCircleReq request) { // 正确：使用Thrift DTO
        // 业务逻辑
    }
}
```

### 分层调用错误

❌ **错误**：Start层直接调用Domain层  
✅ **正确**：Start层只调用App层，App层调用Domain层

**解决方案**：

```java
// ❌ 错误示例
public class CircleThriftServiceImpl {
    @Resource
    private CircleDomainService circleDomainService; // 错误：直接依赖Domain层

    public CreateCircleResp createCircle(Context ctx, CreateCircleReq request) {
        circleDomainService.createCircle(request); // 错误：跨层调用
    }
}

// ✅ 正确示例
public class CircleThriftServiceImpl {
    @Resource
    private CircleAppService circleAppService; // 正确：依赖App层

    public CreateCircleResp createCircle(Context ctx, CreateCircleReq request) {
        return circleAppService.createCircle(request); // 正确：调用App层
    }
}
```

### 依赖倒置错误

❌ **错误**：Infrastructure层反向依赖Domain层  
✅ **正确**：Infrastructure层实现Domain层接口

**解决方案**：

```java
// ❌ 错误示例
public class CircleRepositoryImpl {
    @Resource
    private CircleDomainService circleDomainService; // 错误：反向依赖

    public void save(Circle circle) {
        // 实现逻辑
    }
}

// ✅ 正确示例
public class CircleRepositoryImpl implements CircleRepository { // 正确：实现Domain层接口
    public void save(Circle circle) {
        // 实现逻辑
    }
}
```

---

## 质量检查清单

### DDD架构检查

- [ ] 是否严格遵循了DDD分层架构？
- [ ] 是否正确处理了DTO与领域对象转换？
- [ ] 是否避免了Domain层依赖外部DTO？
- [ ] 是否按层逐步实现？（domain→infra→app→start）
- [ ] 是否使用TODO标记了依赖关系？
- [ ] 是否遵循了依赖倒置原则？
- [ ] 是否避免了跨层调用？
- [ ] 是否实现了正确的分层调用流程？

### 代码开发检查

- [ ] 是否生成了完整的MyBatis映射文件？
- [ ] 是否包含了必要的注释和校验？
- [ ] 是否实现了领域对象与DO的双向转换？
