
# onein-openapi

将原始的openapi接口文件转成万应平台支持的格式

功能:

- 在接口路径前添加公共的前缀，例如`/gateway/serviceName`
- 将接口本身的method统一转为`post`，并把原来的method以`/<HttpMethod>`后缀形式添加到路径中
- 将接口路径中的`/{`和`}/`替换为`/[`和`]/`以避免openapi generator生成代码时报错
- 可通过配置文件为所有接口统一添加公共参数，例如http头中的`Authorization`
- 把path,query,header参数都合并到请求报文体中（会添加特定前缀）
- 原始的请求报文只能使用json类型（object和非object均可），其他类型的请求报文暂不支持（例如form）
- 响应报文会被统一包裹在json object中（不管其本身是否为json object），若有报错，则改为返回一个包含错误码和错误提示信息的json对象
- allOf和anyOf类型的对象将被全部展开，只有allOf子类型的必填字段会被合并，而anyOf子类型的必填字段都会被忽略（当作非必填字段处理）
- schema或字段描述长度最大只能为64，超长的会被截断
- primitive数组将被转为对象数组：用预定义的object类型包裹primitive值，比如`[number]`转成`[$ref(#/components/schemas/_primitive_number)]`
- 不支持嵌套的数组

## 安装

```bash
npm i -g onein
```

## 使用方法
安装完毕后，程序提供`onein`命令，它可接受两个参数： 
- openapi输入文件路径或它所在的文件夹（未指定此参数时，默认使用当前文件夹）
- onein配置文件路径（默认名称为onein.yaml），若第一个参数为文件夹，则第二个参数必须为基于此文件夹的相对路径

一个典型例子：

待转换的openapi接口文档名称为`openapi.yaml`，它所属的目录为`/foo/bar`

进入该目录，创建配置文件`onein.yaml`：
```yaml
prefix: /onein-proxy/BAR # 所有的接口路径都将添加此前缀，默认值为'/onein'
commonParameters: # 所有的接口都将添加此处定义的公共参数
  - name: Authorization
    in: header
    description: JWT
commonResponse: # 所有的接口响应报文都将添加此处定义的公共响应字段
  errorCode: 
    type: integer
    description: 错误码
  errorMessage: 
    type: string
    description: 错误描述
```

然后执行`onein`，则程序会自动输出一个`bar.onein.json`文件，可直接用于万应平台API网关接口导入


## 注意
- 本工具只转换接口文档，实际处理请求需要[onein-proxy](https://github.com/rainmanhhh/onein-proxy)
- 暂不支持转换非json形式（例如`plain/text`）的返回报文，如果有，则会被直接忽略

## License

MIT &copy; [rainmanhhh](https://github.com/rainmanhhh)
