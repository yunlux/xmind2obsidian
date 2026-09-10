#!/usr/bin/env node
'use strict';

const path = require('node:path');
const packageInfo = require('../package.json');
const { convertFile } = require('../src/convert');

function usage() {
  return `Usage: xmind2canvas <input.xmind> [output.canvas]

Convert an XMind Zen file to a JSON Canvas file.

Arguments:
  input.xmind       Path to the source XMind file
  output.canvas     Optional destination; defaults to <input>.canvas

Options:
  -h, --help        Show this help
  -v, --version     Show the version
`;
}

function defaultOutputPath(inputPath) {
  const extension = path.extname(inputPath);
  return extension.toLowerCase() === '.xmind'
    ? `${inputPath.slice(0, -extension.length)}.canvas`
    : `${inputPath}.canvas`;
}

function parseArgs(args) {
  if (args.length === 1 && (args[0] === '-h' || args[0] === '--help')) {
    return { help: true };
  }
  if (args.length === 1 && (args[0] === '-v' || args[0] === '--version')) {
    return { version: true };
  }
  if (args.length < 1 || args.length > 2) {
    throw new Error('Expected an input path and, optionally, an output path.');
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = path.resolve(args[1] || defaultOutputPath(inputPath));
  if (inputPath === outputPath) {
    throw new Error('Input and output paths must be different.');
  }
  return { inputPath, outputPath };
}

async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  if (options.version) {
    process.stdout.write(`${packageInfo.version}\n`);
    return;
  }

  const canvasData = await convertFile(options.inputPath, options.outputPath);
  console.log(
    `Converted ${options.inputPath} -> ${options.outputPath} ` +
    `(${canvasData.nodes.length} nodes, ${canvasData.edges.length} edges)`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  });
}

module.exports = { defaultOutputPath, parseArgs, usage };
