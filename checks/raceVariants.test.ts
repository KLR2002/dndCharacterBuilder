import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const races = JSON.parse(readFileSync(new URL("../src/data/races.json", import.meta.url), "utf8"));

const halfElfVariants = races
  .find((r: any) => r.name === "Half-Elf")
  .subraces.filter((s: any) => s.isVariant);

test("every subrace the catalog flags as a variant keeps its flag through a scrape", () => {
  assert.ok(halfElfVariants.length > 0, "half-elf should have flagged variants");
  for (const sub of halfElfVariants) {
    assert.equal(sub.isVariant, true, `${sub.name} should be flagged as a variant`);
  }
});

test("variants are identified across all four ancestries that ship them, not just half-elf", () => {
  const flagged = (raceName: string) =>
    races.find((r: any) => r.name === raceName).subraces.filter((s: any) => s.isVariant).map((s: any) => s.name);

  // The regression: an exact "Variant" match found only Human's variant human and
  // silently missed every "Variant; <X>" entry in the catalog.
  assert.ok(flagged("Half-Elf").length >= 6, "half-elf variants should all be flagged");
  assert.ok(flagged("Tiefling").length > 0, "tiefling variants should be flagged");
  assert.ok(flagged("Human").length > 0, "human variants should be flagged");
  assert.ok(flagged("Half-Orc").length > 0, "half-orf variants should be flagged");
});

test("no subrace name carries the source-data naming prefix", () => {
  const offenders: string[] = [];
  for (const race of races) {
    for (const sub of race.subraces ?? []) {
      if (sub.name && /^(Variant;?)\s/.test(sub.name)) offenders.push(`${race.name}: ${sub.name}`);
    }
  }
  assert.deepEqual(offenders, [], "subrace labels should read as their descent, not the source convention");
});

test("a variant half-elf's subrace resolves by its normalised descent name", () => {
  // The half-elf skill-choice regression is ticket 05's seam; here we only
  // assert that the descent name the app stores is the one the catalog uses.
  const drow = halfElfVariants.find((s: any) => s.name === "Drow Descent");
  assert.ok(drow, "Drow descent should be selectable by its normalised name");
  assert.equal(drow.name.includes("Variant"), false, "the source convention should not leak into the name");

  const found = races
    .find((r: any) => r.name === "Half-Elf")
    .subraces.find((s: any) => s.name === "Drow Descent");
  assert.ok(found, "the catalog should be addressable by descent name");
  assert.equal(found.isVariant, true);
});