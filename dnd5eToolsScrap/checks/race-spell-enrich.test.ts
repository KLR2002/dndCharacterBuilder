import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichGrantFiles, stripGrantFiles } from "../src/grants/enrich.ts";
import { raceKey, subraceKey } from "../src/scrapers/races.ts";
import type { AdditionalSpells } from "../src/types/models.ts";

// Every name and sentence in this file is invented. The tracked files use the canonical format: JSON.stringify with
// two-space indent and no trailing newline. The enrichment writes a race's and a subrace's spell grants from the raw races file.

function canonical(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

const races = [
  {
    name: "Sample Kin",
    source: "AAA",
    traits: [],
    subraces: [
      { name: "Sample Line", source: "AAA", traits: [] },
      { name: "Sample Plain", source: "AAA", traits: [] },
    ],
  },
  { name: "Sample Plain Kin", source: "AAA", traits: [], subraces: [] },
];
const original = { classes: canonical([]), feats: canonical([]), races: canonical(races) };
const noOverrides = { classes: [], feats: [], initiativeBonuses: [] };

const kinSpells: AdditionalSpells[] = [{ ability: "cha", known: { "1": ["sample ember"] } }];
const lineSpells: AdditionalSpells[] = [{ ability: "int", known: { "1": { rest: { "1": ["sample glimmer"] } } } }];
const raceSpells = new Map<string, AdditionalSpells[]>([
  [raceKey("Sample Kin", "AAA"), kinSpells],
  [subraceKey("Sample Kin", "AAA", "Sample Line", "AAA"), lineSpells],
]);

test("a race's and a subrace's spell grants are written onto the tracked records; one without grants gets none", () => {
  const enriched = enrichGrantFiles(original, noOverrides, undefined, undefined, raceSpells);
  const [kin, plainKin] = JSON.parse(enriched.races!);
  assert.deepEqual(kin.additionalSpells, kinSpells);
  assert.deepEqual(kin.subraces[0].additionalSpells, lineSpells);
  assert.equal("additionalSpells" in kin.subraces[1], false, "a subrace without grants gets none");
  assert.equal("additionalSpells" in plainKin, false, "a race without grants gets none");
});

test("enriching the races twice changes nothing the second time, for spell grants too", () => {
  const once = enrichGrantFiles(original, noOverrides, undefined, undefined, raceSpells);
  assert.deepEqual(enrichGrantFiles(once, noOverrides, undefined, undefined, raceSpells), once);
});

test("stripping enrichment removes the race spell grants and gives back the original bytes", () => {
  const enriched = enrichGrantFiles(original, noOverrides, undefined, undefined, raceSpells);
  assert.notEqual(enriched.races, original.races, "the enrichment must add the grants for this to mean anything");
  assert.deepEqual(stripGrantFiles(enriched), original);
});

test("a race whose grants are no longer in the raw file loses them on the next enrichment", () => {
  const withGrants = enrichGrantFiles(original, noOverrides, undefined, undefined, raceSpells);
  const without = enrichGrantFiles(withGrants, noOverrides, undefined, undefined, new Map());
  const [kin] = JSON.parse(without.races!);
  assert.equal("additionalSpells" in kin, false);
  assert.equal("additionalSpells" in kin.subraces[0], false);
});

test("without a raw races input, the enrichment leaves the race spell grants already on the tracked races alone", () => {
  const withGrants = enrichGrantFiles(original, noOverrides, undefined, undefined, raceSpells);
  assert.equal(enrichGrantFiles(withGrants, noOverrides).races, withGrants.races);
});
