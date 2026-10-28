import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichGrantFiles, stripGrantFiles } from "../src/grants/enrich.ts";
import { featKey } from "../src/scrapers/feats.ts";
import type { AdditionalSpells } from "../src/types/models.ts";

// Every name and sentence in this file is invented. The tracked files use the canonical format: JSON.stringify with
// two-space indent and no trailing newline. The enrichment writes a feat's spell grants from the raw feats file.

function canonical(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const feats = [
  { name: "Sample Cinder", source: "AAA", description: "Placeholder description." },
  { name: "Sample Plain", source: "AAA", description: "Placeholder description." },
];
const original = { classes: canonical([]), feats: canonical(feats) };
const noOverrides = { classes: [], feats: [], initiativeBonuses: [] };

const cinderSpells: AdditionalSpells[] = [
  { ability: "inherit", known: { _: ["sample ember"] }, innate: { _: { daily: { "1": ["sample veil"] } } } },
];
const grantsBySource = new Map([[featKey("Sample Cinder", "AAA"), cinderSpells]]);

test("a feat's spell grants are written onto the tracked feat, and a feat without grants gets none", () => {
  const enriched = enrichGrantFiles(original, noOverrides, grantsBySource);
  const [cinder, plain] = JSON.parse(enriched.feats);
  assert.deepEqual(cinder.additionalSpells, cinderSpells);
  assert.equal("additionalSpells" in plain, false);
});

test("enriching twice changes nothing the second time, for spell grants too", () => {
  const once = enrichGrantFiles(original, noOverrides, grantsBySource);
  assert.deepEqual(enrichGrantFiles(once, noOverrides, grantsBySource), once);
});

test("stripping enrichment removes the spell grants and gives back the original bytes", () => {
  const enriched = enrichGrantFiles(original, noOverrides, grantsBySource);
  assert.notEqual(enriched.feats, original.feats, "the enrichment must add the grants for this to mean anything");
  assert.deepEqual(stripGrantFiles(enriched), original);
});

test("a feat whose grants are no longer in the raw file loses its spell grants on the next enrichment", () => {
  const withGrants = enrichGrantFiles(original, noOverrides, grantsBySource);
  const without = enrichGrantFiles(withGrants, noOverrides, new Map());
  assert.equal("additionalSpells" in JSON.parse(without.feats)[0], false);
});

test("without a raw feats input, the enrichment leaves the spell grants already on the tracked feats alone", () => {
  const withGrants = enrichGrantFiles(original, noOverrides, grantsBySource);
  assert.equal(enrichGrantFiles(withGrants, noOverrides).feats, withGrants.feats);
});
