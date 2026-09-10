'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('jszip');
const LZString = require('lz-string');

const {
  convertFileToBoth,
  convertFileToCanvas,
  convertFileToExcalidraw,
  parseXMindFile,
} = require('../src');
const { parseArgs, replaceXMindExtension } = require('../bin/xmind2obsidian');

async function createZenFixture() {
  const zip = new JSZip();
  zip.file('content.json', JSON.stringify([
    {
      id: 'sheet-1',
      title: 'Demo',
      rootTopic: {
        id: 'root',
        title: 'Root topic',
        children: { attached: [{ id: 'child', title: 'Child topic' }] },
      },
    },
  ]));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function createXmlFixture() {
  const zip = new JSZip();
  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
    <xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0"
      xmlns:xlink="http://www.w3.org/1999/xlink">
      <sheet id="sheet-xml">
        <title>XML demo</title>
        <topic id="root-xml" structure-class="org.xmind.ui.logic.right">
          <title>Root &#1; topic</title>
          <children><topics type="attached">
            <topic id="child-xml" xlink:href="https://example.com">
              <title>Child &amp; link</title>
            </topic>
          </topics></children>
        </topic>
      </sheet>
    </xmap-content>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function decompressScene(markdown) {
  const match = markdown.match(/```compressed-json\n([\s\S]*?)\n```/);
  assert.ok(match, 'expected an Excalidraw compressed-json block');
  const json = LZString.decompressFromBase64(match[1].replace(/\n/g, ''));
  assert.ok(json, 'expected compressed-json to decompress');
  return JSON.parse(json);
}

async function writeFixture(directory, name, buffer) {
  const inputPath = path.join(directory, name);
  await fs.writeFile(inputPath, buffer);
  return inputPath;
}

test('parses XMind Zen JSON and converts it to official JSON Canvas', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xmind2obsidian-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const inputPath = await writeFixture(directory, 'demo.xmind', await createZenFixture());
  const outputPath = path.join(directory, 'demo.canvas');
  const parsed = await parseXMindFile(inputPath);
  const canvasData = await convertFileToCanvas(inputPath, outputPath);
  const written = JSON.parse(await fs.readFile(outputPath, 'utf8'));

  assert.equal(parsed.format, 'zen');
  assert.equal(parsed.tree.title, 'Root topic');
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

test('parses legacy XMind XML and creates a bound Excalidraw file', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xmind2obsidian-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const inputPath = await writeFixture(directory, 'legacy.xmind', await createXmlFixture());
  const outputPath = path.join(directory, 'legacy.excalidraw.md');
  const markdown = await convertFileToExcalidraw(inputPath, outputPath);
  const scene = decompressScene(markdown);
  const arrows = scene.elements.filter((element) => element.type === 'arrow');
  const rectangles = scene.elements.filter((element) => element.type === 'rectangle');
  const text = scene.elements.filter((element) => element.type === 'text');

  assert.equal((await parseXMindFile(inputPath)).format, 'xml');
  assert.match(markdown, /excalidraw-plugin: parsed/);
  assert.equal(scene.appState.theme, 'light');
  assert.equal(scene.appState.viewBackgroundColor, '#FFFFFF');
  assert.equal(rectangles.length, 2);
  assert.equal(text.length, 2);
  assert.equal(arrows.length, 1);
  assert.ok(arrows[0].startBinding);
  assert.ok(arrows[0].endBinding);
  assert.equal(arrows[0].customData.isBranch, true);
  assert.ok(rectangles.every((rectangle) => rectangle.boundElements.some((item) => item.type === 'arrow')));
  assert.ok(scene.elements.slice(0, arrows.length).every((element) => element.type === 'arrow'));
  assert.deepEqual(text.map((element) => element.text).sort(), ['Child & link', 'Root   topic'].sort());
  assert.equal(await fs.readFile(outputPath, 'utf8'), markdown);
});

test('writes both Obsidian formats to a directory', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xmind2obsidian-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const inputPath = await writeFixture(directory, 'both.xmind', await createZenFixture());
  const outputDirectory = path.join(directory, 'output');
  const result = await convertFileToBoth(inputPath, outputDirectory);

  assert.equal(path.basename(result.canvasPath), 'both.canvas');
  assert.equal(path.basename(result.excalidrawPath), 'both.excalidraw.md');
  assert.equal(JSON.parse(await fs.readFile(result.canvasPath, 'utf8')).nodes.length, 2);
  assert.equal(decompressScene(await fs.readFile(result.excalidrawPath, 'utf8')).elements.length, 5);
});

test('one conversion entry point handles both XMind content formats', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xmind2obsidian-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const cases = [
    ['zen', await createZenFixture(), 'zen'],
    ['legacy', await createXmlFixture(), 'xml'],
  ];
  for (const [name, buffer, expectedFormat] of cases) {
    const inputPath = await writeFixture(directory, `${name}.xmind`, buffer);
    const result = await convertFileToBoth(inputPath, path.join(directory, `${name}-output`));
    assert.equal(result.parsed.format, expectedFormat);
    assert.equal(result.canvas.nodes.length, 2);
    assert.equal(result.canvas.edges.length, 1);
    assert.equal(decompressScene(result.excalidraw).elements.filter((element) => element.type === 'arrow').length, 1);
  }
});

test('parses CLI formats and output names', () => {
  assert.equal(replaceXMindExtension('/tmp/plan.XMIND', '.canvas'), '/tmp/plan.canvas');
  assert.equal(replaceXMindExtension('/tmp/plan', '.excalidraw.md'), '/tmp/plan.excalidraw.md');
  assert.deepEqual(parseArgs(['/tmp/plan.xmind']), {
    format: 'both',
    inputPath: '/tmp/plan.xmind',
    output: undefined,
  });
  assert.deepEqual(parseArgs(['--format', 'canvas', '/tmp/plan.xmind', '/tmp/out.canvas']), {
    format: 'canvas',
    inputPath: '/tmp/plan.xmind',
    output: '/tmp/out.canvas',
  });
  assert.throws(() => parseArgs(['--format', 'invalid', '/tmp/plan.xmind']), /Format must be/);
  assert.throws(() => parseArgs(['--format', 'both', '/tmp/plan.xmind', '/tmp/out.canvas']), /directory/);
  assert.throws(() => parseArgs(['--format', 'canvas', '/tmp/plan.xmind', '/tmp/plan.xmind']), /different/);
});
