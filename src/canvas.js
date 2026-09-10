'use strict';

const {
  CanvasGenerator,
  DEFAULT_OPTIONS,
  LayoutCalculator,
} = require('@wllzhang/xmind-to-canvas');

function toCanvasNode(node) {
  const result = {
    id: node.id,
    title: node.title,
    children: node.children.map(toCanvasNode),
  };
  if (node.notes) result.notes = node.notes;
  if (node.labels) result.labels = node.labels;
  if (node.markers) result.markers = node.markers;
  return result;
}

/**
 * Generate official JSON Canvas data from a normalized XMind tree.
 *
 * @param {Object} tree
 * @param {Object} [options]
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
async function treeToCanvas(tree, options = {}) {
  const workbook = {
    sheets: [{
      id: 'sheet-1',
      title: tree.title,
      rootTopic: toCanvasNode(tree),
    }],
    images: new Map(),
  };
  const layout = await new LayoutCalculator().calculate(
    workbook,
    { ...DEFAULT_OPTIONS, ...options },
  );
  return new CanvasGenerator().generate(layout);
}

module.exports = { treeToCanvas };
