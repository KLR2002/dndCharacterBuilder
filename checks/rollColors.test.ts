import { test } from "node:test";
import assert from "node:assert/strict";
import { rollAccentId } from "../src/rules/rollColors.ts";
import { ACCENT_PALETTES } from "../src/constants/theme.ts";

function sequence(selected: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => rollAccentId(selected, index));
}

test("crimson selected: the Rolls take crimson, then the accents after it in palette order, skipping silver, and repeat", () => {
  assert.deepEqual(sequence("crimson", 7), ["crimson", "gold", "purple", "emerald", "blue", "cyan", "crimson"]);
});

test("blue selected: the order wraps past the end of the palette", () => {
  assert.deepEqual(sequence("blue", 7), ["blue", "cyan", "crimson", "gold", "purple", "emerald", "blue"]);
});

test("silver selected: index 0 is silver and the later Rolls skip it", () => {
  const colours = sequence("silver", 7);
  assert.equal(colours[0], "silver");
  assert.deepEqual(colours.slice(1), ["crimson", "gold", "purple", "emerald", "blue", "cyan"]);
});

test("the default accent order is the palette's own key order", () => {
  assert.equal(rollAccentId("crimson", 1), "gold");
  assert.equal(rollAccentId("crimson", 6), "crimson");
  assert.equal(rollAccentId("crimson", 1, Object.keys(ACCENT_PALETTES)), "gold");
});

test("an explicit accent list takes its own order and wraps within it", () => {
  assert.equal(rollAccentId("gold", 1, ["gold", "blue", "emerald"]), "blue");
  assert.equal(rollAccentId("gold", 2, ["gold", "blue", "emerald"]), "emerald");
  assert.equal(rollAccentId("gold", 3, ["gold", "blue", "emerald"]), "gold");
});
