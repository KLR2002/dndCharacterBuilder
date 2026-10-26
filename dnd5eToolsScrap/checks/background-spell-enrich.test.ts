import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichGrantFiles, stripGrantFiles } from "../src/grants/enrich.ts";
import { backgroundKey } from "../src/scrapers/backgrounds.ts";
import type { AdditionalSpells } from "../src/types/models.ts";

// Every name and sentence in this file is invented. The tracked files use the canonical format: JSON.stringify with
// two-space indent and no trailing newline. The enrichment writes a background's expanded spell lists from the raw backgrounds file.

function canonical(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const backgrounds = [
  { name: "Sample Scholar", source: "AAA", description: "Placeholder description." },
  { name: "Sample Plain", source: "AAA", description: "Placeholder description." },
];
const original = { classes: canonical([]), feats: canonical([]), backgrounds: canonical(backgrounds) };
const noOverrides = { classes: [], feats: [], initiativeBonuses: [] };

const scholarSpells: AdditionalSpells[] = [{ expanded: { s0: ["sample ember"], s1: ["sample pulse"] } }];
const spellsBySource = new Map([[backgroundKey("Sample Scholar", "AAA"), scholarSpells]]);

test("a background's expanded spell lists are written onto the tracked background, and one without any gets none", () => {
  const enriched = enrichGrantFiles(original, noOverrides, undefined, spellsBySource);
  const [scholar, plain] = JSON.parse(enriched.backgrounds!);
  assert.deepEqual(scholar.additionalSpells, scholarSpells);
  assert.equal("additionalSpells" in plain, false);
});

test("enriching twice changes nothing the second time, for background spell lists too", () => {
  const once = enrichGrantFiles(original, noOverrides, undefined, spellsBySource);
  assert.deepEqual(enrichGrantFiles(once, noOverrides, undefined, spellsBySource), once);
});

test("stripping enrichment removes the background spell lists and gives back the original bytes", () => {
  const enriched = enrichGrantFiles(original, noOverrides, undefined, spellsBySource);
  assert.notEqual(enriched.backgrounds, original.backgrounds, "the enrichment must add the lists for this to mean anything");
  assert.deepEqual(stripGrantFiles(enriched), original);
});

test("a background whose lists are no longer in the raw file loses them on the next enrichment", () => {
  const withLists = enrichGrantFiles(original, noOverrides, undefined, spellsBySource);
  const without = enrichGrantFiles(withLists, noOverrides, undefined, new Map());
  assert.equal("additionalSpells" in JSON.parse(without.backgrounds!)[0], false);
});

test("without a raw backgrounds input, the enrichment leaves the lists already on the tracked backgrounds alone", () => {
  const withLists = enrichGrantFiles(original, noOverrides, undefined, spellsBySource);
  assert.equal(enrichGrantFiles(withLists, noOverrides).backgrounds, withLists.backgrounds);
});
