'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('jszip');

const { convertFile } = require('../src/convert');
const { defaultOutputPath, parseArgs } = require('../bin/xmind2canvas');

async function createFixture() {
  const zip = new JSZip();
  zip.file('content.json', JSON.stringify([
    {
      id: 'sheet-1',
      title: 'Demo',
      rootTopic: {
        id: 'root',
        title: 'Root topic',
        children: [{ id: 'child', title: 'Child topic' }],
      },
    },
  ]));
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('converts an XMind Zen file to JSON Canvas', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xmind2canvas-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const inputPath = path.join(directory, 'demo.xmind');
  const outputPath = path.join(directory, 'demo.canvas');
  await fs.writeFile(inputPath, await createFixture());

  const canvasData = await convertFile(inputPath, outputPath);
  const written = JSON.parse(await fs.readFile(outputPath, 'utf8'));

  assert.deepEqual(written, canvasData);
  assert.equal(canvasData.nodes.length, 2);
  assert.equal(canvasData.edges.length, 1);
  assert.deepEqual(
    canvasData.nodes.map((node) => node.text).sort(),
    ['### Child topic', '### Root topic'],
  );
  assert.equal(canvasData.edges[0].fromNode, 'root');
  assert.equal(canvasData.edges[0].toNode, 'child');
});

test('derives the output path and rejects ambiguous input', () => {
  assert.equal(
    defaultOutputPath('/tmp/plan.XMIND'),
    '/tmp/plan.canvas',
  );
  assert.deepEqual(parseArgs(['/tmp/plan.xmind']), {
    inputPath: '/tmp/plan.xmind',
    outputPath: '/tmp/plan.canvas',
  });
  assert.throws(() => parseArgs([]), /Expected an input path/);
  assert.throws(() => parseArgs(['/tmp/plan.xmind', '/tmp/plan.xmind']), /different/);
});
