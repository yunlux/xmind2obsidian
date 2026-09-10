'use strict';

const LZString = require('lz-string');

const PALETTE = ['#FA5252', '#4DABF7', '#51CF66', '#B197FC', '#FCC419', '#FF922B'];
const ROOT_STROKE = '#5C7CFA';
const TEXT_COLOR = '#000000';
const BACKGROUND_COLOR = '#FFFFFF';
const LEVEL_GAP = 180;
const ROW_GAP = 34;
const ROOT_FONT_SIZE = 36;
const BRANCH_FONT_SIZE = 30;
const LEAF_FONT_SIZE = 26;
const MIN_NODE_WIDTH = 220;
const MAX_NODE_WIDTH = 520;
const NODE_PADDING_X = 28;
const NODE_PADDING_Y = 22;

const APP_STATE = {
  activeTool: { type: 'selection', customType: null, locked: false, lastActiveTool: null },
  bindingPreference: 'enabled',
  boxSelectionMode: 'contain',
  currentItemArrowType: 'round',
  currentItemBackgroundColor: 'transparent',
  currentItemEndArrowhead: 'arrow',
  currentItemFillStyle: 'solid',
  currentItemFontFamily: 5,
  currentItemFontSize: 20,
  currentItemFrameRole: null,
  currentItemOpacity: 100,
  currentItemRoughness: 1,
  currentItemRoundness: 'round',
  currentItemStartArrowhead: null,
  currentItemStrokeColor: '#1e1e1e',
  currentItemStrokeStyle: 'solid',
  currentItemStrokeWidth: 2,
  currentItemTextAlign: 'left',
  currentStrokeOptions: null,
  disableContextMenu: false,
  frameRendering: {
    enabled: true,
    outline: true,
    name: true,
    clip: true,
    markerName: true,
    markerEnabled: true,
  },
  gridColor: '#c9c9c9',
  gridModeEnabled: false,
  gridSize: 20,
  gridStep: 5,
  isBindingEnabled: true,
  isMidpointSnappingEnabled: true,
  objectsSnapModeEnabled: false,
  scrollX: 0,
  scrollY: 0,
  theme: 'light',
  viewBackgroundColor: BACKGROUND_COLOR,
  zoom: { value: 1 },
};

const MINDMAP_CONFIG = {
  presetName: 'Default',
  growthMode: 'Radial',
  autoLayoutDisabled: false,
  arrowType: 'curved',
  fontsizeScale: 'Normal Scale',
  multicolor: true,
  boxChildren: true,
  roundedCorners: false,
  maxWrapWidth: 450,
  isSolidArrow: true,
  centerText: true,
  fillSweep: true,
  branchScale: 'Hierarchical',
  baseStrokeWidth: 6,
  legacyTextWrap: true,
  layoutSettings: {
    GAP_X: 120,
    GAP_Y: 25,
    GAP_MULTIPLIER: 0.6,
    ROOT_RADIUS_FACTOR: 0.8,
    MIN_RADIUS: 350,
    RADIAL_ASPECT_RATIO: 0.7,
    RADIAL_POLE_GAP_BONUS: 2,
    RADIAL_START_ANGLE: 280,
    RADIAL_MAX_SWEEP: 340,
    DIRECTIONAL_ARC_SPAN_RADIANS: 1,
    GAP_MULTIPLIER_DIRECTIONAL: 1.5,
    RADIUS_PADDING_PER_NODE: 7,
    VERTICAL_SUBTREE_WIDTH_BLEND_SINGLE: 0.35,
    VERTICAL_SUBTREE_WIDTH_BLEND_DUAL: 0.6,
    VERTICAL_SUBTREE_SMOOTH_THRESHOLD_MULTIPLIER: 6,
    VERTICAL_SUBTREE_SMOOTH_MIN_SCALE: 240,
    HORIZONTAL_L1_SOFTCAP_THRESHOLD: 560,
    HORIZONTAL_L1_COMPRESSION_MIN_SCALE: 240,
    VERTICAL_COMPACT_PARENT_CHILD_GAP_RATIO: 0.55,
    DIRECTIONAL_CROSS_AXIS_RATIO: 0.2,
    INDICATOR_OFFSET: 10,
    INDICATOR_OPACITY: 40,
    CONTAINER_PADDING: 10,
    MAX_SEGMENT_LENGTH: 80,
    MANUAL_GAP_MULTIPLIER: 1.3,
    MANUAL_JITTER_RANGE: 300,
  },
};

function safeText(value) {
  return String(value || 'Untitled').replace(/\r\n?/g, '\n');
}

function visualLength(text) {
  return Array.from(text).reduce((sum, character) => sum + (/[\u0000-\u00ff]/.test(character) ? 0.55 : 1), 0);
}

function nodeSize(text, fontSize) {
  const lines = safeText(text).split('\n');
  const longest = Math.max(...lines.map(visualLength), 1);
  const width = Math.min(
    MAX_NODE_WIDTH,
    Math.max(MIN_NODE_WIDTH, Math.ceil(longest * fontSize * 0.66 + NODE_PADDING_X)),
  );
  const charsPerLine = Math.max(1, Math.floor((width - NODE_PADDING_X) / (fontSize * 0.66)));
  const lineCount = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil(visualLength(line) / charsPerLine)), 0);
  return { width, height: Math.max(66, Math.ceil(lineCount * fontSize * 1.25 + NODE_PADDING_Y)) };
}

function subtreeHeight(node, sizes) {
  if (sizes.get(node.id).childrenHeight !== undefined) return sizes.get(node.id).childrenHeight;
  const ownHeight = sizes.get(node.id).height;
  if (node.children.length === 0) {
    sizes.get(node.id).childrenHeight = ownHeight;
    return ownHeight;
  }
  const childrenHeight = node.children.reduce(
    (sum, child) => sum + subtreeHeight(child, sizes),
    ROW_GAP * (node.children.length - 1),
  );
  const result = Math.max(ownHeight, childrenHeight);
  sizes.get(node.id).childrenHeight = result;
  return result;
}

function buildScene(tree) {
  const elements = [];
  const rectangles = new Map();
  const placed = [];
  let sequence = 0;

  const nextId = (kind) => `${kind}-${++sequence}`;
  const sizes = new Map();
  const collectSizes = (node, depth) => {
    const fontSize = depth === 0 ? ROOT_FONT_SIZE : depth === 1 ? BRANCH_FONT_SIZE : LEAF_FONT_SIZE;
    sizes.set(node.id, { ...nodeSize(node.title, fontSize), fontSize });
    node.children.forEach((child) => collectSizes(child, depth + 1));
  };
  collectSizes(tree, 0);
  subtreeHeight(tree, sizes);

  const rootSize = sizes.get(tree.id);
  const rootPlacement = {
    node: tree,
    x: -rootSize.width / 2,
    y: -rootSize.height / 2,
    depth: 0,
    side: 0,
    family: -1,
    order: 0,
    parent: null,
  };
  placed.push(rootPlacement);

  const placeSubtree = (node, parent, centerY, depth, side, family, order) => {
    const size = sizes.get(node.id);
    const x = side > 0
      ? parent.x + parent.width + LEVEL_GAP
      : parent.x - LEVEL_GAP - size.width;
    const current = {
      node,
      x,
      y: centerY - size.height / 2,
      width: size.width,
      height: size.height,
      depth,
      side,
      family,
      order,
      parent,
    };
    placed.push(current);

    const total = node.children.reduce(
      (sum, child) => sum + subtreeHeight(child, sizes),
      ROW_GAP * Math.max(0, node.children.length - 1),
    );
    let cursor = centerY - total / 2;
    for (const [childOrder, child] of node.children.entries()) {
      const childHeight = subtreeHeight(child, sizes);
      placeSubtree(
        child,
        current,
        cursor + childHeight / 2,
        depth + 1,
        side,
        family,
        childOrder,
      );
      cursor += childHeight + ROW_GAP;
    }
    return current;
  };

  const children = tree.children;
  const split = Math.floor(children.length / 2);
  const left = children.slice(0, split);
  const right = children.slice(split);
  const sideTotal = (items) => items.reduce(
    (sum, node) => sum + subtreeHeight(node, sizes),
    ROW_GAP * Math.max(0, items.length - 1),
  );
  const placeSide = (items, side) => {
    let cursor = -sideTotal(items) / 2;
    for (const [index, child] of items.entries()) {
      const height = subtreeHeight(child, sizes);
      placeSubtree(
        child,
        rootPlacement,
        cursor + height / 2,
        1,
        side,
        side > 0 ? split + index : index,
        side > 0 ? split + index : index,
      );
      cursor += height + ROW_GAP;
    }
  };
  placeSide(left, -1);
  placeSide(right, 1);

  const addNode = (item) => {
    const rectangleId = nextId('rect');
    const textId = nextId('text');
    const isRoot = item.depth === 0;
    const stroke = isRoot ? ROOT_STROKE : branchColor(item.family, item.depth);
    const text = safeText(item.node.title);
    const rectangle = {
      id: rectangleId,
      type: 'rectangle',
      x: Math.round(item.x * 10) / 10,
      y: Math.round(item.y * 10) / 10,
      width: item.width,
      height: item.height,
      angle: 0,
      strokeColor: stroke,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: isRoot ? 6 : 4.65,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: sequence * 131,
      version: 1,
      versionNonce: sequence * 777,
      isDeleted: false,
      boundElements: [{ id: textId, type: 'text' }],
      updated: 1,
      link: linkFor(item.node.href),
      locked: false,
      containerId: null,
      originalText: text,
      lineHeight: 1.25,
      fontSize: item.fontSize || (isRoot ? ROOT_FONT_SIZE : LEAF_FONT_SIZE),
      customData: isRoot ? { ...MINDMAP_CONFIG } : { mindmapOrder: item.order },
      index: `a${sequence}`,
      hasTextLink: false,
    };
    const fontSize = rectangle.fontSize;
    const textElement = {
      id: textId,
      type: 'text',
      x: rectangle.x + 14,
      y: rectangle.y + Math.max(2, (rectangle.height - fontSize * 1.4) / 2),
      width: rectangle.width - 28,
      height: Math.ceil(fontSize * 1.4),
      angle: 0,
      strokeColor: TEXT_COLOR,
      backgroundColor: 'transparent',
      fillStyle: 'hachure',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: sequence * 131 + 1,
      version: 1,
      versionNonce: sequence * 777 + 1,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      containerId: rectangleId,
      originalText: text,
      lineHeight: 1.25,
      fontSize,
      text,
      textAlign: 'center',
      verticalAlign: 'middle',
      fontFamily: 5,
      rawText: text,
      autoResize: true,
      index: `b${sequence}`,
      hasTextLink: false,
    };
    rectangles.set(item.node.id, { ...item, rectangleId });
    elements.push(rectangle, textElement);
  };
  placed[0].width = rootSize.width;
  placed[0].height = rootSize.height;
  placed[0].fontSize = rootSize.fontSize;
  placed.slice(1).forEach((item) => {
    item.fontSize = sizes.get(item.node.id).fontSize;
  });
  placed.forEach(addNode);

  const arrows = [];
  for (const item of placed.slice(1)) {
    const parent = item.parent;
    if (!parent) continue;
    const parentRect = rectangles.get(parent.node.id);
    const childRect = rectangles.get(item.node.id);
    const startX = parentRect.x + parentRect.width / 2;
    const startY = parentRect.y + parentRect.height / 2;
    const endX = item.side > 0 ? childRect.x : childRect.x + childRect.width;
    const endY = childRect.y + childRect.height / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const arrowId = nextId('arrow');
    const branchStroke = branchColor(item.family, item.depth);
    const arrow = {
      id: arrowId,
      type: 'arrow',
      x: Math.round(startX * 10) / 10,
      y: Math.round(startY * 10) / 10,
      width: Math.round(Math.abs(dx) * 10) / 10,
      height: Math.round(Math.abs(dy) * 10) / 10,
      angle: 0,
      strokeColor: branchStroke,
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 4.65,
      strokeStyle: 'solid',
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 2 },
      seed: sequence * 313,
      version: 1,
      versionNonce: sequence * 3131,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      points: [
        [0, 0],
        [Math.round(dx * 0.33 * 10) / 10, Math.round((dy * 0.33 - 0.12 * Math.max(Math.abs(dx), 40)) * 10) / 10],
        [Math.round(dx * 0.66 * 10) / 10, Math.round((dy * 0.66 - 0.12 * Math.max(Math.abs(dx), 40)) * 10) / 10],
        [Math.round(dx * 10) / 10, Math.round(dy * 10) / 10],
      ],
      lastCommittedPoint: null,
      elbowed: false,
      customData: { isBranch: true },
      startBinding: {
        elementId: parentRect.rectangleId,
        mode: 'orbit',
        fixedPoint: [0.5001, 0.5001],
      },
      endBinding: {
        elementId: childRect.rectangleId,
        mode: 'orbit',
        fixedPoint: item.side > 0 ? [0.0001, 0.5001] : [0.9999, 0.5001],
      },
      startArrowhead: null,
      endArrowhead: null,
      moveMidPointsWithElement: false,
      hasTextLink: false,
      index: `c${sequence}`,
    };
    const parentElement = elements.find((element) => element.id === parentRect.rectangleId);
    const childElement = elements.find((element) => element.id === childRect.rectangleId);
    parentElement.boundElements.push({ id: arrowId, type: 'arrow' });
    childElement.boundElements.push({ id: arrowId, type: 'arrow' });
    arrows.push(arrow);
  }

  const nonArrows = elements.filter((element) => element.type !== 'arrow');
  return {
    type: 'excalidraw',
    version: 2,
    source: 'xmind2obsidian',
    elements: [...arrows, ...nonArrows],
    appState: JSON.parse(JSON.stringify(APP_STATE)),
    files: {},
  };
}

function branchColor(family, depth) {
  const base = PALETTE[Math.max(0, family) % PALETTE.length];
  if (depth <= 1) return base;
  return adjustLightness(base, Math.min(0.2, (depth - 1) * 0.045));
}

function adjustLightness(hex, amount) {
  const value = hex.slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) h = (g - b) / delta + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h /= 6;
  }
  const newL = Math.min(0.9, l + amount);
  if (s === 0) {
    const gray = Math.round(newL * 255).toString(16).padStart(2, '0');
    return `#${gray}${gray}${gray}`;
  }
  const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
  const p = 2 * newL - q;
  const hue = (t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return `#${[hue(h + 1 / 3), hue(h), hue(h - 1 / 3)]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function linkFor(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (!/^file:/i.test(href)) return null;
  let name = decodeURIComponent(href.slice(5)).replaceAll('\\', '/').split('/').pop().trim();
  name = name.replace(/\.(xmind|md|txt|pdf|png|jpe?g)$/i, '');
  if (!name || name.includes('://')) return null;
  return `[[${name}.excalidraw]]`;
}

/**
 * Generate a portable Excalidraw scene with Mindmap Builder-compatible bindings.
 * The initial layout is a deterministic, non-overlapping left/right tree. The
 * embedded Radial configuration can be applied later by the Mindmap Builder API.
 */
function treeToExcalidraw(tree) {
  return buildScene(tree);
}

function treeToExcalidrawMarkdown(tree) {
  const scene = treeToExcalidraw(tree);
  const compressed = LZString.compressToBase64(JSON.stringify(scene));
  const lines = [
    '---',
    'excalidraw-plugin: parsed',
    'tags: [excalidraw]',
    '---',
    "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'",
    '',
    '# Excalidraw Data',
    '',
    '## Text Elements',
  ];
  for (const element of scene.elements) {
    if (element.type === 'text' && element.text) lines.push(`${element.text} ^${element.id}`, '');
  }
  lines.push('%%', '## Drawing', '```compressed-json');
  for (let index = 0; index < compressed.length; index += 100) {
    lines.push(compressed.slice(index, index + 100));
  }
  lines.push('```', '%%');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  treeToExcalidraw,
  treeToExcalidrawMarkdown,
  branchColor,
};
