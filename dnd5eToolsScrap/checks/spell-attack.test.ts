import { test } from "node:test";
import assert from "node:assert/strict";
import { spellAttackMap, spellAttackOf } from "../src/scrapers/spells.ts";

// Invented spell records in the raw 5e.tools shape. A spell that needs an attack roll names the kind of roll in its
// `spellAttack` list: "M" melee, "R" ranged, "O" other (ADR 0017). A spell without one has no such field.

test("a spell's attack-roll kinds are kept as the source gives them", () => {
  assert.deepEqual(spellAttackOf({ name: "Sample Bolt", source: "AAA", spellAttack: ["R"] }), ["R"]);
  assert.deepEqual(spellAttackOf({ name: "Sample Grasp", source: "AAA", spellAttack: ["M"] }), ["M"]);
});

test("a spell without an attack roll has no attack-roll field", () => {
  assert.equal(spellAttackOf({ name: "Sample Glow", source: "AAA" }), undefined);
  assert.equal(spellAttackOf({ name: "Sample Glow", source: "AAA", spellAttack: [] }), undefined);
});

test("the attack-roll map names each spell by its cleaned name and source, and leaves out spells without one", () => {
  const map = spellAttackMap([
    { name: "Sample Bolt", source: "AAA", spellAttack: ["R"] },
    { name: "Sample Glow", source: "AAA" },
    { name: "Sample Bolt", source: "BBB", spellAttack: ["M"] },
  ]);
  assert.deepEqual(map.get("Sample Bolt|AAA"), ["R"]);
  assert.deepEqual(map.get("Sample Bolt|BBB"), ["M"]);
  assert.equal(map.has("Sample Glow|AAA"), false);
});

test("the first record of a spell and source wins, as the scraper keeps the first", () => {
  const map = spellAttackMap([
    { name: "Sample Bolt", source: "AAA", spellAttack: ["R"] },
    { name: "Sample Bolt", source: "AAA", spellAttack: ["M"] },
  ]);
  assert.deepEqual(map.get("Sample Bolt|AAA"), ["R"]);
});
