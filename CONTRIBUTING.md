# Contributing

感谢参与。提交 Issue 或 Pull Request 前，请先确认问题可以在不包含个人脑图或其他敏感文件的最小示例中复现。

## 本地开发

```bash
npm install
npm test
```

代码使用 CommonJS，运行时要求 Node.js 18+。新增行为应同时补充自动化测试；测试和文档应保持与实际 CLI 行为一致。

## Pull Request

请在描述中说明：

1. 变更解决了什么问题；
2. 如何验证；
3. 是否有兼容性、格式或上游依赖影响。

不要提交 `node_modules`、本地路径、真实 XMind 文件、转换产物或密钥。
