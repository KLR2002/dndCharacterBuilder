import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichSpellAttacks } from "../src/grants/enrich.ts";
import { spellKey } from "../src/scrapers/spells.ts";

// Every name and sentence in this file is invented. The tracked spells file uses the canonical format: JSON.stringify with
// two-space indent and no trailing newline. The enrichment writes each spell's attack-roll kinds from the raw spells file,
// placed before the spell's raw entries as the scraper orders its fields.

function canonical(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const spells = [
  { name: "Sample Bolt", source: "AAA", level: 0, rawEntries: ["Placeholder text."] },
  { name: "Sample Glow", source: "AAA", level: 0, rawEntries: ["Placeholder text."] },
];
const original = canonical(spells);
const attacks = new Map([[spellKey("Sample Bolt", "AAA"), ["R"]]]);

test("a spell with an attack roll gets its kinds, before its raw entries, and a spell without one gets none", () => {
  const [bolt, glow] = JSON.parse(enrichSpellAttacks(original, attacks));
  assert.deepEqual(bolt.spellAttack, ["R"]);
  assert.deepEqual(Object.keys(bolt), ["name", "source", "level", "spellAttack", "rawEntries"]);
  assert.equal("spellAttack" in glow, false);
});

test("enriching twice changes nothing the second time", () => {
  const once = enrichSpellAttacks(original, attacks);
  assert.equal(enrichSpellAttacks(once, attacks), once);
});

test("a spell that no longer needs an attack roll loses its kinds on the next enrichment", () => {
  const withKinds = enrichSpellAttacks(original, attacks);
  const without = enrichSpellAttacks(withKinds, new Map());
  assert.equal(without, original);
});
