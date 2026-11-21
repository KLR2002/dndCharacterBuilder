import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The Inventory tab keeps its modal and form state and calls the Inventory module. It builds no item and
// changes no item in place: every item and coin change comes back from src/rules/inventory.ts and is written as a whole.

const TAB = fileURLToPath(new URL("../src/components/tabs/InventoryTab.tsx", import.meta.url));
const source = readFileSync(TAB, "utf8");

test("the Inventory tab builds no InventoryItem literal", () => {
  assert.doesNotMatch(source, /\bInventoryItem\s*=\s*\{|\bas\s+InventoryItem\b|<InventoryItem>\s*\{/);
});

test("the Inventory tab does not map over the character's items to change them", () => {
  assert.doesNotMatch(source, /\bitems\.map\(/);
  assert.doesNotMatch(source, /\[\s*\.\.\.items\b/);
  assert.doesNotMatch(source, /\{\s*\.\.\.(i|item)\s*,/);
});

test("the Inventory tab writes items and the pouch only from an Inventory result", () => {
  assert.deepEqual([...source.matchAll(/\bitems:(?!\s*\w+\.items\b)[^\n,}]*/g)].map((m) => m[0]), []);
  assert.deepEqual([...source.matchAll(/\bpouch:(?!\s*\w+\.pouch\b)[^\n,}]*/g)].map((m) => m[0]), []);
});

test("the Inventory tab takes item and coin transitions from the Inventory module", () => {
  assert.match(source, /from "\.\.\/\.\.\/rules\/inventory(\.ts)?"/);
});
