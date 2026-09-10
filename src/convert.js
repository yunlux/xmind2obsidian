'use strict';

const fs = require('node:fs/promises');
const { convertXMindToCanvas } = require('@wllzhang/xmind-to-canvas');

/**
 * Convert XMind bytes into JSON Canvas data.
 *
 * The upstream converter accepts an ArrayBuffer. Copying the exact byte range
 * avoids passing a Buffer's potentially larger backing ArrayBuffer.
 *
 * @param {ArrayBuffer|ArrayBufferView} input
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
async function convertBufferToCanvas(input) {
  if (!(input instanceof ArrayBuffer) && !ArrayBuffer.isView(input)) {
    throw new TypeError('Input must be an ArrayBuffer or a typed-array view');
  }

  const bytes = input instanceof ArrayBuffer
    ? new Uint8Array(input)
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  const arrayBuffer = bytes.slice().buffer;
  const { canvasData } = await convertXMindToCanvas(arrayBuffer);
  return canvasData;
}

/**
 * Convert an XMind file and write a JSON Canvas file.
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
async function convertFile(inputPath, outputPath) {
  const input = await fs.readFile(inputPath);
  const canvasData = await convertBufferToCanvas(input);
  await fs.writeFile(outputPath, `${JSON.stringify(canvasData, null, 2)}\n`, 'utf8');
  return canvasData;
}

module.exports = { convertBufferToCanvas, convertFile };
