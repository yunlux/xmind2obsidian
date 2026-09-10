#!/usr/bin/env node
'use strict';

const path = require('node:path');
const packageInfo = require('../package.json');
const {
  convertFileToBoth,
  convertFileToCanvas,
  convertFileToExcalidraw,
} = require('../src');

function usage() {
  return `Usage: xmind2obsidian <input.xmind> [output]

Convert an XMind file to Obsidian Canvas, Excalidraw, or both.

Options:
  -f, --format <name>   canvas, excalidraw, or both (default: both)
  -h, --help            Show this help
  -v, --version         Show the version

Output:
  --format canvas       output is a .canvas file (default: <input>.canvas)
  --format excalidraw   output is an .excalidraw.md file (default: <input>.excalidraw.md)
  --format both         output is a directory (default: the input directory)
`;
}

function replaceXMindExtension(inputPath, extension) {
  return /\.xmind$/i.test(inputPath)
    ? inputPath.replace(/\.xmind$/i, extension)
    : `${inputPath}${extension}`;
}

function parseArgs(args) {
  const positional = [];
  const options = { format: 'both' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '-v' || arg === '--version') options.version = true;
    else if (arg === '-f' || arg === '--format') {
      options.format = args[++index];
    } else if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (options.help || options.version) {
    if (positional.length > 0) throw new Error('Help/version options cannot have an input path.');
    return options;
  }
  if (!['canvas', 'excalidraw', 'both'].includes(options.format)) {
    throw new Error('Format must be canvas, excalidraw, or both.');
  }
  if (positional.length < 1 || positional.length > 2) {
    throw new Error('Expected an input path and, optionally, an output path.');
  }

  const inputPath = path.resolve(positional[0]);
  const output = positional[1] ? path.resolve(positional[1]) : undefined;
  const looksLikeFile = output && (/\.canvas$/i.test(output) || /\.excalidraw\.md$/i.test(output));
  if (options.format === 'both' && looksLikeFile) {
    throw new Error('The output for --format both must be a directory.');
  }
  if (options.format !== 'both' && output && inputPath === output) {
    throw new Error('Input and output paths must be different.');
  }
  options.inputPath = inputPath;
  options.output = output;
  return options;
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

  if (options.format === 'canvas') {
    const outputPath = options.output || replaceXMindExtension(options.inputPath, '.canvas');
    const canvas = await convertFileToCanvas(options.inputPath, outputPath);
    console.log(`Canvas: ${outputPath} (${canvas.nodes.length} nodes, ${canvas.edges.length} edges)`);
    return;
  }
  if (options.format === 'excalidraw') {
    const outputPath = options.output || replaceXMindExtension(options.inputPath, '.excalidraw.md');
    const markdown = await convertFileToExcalidraw(options.inputPath, outputPath);
    console.log(`Excalidraw: ${outputPath} (${Buffer.byteLength(markdown, 'utf8')} bytes)`);
    return;
  }

  const result = await convertFileToBoth(options.inputPath, options.output || path.dirname(options.inputPath));
  console.log(`Canvas: ${result.canvasPath} (${result.canvas.nodes.length} nodes, ${result.canvas.edges.length} edges)`);
  console.log(`Excalidraw: ${result.excalidrawPath} (${Buffer.byteLength(result.excalidraw, 'utf8')} bytes)`);
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs, replaceXMindExtension, usage };
