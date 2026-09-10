'use strict';

const fs = require('node:fs/promises');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

const XML_CONTENT_NAMESPACE = 'urn:xmind:xmap:xmlns:content:2.0';

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => textValue(item)).join('');
  }
  if (typeof value === 'object') {
    for (const key of ['#text', 'text', 'plain', 'title', 'value']) {
      if (value[key] !== undefined) return textValue(value[key], fallback);
    }
    const firstText = Object.values(value).find((item) => typeof item === 'string');
    if (firstText !== undefined) return firstText;
  }
  return fallback;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

function normalizeTitle(value) {
  const title = textValue(value, '').replace(/\r\n?/g, '\n');
  return title || 'Untitled';
}

function normalizeHref(value) {
  return textValue(value, '').trim();
}

function normalizeImage(image) {
  if (!image || typeof image !== 'object') return undefined;
  const src = firstString(image.src, image.href, image['@_src']);
  if (!src) return undefined;
  const result = { src };
  for (const key of ['width', 'height']) {
    const number = Number(image[key]);
    if (Number.isFinite(number) && number > 0) result[key] = number;
  }
  return result;
}

function normalizeChildren(topic) {
  if (!topic || typeof topic !== 'object') return [];
  if (Array.isArray(topic.children)) return topic.children;
  if (topic.children && typeof topic.children === 'object') {
    if (Array.isArray(topic.children.attached)) return topic.children.attached;
    if (topic.children.attached) return [topic.children.attached];
    if (Array.isArray(topic.children.topics)) {
      return topic.children.topics.flatMap((topics) => asArray(topics.topic));
    }
  }
  if (Array.isArray(topic.attached)) return topic.attached;
  if (topic.attached) return [topic.attached];
  if (Array.isArray(topic.topics)) return topic.topics;
  if (topic.topics) return [topic.topics];
  return [];
}

function normalizeTopic(topic, state, source = 'zen') {
  const rawId = firstString(topic && topic.id, topic && topic['@_id']);
  let id = rawId || `node-${state.nextId++}`;
  if (state.ids.has(id)) id = `${id}-${state.nextId++}`;
  state.ids.add(id);

  const rawNotes = topic && topic.notes;
  const result = {
    id,
    title: normalizeTitle(topic && (topic.title ?? topic.label ?? topic.name)),
    href: normalizeHref(topic && (topic.href ?? topic['@_xlink:href'])),
    children: [],
  };

  if (rawNotes !== undefined && rawNotes !== null) {
    result.notes = textValue(rawNotes).trim();
  }
  if (Array.isArray(topic && topic.labels)) {
    result.labels = topic.labels.map((label) => textValue(label)).filter(Boolean);
  } else if (topic && topic.labels) {
    result.labels = [textValue(topic.labels)].filter(Boolean);
  }
  if (Array.isArray(topic && topic.markers)) {
    result.markers = topic.markers.map((marker) => textValue(marker)).filter(Boolean);
  }
  const image = normalizeImage(topic && topic.image);
  if (image) result.image = image;

  result.children = normalizeChildren(topic).map((child) => normalizeTopic(child, state, source));
  return result;
}

function sanitizeXml(text) {
  // XML 1.0 rejects these numeric references even though some XMind versions emit them.
  return text.replace(/&#(?:x0*[0-9a-f]{1,2}|0*[0-9]{1,3});/gi, (match) => {
    const body = match.slice(2, -1);
    const codePoint = body[0].toLowerCase() === 'x'
      ? Number.parseInt(body.slice(1), 16)
      : Number.parseInt(body, 10);
    const valid = codePoint === 9 || codePoint === 10 || codePoint === 13
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd);
    return valid ? match : ' ';
  });
}

function createXmlParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: true,
    isArray: (name) => ['sheet', 'topic', 'topics'].includes(name),
  });
}

function parseXmlSheets(xmlText, state) {
  const parsed = createXmlParser().parse(sanitizeXml(xmlText));
  const content = parsed['xmap-content'];
  if (!content || typeof content !== 'object') {
    throw new Error(`Invalid XMind XML: missing xmap-content namespace (${XML_CONTENT_NAMESPACE})`);
  }

  return asArray(content.sheet).map((sheet, index) => {
    const topics = asArray(sheet.topic);
    const normalizedTopics = topics.map((topic) => normalizeTopic(topic, state, 'xml'));
    const sheetTitle = normalizeTitle(sheet.title ?? `Sheet ${index + 1}`);
    const root = normalizedTopics.length === 1
      ? normalizedTopics[0]
      : {
        id: `sheet-${index + 1}`,
        title: sheetTitle,
        href: '',
        children: normalizedTopics,
      };
    const rawLayout = topics[0] && topics[0]['@_structure-class'];
    return {
      id: firstString(sheet['@_id'], `sheet-${index + 1}`),
      title: sheetTitle,
      layout: firstString(rawLayout, 'logic.right'),
      rootTopic: root,
    };
  });
}

function getJsonSheets(workbook) {
  if (Array.isArray(workbook)) return workbook;
  if (!workbook || typeof workbook !== 'object') return [];
  if (Array.isArray(workbook.sheets)) return workbook.sheets;
  if (Array.isArray(workbook.workbook)) return workbook.workbook;
  return workbook.rootTopic ? [workbook] : [];
}

function parseJsonSheets(jsonText, state) {
  let workbook;
  try {
    workbook = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Invalid XMind JSON: ${error.message}`);
  }
  return getJsonSheets(workbook)
    .filter((sheet) => sheet && typeof sheet === 'object' && (sheet.rootTopic || sheet.topic))
    .map((sheet, index) => ({
      id: firstString(sheet.id, `sheet-${index + 1}`),
      title: normalizeTitle(sheet.title ?? `Sheet ${index + 1}`),
      layout: firstString(sheet.structureClass, sheet.layout, 'map'),
      rootTopic: normalizeTopic(sheet.rootTopic || sheet.topic, state, 'zen'),
    }));
}

function toBytes(input) {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('Input must be an ArrayBuffer or an ArrayBuffer view');
}

/**
 * Parse the first sheet in an XMind archive into a small format-independent tree.
 * XMind XML and Zen JSON files are both supported.
 *
 * @param {ArrayBuffer|ArrayBufferView} input
 * @param {{sheetIndex?: number}} [options]
 * @returns {Promise<{format: 'xml'|'zen', layout: string, sheets: Array, sheet: Object, tree: Object}>}
 */
async function parseXMind(input, options = {}) {
  const zip = await JSZip.loadAsync(toBytes(input));
  const jsonFile = zip.file('content.json');
  const xmlFile = zip.file('content.xml');
  if (!jsonFile && !xmlFile) {
    throw new Error('No content.json or content.xml found in XMind file');
  }

  const state = { ids: new Set(), nextId: 1 };
  const format = jsonFile ? 'zen' : 'xml';
  const raw = await (jsonFile || xmlFile).async('string');
  const sheets = format === 'zen'
    ? parseJsonSheets(raw, state)
    : parseXmlSheets(raw, state);
  if (sheets.length === 0) throw new Error('No valid sheets found in XMind file');

  const sheetIndex = options.sheetIndex === undefined ? 0 : Number(options.sheetIndex);
  if (!Number.isInteger(sheetIndex) || sheetIndex < 0 || sheetIndex >= sheets.length) {
    throw new RangeError(`Sheet index must be between 0 and ${sheets.length - 1}`);
  }
  const sheet = sheets[sheetIndex];
  return { format, layout: sheet.layout, sheets, sheet, tree: sheet.rootTopic };
}

async function parseXMindFile(inputPath, options = {}) {
  return parseXMind(await fs.readFile(inputPath), options);
}

module.exports = { parseXMind, parseXMindFile, textValue };
