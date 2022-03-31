
# onein

convert openapi file to onein standard format

Features:

- add custom common prefix to paths
- add `/<HttpMethod>` suffix to paths and change methods of operations to `post`
- replace `/{` by `/[` and `}/` by `]/` in path to avoid openapi generator error
- add common parameters such as Authorization in header 
- merge parameters(in query, path and header) into request body
- if there's already a request body in operation, it will be merged with parameters, 
  but only support one-level json body(any other types such as form will be ignored)
- wrap response body into object

Config file example (default name is `onein.yaml`):
```yaml
prefix: /some/prefix # default value is `/onein`
commonParameters:
  - name: Authorization
    in: header
    description: JWT
```

## Install

```bash
npm i onein
```

## License

MIT &copy; [rainmanhhh](https://github.com/rainmanhhh)
