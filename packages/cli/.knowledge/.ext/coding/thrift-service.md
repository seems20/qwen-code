# Thrift服务实现规范

## 强制要求

### 重要约束

**重要：绝对禁止使用Object类型作为Thrift服务的参数和返回值类型**

#### 禁止行为

- ❌ **禁止**使用`Object`类型作为Thrift服务方法的参数类型
- ❌ **禁止**使用`Object`类型作为Thrift服务方法的返回值类型
- ❌ **禁止**使用`Object`类型作为App层服务方法的参数类型
- ❌ **禁止**使用`Object`类型作为App层服务方法的返回值类型

#### 必须行为

- ✅ **必须**使用Thrift生成的正确类型（如`CreateCircleReq`、`CreateCircleResp`等）
- ✅ **必须**使用`Context`类型作为Thrift服务的第一个参数
- ✅ **必须**使用具体的Thrift DTO类型作为业务参数和返回值
- ✅ **必须**在方法签名中明确指定Thrift类型，不得使用泛型或Object

---

## Thrift服务实现通用规则

### Start层实现规范

#### 强制要求

- 必须实现 Thrift 生成的 `xxxService.Iface` 接口，方法签名与 `service.thrift` 严格一致
- 必须使用 `@RedRPCService` 注解对外暴露 RPC 服务，参数需显式配置：
  - `port`：服务端口
  - `threadSize`：工作线程数
  - `interfaceClass`：指向对应的 `xxxService.Iface.class`
  - `timeout`：超时时间（毫秒）
- Start层仅负责 RPC 暴露、日志、错误处理与结果封装，禁止编写业务逻辑；业务调用必须委托 App 层
- 方法内必须使用 try-catch：
  - `log.info` 记录请求参数（必要时脱敏）
  - 捕获异常后 `log.error` 记录堆栈
  - 组装统一的失败响应（`base.Result`：`success=false`、`code`、`message`）

#### 代码结构示例

```java
@Slf4j
@RedRPCService(port = 9966, threadSize = 200, interfaceClass = CircleService.Iface.class, timeout = 3000)
public class CircleThriftServiceImpl implements CircleService.Iface {
	@Resource
	private CircleAppService circleAppService;

	@Override
	public CreateCircleResp createCircle(Context ctx, CreateCircleReq request) throws TException {
		CreateCircleResp resp = new CreateCircleResp();
		try {
			log.info("createCircle req:{}", request);
			// 调用 App 层（Start层不做业务）
			CreateCircleResp result = circleAppService.createCircle(request);
			resp.setResult(new Result(true));
			return resp;
		} catch (Exception e) {
			log.error("createCircle failed, req={}", request, e);
			Result fail = new Result(false);
			fail.setCode(500);
			fail.setMessage("服务器错误");
			resp.setResult(fail);
			return resp;
		}
	}
}
```

### 服务配置规范

#### @RedRPCService注解配置

```java
@RedRPCService(
    port = 9966,                                    // 服务端口
    threadSize = 200,                              // 工作线程数
    interfaceClass = CircleService.Iface.class,    // 接口类
    timeout = 3000                                 // 超时时间（毫秒）
)
```

#### 日志记录规范

```java
// 请求日志（必要时脱敏）
log.info("createCircle req:{}", request);

// 异常日志（包含堆栈信息）
log.error("createCircle failed, req={}", request, e);
```

#### 错误响应规范

```java
Result fail = new Result(false);
fail.setCode(500);
fail.setMessage("服务器错误");
resp.setResult(fail);
```

---

## App层DTO使用规范

### 重要约束

**App层必须严格复用Start层的Thrift入参和出参，禁止创建新的DTO对象**

#### 禁止行为

- ❌ **禁止**在App层创建新的入参DTO（如 `CreateCircleRequest`）
- ❌ **禁止**在App层创建新的出参DTO（如 `CreateCircleResult`）
- ❌ **禁止**向Domain层传入Thrift DTO（绝对禁止）

#### 必须行为

- ✅ **必须**直接使用Start层的Thrift入参/出参
- ✅ **必须**在App层进行Thrift DTO与领域对象的转换
- ✅ **必须**调用Domain层时传入领域对象，绝对禁止传入Thrift DTO

### 正确的分层调用流程

```
Start层 (Thrift DTO) → App层 (DTO转换) → Domain层 (领域对象) → Infrastructure层
```

### DTO转换示例

```java
// App层实现示例
@Service
public class CircleAppServiceImpl implements CircleAppService {

    @Resource
    private CircleDomainService circleDomainService;

    @Override
    public CreateCircleResp createCircle(CreateCircleReq request) {
        // DTO转换为领域对象
        Circle circle = new Circle();
        circle.setName(request.getName());
        circle.setDescription(request.getDescription());

        // 调用Domain层
        circleDomainService.createCircle(circle);

        // 构建响应
        CreateCircleResp resp = new CreateCircleResp();
        resp.setResult(new Result(true));
        return resp;
    }
}
```

---

## 常见Thrift错误

### Object类型使用错误

❌ **错误**：Thrift服务使用Object类型作为参数或返回值  
✅ **正确**：必须使用具体的Thrift类型

**解决方案**：

```java
❌ 错误示例：
public class CircleThriftServiceImpl implements CircleService.Iface {
    public Object createCircle(Context ctx, Object request) { // 错误：使用Object类型
        // 业务逻辑
    }
}

✅ 正确示例：
public class CircleThriftServiceImpl implements CircleService.Iface {
    public CreateCircleResp createCircle(Context ctx, CreateCircleReq request) { // 正确：使用具体类型
        // 业务逻辑
    }
}
```

### 缺少错误处理错误

❌ **错误**：Thrift服务缺少完整的错误处理  
✅ **正确**：必须包含try-catch、日志记录和失败响应

**解决方案**：

```java
❌ 错误示例：
public CreateCircleResp createCircle(Context ctx, CreateCircleReq request) {
    // 直接调用业务逻辑，没有错误处理
    return circleAppService.createCircle(request);
}

✅ 正确示例：
public CreateCircleResp createCircle(Context ctx, CreateCircleReq request) {
    CreateCircleResp resp = new CreateCircleResp();
    try {
        log.info("createCircle req:{}", request);
        CreateCircleResp result = circleAppService.createCircle(request);
        resp.setResult(new Result(true));
        return resp;
    } catch (Exception e) {
        log.error("createCircle failed, req={}", request, e);
        Result fail = new Result(false);
        fail.setCode(500);
        fail.setMessage("服务器错误");
        resp.setResult(fail);
        return resp;
    }
}
```

### 缺少注解配置错误

❌ **错误**：缺少@RedRPCService注解或配置不完整  
✅ **正确**：必须包含完整的注解配置

**解决方案**：

```java
❌ 错误示例：
public class CircleThriftServiceImpl implements CircleService.Iface {
    // 缺少@RedRPCService注解
}

✅ 正确示例：
@RedRPCService(port = 9966, threadSize = 200, interfaceClass = CircleService.Iface.class, timeout = 3000)
public class CircleThriftServiceImpl implements CircleService.Iface {
    // 正确的注解配置
}
```

### 跨层调用错误

❌ **错误**：Start层直接调用Domain层  
✅ **正确**：Start层只调用App层

**解决方案**：

```java
❌ 错误示例：
public class CircleThriftServiceImpl implements CircleService.Iface {
    @Resource
    private CircleDomainService circleDomainService; // 错误：直接依赖Domain层

    public CreateCircleResp createCircle(Context ctx, CreateCircleReq request) {
        circleDomainService.createCircle(request); // 错误：跨层调用
    }
}

✅ 正确示例：
public class CircleThriftServiceImpl implements CircleService.Iface {
    @Resource
    private CircleAppService circleAppService; // 正确：依赖App层

    public CreateCircleResp createCircle(Context ctx, CreateCircleReq request) {
        return circleAppService.createCircle(request); // 正确：调用App层
    }
}
```

---

## 质量检查清单

### Thrift服务检查

- [ ] 类是否 `implements xxxService.Iface`？
- [ ] 是否使用 `@RedRPCService` 且参数正确？
- [ ] 是否严格使用 Thrift DTO 作为入参/出参？
- [ ] 是否仅调用 App 层，不包含业务逻辑？
- [ ] 是否全量覆盖 try-catch、日志与失败响应？
- [ ] 是否无 Domain 层对 Thrift DTO 的依赖？
- [ ] Thrift服务是否使用正确的类型而非Object？
- [ ] App层服务是否使用正确的Thrift类型？
- [ ] 是否避免了Object类型的使用？
- [ ] 是否使用了Context类型作为第一个参数？
- [ ] 是否在方法签名中明确指定了Thrift类型？
- [ ] 是否避免了泛型或Object的使用？

### 服务实现检查

- [ ] 是否记录了请求参数（必要时脱敏）？
- [ ] 是否捕获异常后记录了堆栈？
- [ ] 是否组装了统一的失败响应？
- [ ] 是否设置了正确的错误码和消息？
