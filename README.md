## TO AGENT PROMPT — 一次性安装与使用

你是 Hermes、OpenCode、Codex 或其他开发 Agent。请仅根据下面的信息完成本项目的安装和基本使用，不要为了基本安装/使用再要求用户阅读其他文件：

```text
项目地址：https://github.com/yunlux/xmind2obsidian.git
项目用途：把 XMind 文件转换成 Obsidian 官方 Canvas 或 Excalidraw 文件。
环境要求：Node.js 18 或更高版本。

安装：
  git clone https://github.com/yunlux/xmind2obsidian.git
  cd xmind2obsidian
  npm ci

转换（同一个命令会自动识别 XMind 内的 content.xml 或 content.json）：
  npx xmind2obsidian /绝对路径/plan.xmind --format canvas
  npx xmind2obsidian /绝对路径/plan.xmind --format excalidraw
  npx xmind2obsidian /绝对路径/plan.xmind /绝对路径/output --format both

输出：
  canvas      生成 plan.canvas，可由 Obsidian 原生 Canvas 打开。
  excalidraw  生成 plan.excalidraw.md，需要 Obsidian Excalidraw 插件打开。
  both        在指定目录同时生成上述两个文件；省略目录时输出到 XMind 所在目录。

验证：
  npm test

转换在本地完成，不上传 XMind 内容；基础安装、命令用法、输入格式和输出格式以上信息已经完整给出，无需再读取其他文档。
```

# xmind2obsidian

将 XMind 思维导图转换为 Obsidian 可直接打开的两种画布格式：

- 官方 [JSON Canvas](https://jsoncanvas.org/) 文件：`.canvas`
- [Obsidian Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) 文件：`.excalidraw.md`

转换完全在本地完成，XMind 内容不会上传到任何服务。本项目不是 XMind 或 Obsidian 官方项目。

## 使用

要求 Node.js 18 或更高版本。

安装依赖后，默认同时生成两种格式到输入文件所在目录：

```bash
npm install
npx xmind2obsidian path/to/plan.xmind
```

也可以只生成一种格式：

```bash
# 官方 Canvas
npx xmind2obsidian path/to/plan.xmind --format canvas

# Excalidraw
npx xmind2obsidian path/to/plan.xmind --format excalidraw

# 同时生成到指定目录
npx xmind2obsidian path/to/plan.xmind ./output --format both
```

输出文件名由 XMind 文件名决定，例如 `plan.xmind` 会生成：

```text
plan.canvas
plan.excalidraw.md
```

查看帮助：

```bash
npx xmind2obsidian --help
```

## 支持范围

- 支持旧版 XMind 的 `content.xml` 和 XMind Zen 的 `content.json`。
- 默认转换第一个工作表；库 API 支持通过 `sheetIndex` 选择其他工作表。
- Canvas 使用 JSON Canvas 标准数据结构，并由 ELK 计算初始布局。
- Excalidraw 文件使用 Obsidian 插件的 `compressed-json` 格式和 LZString 压缩。
- Excalidraw 节点包含 Mindmap Builder 兼容的容器、箭头绑定和分支元数据，节点可移动、连线会跟随。
- Excalidraw 初始布局采用确定性的左右分支布局，避免离线自绘 Radial 算法产生重叠；文件元数据保留 `growthMode: Radial`，可在 Mindmap Builder 中继续应用 Radial 布局。
- HTTP 链接会保留；XMind 文件链接会转换为 `[[目标名.excalidraw]]`。
- 图片资源不嵌入输出文件；这两种格式的转换器只负责画布结构和文本内容，图片节点会按文本节点处理。

## Node.js API

```js
const {
  convertFileToBoth,
  convertFileToCanvas,
  convertFileToExcalidraw,
  parseXMindFile,
} = require('xmind2obsidian');

await convertFileToCanvas('plan.xmind', 'plan.canvas');
await convertFileToExcalidraw('plan.xmind', 'plan.excalidraw.md');
await convertFileToBoth('plan.xmind', './output');

const parsed = await parseXMindFile('plan.xmind', { sheetIndex: 0 });
console.log(parsed.tree.title, parsed.tree.children.length);
```

也可以直接处理内存中的 `ArrayBuffer` 或 typed-array：

```js
const { convertBufferToCanvas, convertBufferToExcalidraw } = require('xmind2obsidian');

const canvas = await convertBufferToCanvas(buffer);
const scene = await convertBufferToExcalidraw(buffer);
```

## 开发

```bash
npm install
npm test
npm run check
```

测试覆盖 Zen JSON、旧版 XML、Canvas 输出、Excalidraw 压缩数据和节点绑定。个人脑图、XMind 源文件、转换产物和本地实验文件默认由 `.gitignore` 排除；不要使用 `git add -f` 强行提交它们。

## 贡献与安全

- 贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 漏洞报告请先阅读 [SECURITY.md](SECURITY.md)，不要在公开 Issue 中发布敏感细节。

## 许可证

[MIT](LICENSE)
