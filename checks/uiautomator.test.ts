import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { centerOf, findNode, hasPositiveArea, parseDump, parseDumpOutput } from "../scripts/lib/uiautomator.mjs";

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
