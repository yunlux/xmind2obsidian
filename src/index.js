'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const { treeToCanvas } = require('./canvas');
const { treeToExcalidraw, treeToExcalidrawMarkdown } = require('./excalidraw');
const { parseXMind, parseXMindFile } = require('./xmind');

async function convertBufferToCanvas(input, options = {}) {
  const parsed = await parseXMind(input, options);
  return treeToCanvas(parsed.tree, options.canvas || {});
}

async function convertFileToCanvas(inputPath, outputPath, options = {}) {
  const canvas = await convertBufferToCanvas(await fs.readFile(inputPath), options);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(canvas, null, 2)}\n`, 'utf8');
  return canvas;
}

async function convertBufferToExcalidraw(input, options = {}) {
  const parsed = await parseXMind(input, options);
  return treeToExcalidraw(parsed.tree, options);
}

async function convertFileToExcalidraw(inputPath, outputPath, options = {}) {
  const markdown = treeToExcalidrawMarkdown((await parseXMindFile(inputPath, options)).tree, options);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown, 'utf8');
  return markdown;
}

async function convertFileToBoth(inputPath, outputDirectory, options = {}) {
  const inputName = path.basename(inputPath).replace(/\.xmind$/i, '');
  const parsed = await parseXMindFile(inputPath, options);
  const canvas = await treeToCanvas(parsed.tree, options.canvas || {});
  const excalidraw = treeToExcalidrawMarkdown(parsed.tree, options);
  await fs.mkdir(outputDirectory, { recursive: true });
  const canvasPath = path.join(outputDirectory, `${inputName}.canvas`);
  const excalidrawPath = path.join(outputDirectory, `${inputName}.excalidraw.md`);
  await Promise.all([
    fs.writeFile(canvasPath, `${JSON.stringify(canvas, null, 2)}\n`, 'utf8'),
    fs.writeFile(excalidrawPath, excalidraw, 'utf8'),
  ]);
  return { canvas, excalidraw, canvasPath, excalidrawPath, parsed };
}

module.exports = {
  convertBufferToCanvas,
  convertBufferToExcalidraw,
  convertFileToCanvas,
  convertFileToExcalidraw,
  convertFileToBoth,
  parseXMind,
  parseXMindFile,
  treeToCanvas,
  treeToExcalidraw,
  treeToExcalidrawMarkdown,
};
