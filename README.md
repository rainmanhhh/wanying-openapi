
# onein

convert openapi file to onein standard format

Features:

- add prefix to paths
- merge parameters(in query, path and header) into request body
- if there's already a request body in operation, it will be merged with parameters, but only support json body(any other types such as form will be ignored)
- wrap response body into object

## Install

```bash
npm i onein
```

## License

MIT &copy; [rainmanhhh](https://github.com/rainmanhhh)
