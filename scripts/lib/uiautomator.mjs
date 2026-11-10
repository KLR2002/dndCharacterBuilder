// The uiautomator dump parser the native runner uses to wait for a scenario's ready text. `uiautomator
// dump` writes an XML hierarchy of <node ... /> elements whose attributes carry the text, the content
// description and the bounds "[x1,y1][x2,y2]" of every element on screen. The parser is pure: it takes
// the XML string and returns the nodes, findNode matches a ready condition (an exact string or a
// RegExp, both against the element's text) against them, and the geometry helpers (visibleBounds,
// centerOf, tapPoint) turn a node's bounds into the on-screen point a tap on it lands on.

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

// One dump as a flat list of nodes, each carrying its parent node (null at the root), so the geometry
// helpers can tell an ancestor from a floating overlay that merely overlaps. Nested <node> elements are
// all matched; uiautomator dumps are a single line, so the tags are found by scanning for <node ...> and
// </node> tags, whose attribute values never contain a raw ">" (it is escaped).
export function parseDump(xml) {
  const nodes = [];
  const stack = [];
  const tagRe = /<(\/?)node\b([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(xml))) {
    if (match[1] === "/") {
      stack.pop();
      continue;
    }
    const attrs = parseAttributes(match[2]);
    const node = {
      text: attrs.text ?? "",
      contentDesc: attrs["content-desc"] ?? "",
      resourceId: attrs["resource-id"] ?? "",
      className: attrs.class ?? "",
      clickable: attrs.clickable === "true",
      scrollable: attrs.scrollable === "true",
      bounds: parseBounds(attrs.bounds),
      parent: stack[stack.length - 1] ?? null,
    };
    nodes.push(node);
    // A self-closing <node ... /> has no children, so it never becomes the stack's parent.
    if (!/\/\s*$/.test(match[2])) stack.push(node);
  }
  return nodes;
}

// The first node whose text matches the ready condition: a string is matched exactly, a RegExp is tested
// against the text. Returns null when nothing matches.
export function findNode(nodes, ready) {
  const matches = typeof ready === "string" ? (node) => node.text === ready : (node) => ready.test(node.text);
  return nodes.find(matches) ?? null;
}

// Whether a bounds box has positive area. uiautomator clips a node's bounds to its parent, so a node
// scrolled out of the viewport is still listed, with an inverted box (x2 <= x1 or y2 <= y1): such a
// node is not on the screen.
export function hasPositiveArea(bounds) {
  return bounds != null && bounds.x2 > bounds.x1 && bounds.y2 > bounds.y1;
}

// The node's bounds clipped to the screen and clear of the status bar (top) and the gesture bar
// (bottom): the part of the node that is actually on screen, or null when none of it is.
export function visibleBounds(node, view) {
  if (!node.bounds) return null;
  let { x1, y1, x2, y2 } = node.bounds;
  if (view) {
    x1 = Math.max(x1, 0);
    y1 = Math.max(y1, view.topBar);
    x2 = Math.min(x2, view.width);
    y2 = Math.min(y2, view.height - view.bottomBar);
  }
  return hasPositiveArea({ x1, y1, x2, y2 }) ? { x1, y1, x2, y2 } : null;
}

// The centre point of a node's bounds, the point a tap on the element lands on; null when the box has
// no positive area. With a view, the centre of the node's visible part instead: the bounds clipped to
// the screen and clear of the status bar (top) and the gesture bar (bottom), so a node clipped at a
// screen edge is tapped on the part that is actually on screen.
export function centerOf(node, view) {
  const b = visibleBounds(node, view);
  return b ? { x: Math.round((b.x1 + b.x2) / 2), y: Math.round((b.y1 + b.y2) / 2) } : null;
}

// Whether `ancestor` is on the node's parent chain (a real ancestor in the dump's tree), which a mere
// box overlap cannot tell apart from a floating overlay covering the node.
function isAncestorOf(ancestor, node) {
  for (let p = node.parent; p; p = p.parent) if (p === ancestor) return true;
  return false;
}

// The point a tap on the node should land on: the centre of its visible part when no other clickable
// node covers that point, else the nearest uncovered point of a grid over the visible part, or null
// when every point is covered. A tap goes to the topmost view at the point, and the dump lists every
// view — so a floating button overlapping the node (the dice tray over a row button revealed to the
// bottom of the page, say) would take the tap instead. Only true ancestors of the node never count as
// covers.
export function tapPoint(node, view, nodes) {
  const b = visibleBounds(node, view);
  if (!b || !node.bounds) return null;
  const containsPoint = (box, p) => p.x >= box.x1 && p.x <= box.x2 && p.y >= box.y1 && p.y <= box.y2;
  const covers = (p) =>
    nodes.some((n) => n !== node && n.clickable && n.bounds && !isAncestorOf(n, node) && containsPoint(n.bounds, p));
  const centre = { x: Math.round((b.x1 + b.x2) / 2), y: Math.round((b.y1 + b.y2) / 2) };
  if (!covers(centre)) return centre;
  // A 5x5 grid over the visible part, nearest to the centre first, so the tap stays as close to the
  // element's middle as an uncovered point allows.
  const grid = [];
  for (let i = 0; i <= 4; i++) {
    for (let j = 0; j <= 4; j++) {
      grid.push({ x: Math.round(b.x1 + ((b.x2 - b.x1) * i) / 4), y: Math.round(b.y1 + ((b.y2 - b.y1) * j) / 4) });
    }
  }
  grid.sort((p, q) => (p.x - centre.x) ** 2 + (p.y - centre.y) ** 2 - ((q.x - centre.x) ** 2 + (q.y - centre.y) ** 2));
  return grid.find((p) => !covers(p)) ?? null;
}

// The nodes of a one-call dump (`adb exec-out uiautomator dump /dev/tty`), whose stdout is the XML
// hierarchy followed by a line naming the file it was written to; parseDump reads only the <node> tags,
// so that line is ignored. Returns null when the output is not a completed dump: no <hierarchy> root with
// its closing tag, or an ERROR line anywhere (the dump did not finish).
export function parseDumpOutput(stdout) {
  if (/^ERROR:/m.test(stdout) || !/<hierarchy\b[\s\S]*<\/hierarchy>/.test(stdout)) return null;
  return parseDump(stdout);
}
