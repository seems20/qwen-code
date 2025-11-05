# Thrift IDL 开发规范

## 基础规约

1. 命名中严禁使用拼音、拼音与英文混合的方式。
2. `struct`和`service`命名使用UpperCamelCase风格，`struct`字段、`service`方法及参数命名统一使用lowerCamelCase风格，特殊名词除外，如`DTO`/`VIP`/`UID`等，禁止使用不规范的缩写。

## Include

- 合理的分割Thrift定义在不同的文件中，可以提高模块性和组织性，便于管理和重用。
- 可行的方法有：
  1. 按代码类型分割，如`struct.thrift`和`service.thrift`
  2. 按业务模块分割，如`book.thrift`和`order.thrift`

## Namespace

- Namespace用于定义各种语言的namespaces/package/module等。

## Comment

- 使用C-style多行风格(/\*\* \*/)注释。

## Const

- `Const`命名全部大写，单词间用下划线隔开，力求语义表达完整，不要嫌名字长。

## Enum

- 如果变量值仅在一个固定范围内变化，用`Enum`类型定义，如status、level、type等。
- `Enum`命名统一使用UpperCamelCase风格，如`HelloWorld`。
- value命名全部大写，单词间用下划线隔开，如`HELLO_WORLD`。
- `Enum`类型的参数不要使用`required`，否则没有更新的使用方接收到新的枚举值时会解析为null进而报错。

## Struct

- struct命名使用UpperCamelCase风格，如`HelloWorld`。
- struct中的字段统一使用lowerCamelCase风格，如`helloWorld`。
- `bool`类型的字段不要加`is`前缀，否则Thrift会生成不合语义的方法，如字段`isSuccess`会生成方法`isIsSuccess()`。
- 分割符可以是逗号（,）或是分号（;），为了清晰起见，建议在定义中只使用一种。

## Exception

- `service`接口方法中禁止使用任何形式的`exception`(如`ClientError`,`ServerError`等)，应该统一使用Response中的`base.Result`来传递信息。

## Service

- `service`命名使用UpperCamelCase风格，如`HelloWorld`。
- `service`下定义的方法名、参数名使用lowerCamelCase风格，如`helloWorld`。
- 方法使用/\*\* \*/进行注释，内容使用[Javadoc语法](https://www.oracle.com/java/technologies/javadoc-tool.html)，每个参数也用同样的方式进行注释。
- 对于调用方不需要关注调用结果的方法，可以使用`void`返回，同时声明`oneway`（数据序列化完成后client端立即返回）。
- 尽量保证同类型方法定义位置相邻，便于查找。

推荐例子如下:

- service方法入参为两个：
  - 第一个参数必须为`base.Context`，用于传递请求上下文；
  - 第二个参数为业务请求参数，必须使用`struct`包装，以便后续在不修改方法签名的前提下增减请求参数，提高接口的兼容性。
- 返回值使用`struct`包装，第一个参数为`base.Result`，用于表示调用结果、错误码和异常信息等，禁止使用`service throws exception`的方式。

## Field

### Field Id

- 一旦有调用方开始使用，不允许调整已有字段的Field Id。
- 可以（建议）对Field Id进行一定的分段以容纳业务上的新字段，维持参数列表一定的逻辑顺序。

### Field Requiredness

有三种：不指定(默认)、`required`、`optional`

- 一般情况下，默认不指定即可，这也是Thrift推荐的做法。
- `optional`字段不赋值则不序列化，可以减少不必要的数据传输。
- 不要使用`required`，因为`required`字段一旦使用就难以变更，严重的限制软版本控制选项。

---

## 标准方法

标准方法存在的意义是有许多方法具有非常相似的语义，通过将这些类似的方法融合到标准方法中，可以显著降低复杂性并提高一致性，这使得它们更易于学习和使用。

`Request`

- 请求参数使用`struct`包装，名字后缀为Request，如`GetBookRequest`。

`Response`

- 返回参数使用`struct`包装，名字后缀为Response，如`GetBookResponse`。
- Response struct中第一个字段为`base.Result`。

`Create`

- 新增的方法用`create`/`add`做前缀。

`Read`

- 获取单个对象的方法用`get`做前缀。
- 批量获取对象的方法使用 `multiGet` / `batchGet`做前缀。根据id查询，返回的结果应该包含一个map（key为id，value为id查询的结果）。
- 获取多个对象的方法用`list`做前缀，复数形式结尾。如`listBooks`。
- 对于更广泛的查询，应该使用自定义方法，如`searchBooks`。

`Update`

- 修改的方法用`update`做前缀。

`Delete`

- 删除的方法用`remove`/`delete`做前缀。

常用标准方法示例：

| 动词   | 名词 | 方法名     | 请求信息          | 响应信息           |
| ------ | ---- | ---------- | ----------------- | ------------------ |
| List   | Book | listBooks  | ListBooksRequest  | ListBooksResponse  |
| Get    | Book | getBook    | GetBookRequest    | GetBookResponse    |
| Create | Book | createBook | CreateBookRequest | CreateBookResponse |
| Update | Book | updateBook | UpdateBookRequest | UpdateBookResponse |
| Rename | Book | renameBook | RenameBookRequest | RenameBookResponse |
| Delete | Book | deleteBook | DeleteBookRequest | void               |

## 标准字段

- 名称：name。
- 时间字段：应该以Time/Date/Duration做后缀，如createTime,openingDate,必须在注释中写明时间单位。
- 数量字段：应该以Count做后缀，如`fansCount`。

## 演示例子

```thrift
// 省略注释
struct GetBookRequest {      // struct命名：遵循首字母大写的驼峰命名法
    1: i64 bookId            // field命名：遵循首字母小写的驼峰命名法
                             // request struct：无论请求参数有多少个，request都必须用struct包装
}

struct GetBookResponse {     // response struct：无论返回参数有多少个，response都必须用struct包装
    1: base.Result result     // response 第一个字段必须是base.Result，包含响应结果的基础字段，如success，code，message等
    2: Book book
}

struct UpdateBookRequest {
    1: Book book
    ...
}

struct UpdateBookResponse {
    1: base.Result result
}

service BookService {            // service命名：遵循首字母大写的驼峰命名法

    GetBookResponse getBook(      // 方法命名：首字母小写的驼峰命名法
        1: base.Context context   // Context参数：第一个参数必须是base.Context，
        2: GetBookRequest request // 业务请求参数：业务请求参数必须使用struct包装，严禁直接使用基本类型参数
    )

    UpdateBookResponse updateBook(
        1: base.Context context
        2: UpdateBookRequest request
    )
}
```

## TODO

- 具体目录和描述
- 注释内容
- 定义组织结构 struct service const 位置
- dto
  XXXCreateDTO
  XXXUpdateDTO
  XXXQueryDTO
  XXXListItemDTO
  XXXPaginationDTO
