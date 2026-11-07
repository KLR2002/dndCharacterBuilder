// The uiautomator dump parser the native runner uses to wait for a scenario's ready text. `uiautomator
// dump` writes an XML hierarchy of <node ... /> elements whose attributes carry the text, the content
// description and the bounds "[x1,y1][x2,y2]" of every element on screen. The parser is pure: it takes
// the XML string and returns the nodes, and findNode matches a ready condition (an exact string or a
// RegExp, both against the element's text) against them.

// Decodes the XML entities uiautomator writes into attribute values.
function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, entity) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? whole : String.fromCodePoint(code);
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity] ?? whole;
  });
}

// The attributes of one tag, as a plain object with entity-decoded values.
function parseAttributes(source) {
  const attrs = {};
  const attrRe = /([\w-]+)="([^"]*)"/g;
  let match;
  while ((match = attrRe.exec(source))) {
    attrs[match[1]] = decodeEntities(match[2]);
  }
  return attrs;
}

// "[x1,y1][x2,y2]" as { x1, y1, x2, y2 }, or null when the attribute is missing or malformed.
export function parseBounds(bounds) {
  const match = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(bounds ?? "");
  if (!match) return null;
  return { x1: Number(match[1]), y1: Number(match[2]), x2: Number(match[3]), y2: Number(match[4]) };
}

// One dump as a flat list of nodes. Nested <node> elements are all matched; uiautomator dumps are a
// single line, so the tags are found by scanning for opening <node ...> tags, whose attribute values
// never contain a raw ">" (it is escaped).
export function parseDump(xml) {
  const nodes = [];
  const tagRe = /<node\b([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(xml))) {
    const attrs = parseAttributes(match[1]);
    nodes.push({
      text: attrs.text ?? "",
      contentDesc: attrs["content-desc"] ?? "",
      resourceId: attrs["resource-id"] ?? "",
      className: attrs.class ?? "",
      clickable: attrs.clickable === "true",
      bounds: parseBounds(attrs.bounds),
    });
  }
  return nodes;
}

// The first node whose text matches the ready condition: a string is matched exactly, a RegExp is tested
// against the text. Returns null when nothing matches.
export function findNode(nodes, ready) {
  const matches = typeof ready === "string" ? (node) => node.text === ready : (node) => ready.test(node.text);
  return nodes.find(matches) ?? null;
}

// The centre point of a node's bounds, the point a tap on the element lands on. Null without bounds.
export function centerOf(node) {
  if (!node.bounds) return null;
  const { x1, y1, x2, y2 } = node.bounds;
  return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) };
}
