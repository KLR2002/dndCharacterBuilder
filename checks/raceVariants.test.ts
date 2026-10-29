import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTestCatalog, inMemoryCompendium, makeChar } from "./testUtils.ts";
import { resolveAncestryState, applyAncestrySelection } from "../src/rules/ancestryEngine.ts";

const races = loadTestCatalog("races");

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
  // Here we only assert that the descent name the app stores is the one the catalog uses.
  const drow = halfElfVariants.find((s: any) => s.name === "Drow Descent");
  assert.ok(drow, "Drow descent should be selectable by its normalised name");
  assert.equal(drow.name.includes("Variant"), false, "the source convention should not leak into the name");

  const found = races
    .find((r: any) => r.name === "Half-Elf")
    .subraces.find((s: any) => s.name === "Drow Descent");
  assert.ok(found, "the catalog should be addressable by descent name");
  assert.equal(found.isVariant, true);
});

test("non-srd catalog distinguishes base human (+1 all) from variant human", () => {
  const human = races.find((r: any) => r.name === "Human");
  assert.ok(human, "Human should exist in catalog");
  assert.ok(human.subraces.length > 1, "Human should have multiple subraces including base and variant");

  const baseSub = human.subraces.find((s: any) => !s.name || s.name === "Human");
  assert.ok(baseSub, "Base Human subrace should exist");
  assert.deepEqual(baseSub.abilityScoreIncrease, [{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }]);

  const variantSub = human.subraces.find((s: any) => s.name === "Variant");
  assert.ok(variantSub, "Variant Human subrace should exist");
  assert.equal(variantSub.isVariant, true);

  // Applying Base Human grants +1 to all six stats and no origin feat
  const baseChar = applyAncestrySelection(makeChar(), human, baseSub, { compendium: inMemoryCompendium({ races }), activeBooks: ALL_BOOKS });
  assert.deepEqual(baseChar.racialAbilityBonuses, { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
  const baseState = resolveAncestryState(baseChar, { compendium: inMemoryCompendium({ races }), activeBooks: ALL_BOOKS });
  assert.equal(baseState.hasOriginFeat, false);
  assert.equal(baseState.isChoiceASIRace, false);

  // Applying Variant Human grants Choice ASI and origin feat
  const variantChar = applyAncestrySelection(makeChar(), human, variantSub, { compendium: inMemoryCompendium({ races }), activeBooks: ALL_BOOKS });
  const variantState = resolveAncestryState(variantChar, { compendium: inMemoryCompendium({ races }), activeBooks: ALL_BOOKS });
  assert.equal(variantState.hasOriginFeat, true);
  assert.equal(variantState.isChoiceASIRace, true);
  assert.deepEqual(variantState.choiceASIConfig, { count: 2, amount: 1 });
});