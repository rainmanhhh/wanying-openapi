
# onein-openapi

将原始的openapi接口文件转成万应平台支持的格式

功能:

- 在接口路径前添加公共的前缀，例如/gateway/serviceName
- 将接口本身的method统一转为`post`，并把原来的method以`/<HttpMethod>`后缀形式添加到路径中
- 将接口路径中的`/{`和`}/`替换为`/[`和`]/`以避免openapi generator生成代码时报错
- 可通过配置文件为所有接口统一添加公共参数，例如http头中的Authorization 
- 把path,query,header参数都合并到请求报文体中（会添加特定前缀）
- 原始的请求报文只能使用json类型（object和非object均可），其他类型的请求报文暂不支持（例如form）
- 响应报文会被统一包裹在json object中（不管其本身是否为json object），若有报错，则改为返回一个包含错误码和错误提示信息的json对象

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
prefix: /onein-proxy/BAR # 默认值为'/onein'
commonParameters:
  - name: Authorization
    in: header
    description: JWT
```

然后执行`onein`，则程序会自动输出一个`bar.onein.json`文件，可直接用于万应平台API网关接口导入


## 注意
本工具只转换接口文档，实际处理请求需要[onein-proxy](https://github.com/rainmanhhh/onein-proxy) 

## License

MIT &copy; [rainmanhhh](https://github.com/rainmanhhh)
