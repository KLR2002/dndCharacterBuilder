import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { centerOf, findNode, hasPositiveArea, parseDump, parseDumpOutput, tapPoint, visibleBounds } from "../scripts/lib/uiautomator.mjs";

// The uiautomator dump parser (scripts/lib/uiautomator.mjs), which the native runner polls to wait for
// a scenario's ready text. The fixture is a real dump captured on the emulator with the Settings screen
// open by deep link.

const FIXTURE = fileURLToPath(new URL("./fixtures/uiautomator-settings.xml", import.meta.url));
const fixtureXml = readFileSync(FIXTURE, "utf8");

test("parseDump reads every node of a real dump, with decoded text and parsed bounds", () => {
  const nodes = parseDump(fixtureXml);
  assert.equal(nodes.length, 47);
  const title = nodes.find((node) => node.text === "Settings & Compendium");
  assert.ok(title, "the entity-encoded title must decode to \"Settings & Compendium\"");
  assert.deepEqual(title.bounds, { x1: 185, y1: 86, x2: 534, y2: 129 });
  assert.equal(title.className, "android.widget.TextView");
  assert.equal(title.clickable, false);
});

test("parseDump handles a small synthetic dump: attributes, entities and clickable", () => {
  const xml =
    `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">` +
    `<node text="A &amp; B" content-desc="Quoted &quot;x&quot;" bounds="[0,0][10,20]" clickable="true" scrollable="true" class="android.widget.Button" resource-id="id/one" />` +
    `<node text="" content-desc="" bounds="[10,20][30,40]" clickable="false" class="android.widget.FrameLayout" resource-id="" />` +
    `</hierarchy>`;
  const nodes = parseDump(xml);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].text, "A & B");
  assert.equal(nodes[0].contentDesc, 'Quoted "x"');
  assert.equal(nodes[0].clickable, true);
  assert.equal(nodes[0].scrollable, true);
  assert.equal(nodes[0].resourceId, "id/one");
  assert.deepEqual(nodes[0].bounds, { x1: 0, y1: 0, x2: 10, y2: 20 });
  assert.equal(nodes[1].scrollable, false);
  assert.deepEqual(nodes[1].bounds, { x1: 10, y1: 20, x2: 30, y2: 40 });
});

test("findNode matches a string exactly against an element's text on the real fixture", () => {
  const nodes = parseDump(fixtureXml);
  const node = findNode(nodes, "Settings & Compendium");
  assert.ok(node);
  assert.deepEqual(node.bounds, { x1: 185, y1: 86, x2: 534, y2: 129 });
  // A substring is not an exact match.
  assert.equal(findNode(nodes, "Settings"), null);
});

test("findNode tests a RegExp against an element's text on the real fixture", () => {
  const nodes = parseDump(fixtureXml);
  const node = findNode(nodes, /settings & compendium/i);
  assert.ok(node);
  assert.equal(node.text, "Settings & Compendium");
});

test("findNode reports absence", () => {
  const nodes = parseDump(fixtureXml);
  assert.equal(findNode(nodes, "No Such Text On This Screen"), null);
  assert.equal(findNode(nodes, /no such text either/i), null);
  assert.equal(findNode([], "Settings & Compendium"), null);
});

test("hasPositiveArea rejects a zero-width and a zero-height box: only strictly positive area counts", () => {
  assert.equal(hasPositiveArea({ x1: 10, y1: 10, x2: 10, y2: 20 }), false); // zero width
  assert.equal(hasPositiveArea({ x1: 10, y1: 10, x2: 20, y2: 10 }), false); // zero height
  assert.equal(hasPositiveArea({ x1: 10, y1: 10, x2: 11, y2: 11 }), true);
  assert.equal(hasPositiveArea({ x1: 5, y1: 5, x2: 4, y2: 9 }), false); // inverted
  assert.equal(hasPositiveArea(null), false);
});

test("centerOf is the centre point of a node's bounds", () => {
  const nodes = parseDump(fixtureXml);
  const node = findNode(nodes, /settings & compendium/i);
  assert.ok(node);
  assert.deepEqual(centerOf(node), { x: 360, y: 108 });
  assert.deepEqual(centerOf({ text: "x", contentDesc: "", resourceId: "", className: "", clickable: false, scrollable: false, bounds: { x1: 0, y1: 0, x2: 11, y2: 21 } }), { x: 6, y: 11 });
  assert.equal(centerOf({ text: "x", contentDesc: "", resourceId: "", className: "", clickable: false, scrollable: false, bounds: null }), null);
});

// --- visibleBounds and tapPoint: the on-screen part, and the point a tap lands on ---

const VIEW = { width: 720, height: 1280, topBar: 48, bottomBar: 48 };
type Bounds = { x1: number; y1: number; x2: number; y2: number };
const node = (bounds: Bounds | null, clickable = false, text = "") => ({ text, contentDesc: "", resourceId: "", className: "", clickable, scrollable: false, bounds });

test("visibleBounds clips a node to the screen and clear of the two system bars", () => {
  assert.deepEqual(visibleBounds(node({ x1: -10, y1: 20, x2: 730, y2: 1300 }), VIEW), { x1: 0, y1: 48, x2: 720, y2: 1232 });
  assert.equal(visibleBounds(node({ x1: 0, y1: 1240, x2: 100, y2: 1300 }), VIEW), null, "entirely under the gesture bar");
  assert.equal(visibleBounds(node(null), VIEW), null);
  assert.deepEqual(visibleBounds(node({ x1: 0, y1: 0, x2: 10, y2: 10 })), { x1: 0, y1: 0, x2: 10, y2: 10 }, "without a view the raw box");
});

test("tapPoint is the centre when nothing clickable covers it", () => {
  const target = node({ x1: 612, y1: 1141, x2: 684, y2: 1213 }, true);
  const nodes = [target, node({ x1: 0, y1: 0, x2: 720, y2: 1280 }) /* not clickable: no cover */];
  assert.deepEqual(tapPoint(target, VIEW, nodes), { x: 648, y: 1177 });
});

test("tapPoint avoids a floating clickable button overlapping the centre (the dice tray over a revealed row button)", () => {
  // The row button revealed to the bottom of the page, its centre under the floating dice button.
  const target = node({ x1: 612, y1: 1141, x2: 684, y2: 1213 }, true);
  const dice = node({ x1: 558, y1: 1064, x2: 684, y2: 1190 }, true);
  dice.contentDesc = "Dice tray";
  const nodes = [node({ x1: 0, y1: 0, x2: 720, y2: 1280 }), target, dice];
  const point = tapPoint(target, VIEW, nodes);
  assert.ok(point, "an uncovered point of the button exists below the dice button");
  assert.notDeepEqual(point, { x: 648, y: 1177 }, "the covered centre is not tapped");
  assert.ok(point.x >= 612 && point.x <= 684 && point.y >= 1141 && point.y <= 1213, "inside the button");
  assert.ok(point.y > 1190, "clear of the dice button");
});

test("tapPoint ignores a real ancestor: a clickable parent holding the node does not cover it", () => {
  // Nested in the dump's tree: the clickable container is the target's parent.
  const nodes = parseDump(
    `<hierarchy><node text="" content-desc="" bounds="[0,0][720,1280]" clickable="true" class="android.view.ViewGroup">` +
      `<node text="Row" content-desc="" bounds="[100,100][200,140]" clickable="true" class="android.widget.Button" />` +
      `</node></hierarchy>`,
  );
  const target = nodes.find((n) => n.text === "Row");
  assert.ok(target?.parent?.clickable, "the container is the target's parent");
  assert.deepEqual(tapPoint(target, VIEW, nodes), { x: 150, y: 120 });
});

test("tapPoint is null when non-ancestor clickables cover every point of the node", () => {
  const target = node({ x1: 100, y1: 100, x2: 140, y2: 140 }, true);
  // Two sibling buttons covering the left and the right half: every grid point is covered, and neither
  // is an ancestor of the target.
  const left = node({ x1: 90, y1: 90, x2: 125, y2: 150 }, true);
  const right = node({ x1: 115, y1: 90, x2: 150, y2: 150 }, true);
  assert.equal(tapPoint(target, VIEW, [left, right, target]), null);
});

test("tapPoint moves off a partly covering clickable, and is null when the node has no visible part", () => {
  const target = node({ x1: 100, y1: 100, x2: 140, y2: 140 }, true);
  // A clickable that covers the centre but not the whole node box (so not an ancestor): the grid's edge
  // points are uncovered.
  const partial = node({ x1: 90, y1: 90, x2: 125, y2: 125 }, true);
  const point = tapPoint(target, VIEW, [partial, target]);
  assert.ok(point);
  assert.notDeepEqual(point, { x: 120, y: 120 });
  assert.ok(point.x >= 100 && point.x <= 140 && point.y >= 100 && point.y <= 140, "still inside the target");
  assert.equal(tapPoint(node({ x1: 0, y1: 1240, x2: 100, y2: 1300 }, true), VIEW, []), null, "entirely under the gesture bar");
  assert.equal(tapPoint(node(null), VIEW, []), null, "no bounds");
});

// --- The one-call dump: the XML and the "dumped to" line share stdout ---

const DUMPED_LINE = "UI hierchary dumped to: /dev/tty";

test("parseDumpOutput reads the nodes of a one-call dump, and the dumped-to line after it adds none", () => {
  const nodes = parseDumpOutput(`${fixtureXml}\n${DUMPED_LINE}\n`);
  assert.ok(nodes);
  assert.equal(nodes.length, 47);
  assert.ok(findNode(nodes, "Settings & Compendium"));
});

test("parseDumpOutput reads a dump whose dumped-to line follows the closing tag on the same line", () => {
  // The device writes the XML without a trailing newline, so the line follows </hierarchy> directly.
  const nodes = parseDumpOutput(`${fixtureXml.trimEnd()}${DUMPED_LINE}\n`);
  assert.ok(nodes);
  assert.equal(nodes.length, 47);
});

test("parseDumpOutput reports a failed dump as null: no XML root, an ERROR line, or only the dumped-to line", () => {
  assert.equal(parseDumpOutput(""), null);
  assert.equal(parseDumpOutput(`${DUMPED_LINE}\n`), null, "the dumped-to line alone has no hierarchy");
  assert.equal(parseDumpOutput("ERROR: could not obtain idle state\n"), null);
  // An ERROR line is a failure even next to a hierarchy: the dump did not complete.
  assert.equal(parseDumpOutput(`ERROR: could not obtain idle state\n${fixtureXml}\n${DUMPED_LINE}\n`), null);
});

test("parseDumpOutput reports a dump as null when an ERROR line follows the nodes", () => {
  assert.equal(parseDumpOutput(`${fixtureXml}\n${DUMPED_LINE}\nERROR: could not obtain idle state\n`), null);
});

test("parseDumpOutput reports a truncated dump, with no closing hierarchy tag, as null", () => {
  const closing = fixtureXml.indexOf("</hierarchy>");
  assert.ok(closing > 0, "the fixture is a complete dump");
  const truncated = fixtureXml.slice(0, closing);
  assert.ok(parseDump(truncated).length > 0, "the truncated XML still holds nodes");
  assert.equal(parseDumpOutput(`${truncated}\n${DUMPED_LINE}\n`), null);
});

test("parseDumpOutput keeps a node whose text holds an encoded 'ERROR:' line, which is not a failure", () => {
  const xml =
    `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">` +
    `<node text="ERROR:&#10;Sample" content-desc="" bounds="[0,0][10,20]" clickable="false" class="android.widget.TextView" resource-id="" />` +
    `</hierarchy>`;
  const nodes = parseDumpOutput(`${xml}\n${DUMPED_LINE}\n`);
  assert.ok(nodes);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].text, "ERROR:\nSample");
});
