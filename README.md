# xmind2canvas

将 XMind Zen 思维导图转换为 [JSON Canvas](https://github.com/obsidianmd/jsoncanvas) 文件（`.canvas`）。转换在本地完成，输入内容不会上传。

> 本项目目前是一个轻量 CLI/Node.js 库，不是 XMind 或 Obsidian 的官方项目。

## 使用

要求 Node.js 18 或更高版本。

```bash
npm install
npx xmind2canvas path/to/plan.xmind path/to/plan.canvas
```

省略输出路径时，会在输入文件旁生成同名的 `.canvas` 文件：

```bash
npx xmind2canvas path/to/plan.xmind
```

也可以直接运行本地入口：

```bash
node bin/xmind2canvas.js --help
```

## Node.js API

```js
const fs = require('node:fs/promises');
const { convertBufferToCanvas, convertFile } = require('./src/convert');

async function main() {
  const canvasData = await convertBufferToCanvas(
    await fs.readFile('plan.xmind'),
  );

  await convertFile('plan.xmind', 'plan.canvas');
  console.log(canvasData.nodes.length);
}

main();
```

## 当前边界

本项目使用 [`@wllzhang/xmind-to-canvas`](https://github.com/wllzhang/xmind-to-canvas) 完成解析和布局，因此当前行为受上游库限制：

- 支持 XMind Zen 的 `content.json`；只含 `content.xml` 的旧版 XMind 暂不支持。
- 目前转换第一个工作表。
- 输出为 JSON Canvas 节点和连线；图片资源的复制/打包不在本 CLI 的职责内。

## 开发

```bash
npm install
npm test
```

提交前请确保测试通过，并保持变更聚焦。个人脑图、`.xmind` 源文件、转换产物和本地预览实验默认被 `.gitignore` 排除；不要使用 `git add -f` 强行提交它们。

## 贡献与安全

- 贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 漏洞报告请先阅读 [SECURITY.md](SECURITY.md)，不要在公开 Issue 中发布敏感细节。

## 许可证

[MIT](LICENSE)
