import test from "node:test";
import assert from "node:assert/strict";
import { changeLineage, changeRace } from "../src/rules/builderTransitions.ts";
import { raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import type { RaceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// A lineage swap reconciles in the same step: the old lineage's race picks are released with a notice, and the picks of the
// lineage swapped to are kept. Every name is invented. The lineages give a cantrip pick each, as a race does.

const race = (name: string, extra: Partial<RaceData>): RaceData => ({
  name,
  source: "TST",
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
  ...extra,
});

const CUSTOM = { name: "Custom Lineage", source: "TCE" };
const ALPHA = "Sample Lineage Alpha";
const BETA = "Sample Lineage Beta";
const BASE = "Sample Folk";
const cantripPick = { ability: "int" as const, known: { "1": { _: [{ choose: "level=0|class=Sample Mage" }] } } };

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  spells: grantedSpellSpells(),
  races: [
    race(BASE, {}),
    race(ALPHA, { additionalSpells: [cantripPick] }),
    race(BETA, { additionalSpells: [cantripPick] }),
  ],
});
const ACTIVE = ["TST"];

const mage: CharacterClass = { className: "Sample Mage", source: "TST", level: 1 };

/** A character of the base race holding the lineage, with no picks yet. */
const holding = (lineage: string | null): Character =>
  makeChar({
    classes: [mage],
    race: { name: BASE, source: "TST" },
    lineageReplacement: lineage,
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
  });

/** The character with the named cantrip picked from the lineage it holds. */
function picked(character: Character, option: string): Character {
  const choice = raceSpellRuleChoices(character, compendium).find((c) => c.options.some((o) => o.name === option));
  assert.ok(choice, `${option} is offered by the held lineage`);
  return pickRuleChoice(character, choice, option, compendium);
}

const pickedNames = (character: Character): string[] => (character.ruleChoices ?? []).flatMap((entry) => entry.picked);

test("swapping lineages releases the old lineage's race pick in the same call, with a notice", () => {
  const before = picked(holding(ALPHA), "Sample Shot");
  assert.deepEqual(pickedNames(before), ["Sample Shot"], "the lineage's pick is recorded before the swap");

  const swapped = changeLineage(before, { kind: "lineage", name: BETA }, compendium, ACTIVE);

  assert.equal(swapped.lineageReplacement, BETA);
  assert.deepEqual(swapped.race, { name: BASE, source: "TST" }, "moving between lineages leaves the race alone");
  assert.deepEqual(pickedNames(swapped), [], "the old lineage's pick is released without a reconcile call");
  assert.deepEqual(swapped.needsReview, ["Sample Shot removed from Sample Lineage Alpha: ancestry no longer grants it"]);
});

test("swapping to Custom Lineage releases the old lineage's pick and does not release anything for the custom race", () => {
  const before = picked(holding(ALPHA), "Sample Shot");

  const custom = changeLineage(before, { kind: "custom" }, compendium, ACTIVE);

  assert.equal(custom.customLineage, true);
  assert.equal(custom.lineageReplacement, null);
  assert.deepEqual(custom.race, CUSTOM);
  assert.deepEqual(pickedNames(custom), [], "the old lineage's pick is released");
  assert.deepEqual(
    custom.needsReview,
    ["Sample Shot removed from Sample Lineage Alpha: ancestry no longer grants it"],
    "the only notice names the old lineage, none the custom race",
  );
});

test("swapping to none releases the old lineage's pick and keeps the race", () => {
  const before = picked(holding(ALPHA), "Sample Shot");

  const dropped = changeLineage(before, { kind: "none" }, compendium, ACTIVE);

  assert.equal(dropped.lineageReplacement, null);
  assert.equal(dropped.customLineage, false);
  assert.deepEqual(dropped.race, { name: BASE, source: "TST" });
  assert.deepEqual(pickedNames(dropped), []);
  assert.deepEqual(dropped.needsReview, ["Sample Shot removed from Sample Lineage Alpha: ancestry no longer grants it"]);
});

test("swapping from Custom Lineage to none clears the custom flag and releases nothing", () => {
  const custom = changeLineage(holding(ALPHA), { kind: "custom" }, compendium, ACTIVE);

  const dropped = changeLineage(custom, { kind: "none" }, compendium, ACTIVE);

  assert.equal(dropped.customLineage, false);
  assert.equal(dropped.lineageReplacement, null);
  assert.equal(dropped.needsReview, undefined, "no pick is released by the swap");
});

test("choosing None from Custom Lineage clears the custom race, so the character holds no race and nothing of it stays granted", () => {
  const custom = changeLineage(
    { ...holding(ALPHA), racialAbilityBonuses: { int: 2 } },
    { kind: "custom" },
    compendium,
    ACTIVE,
  );

  const dropped = changeLineage(custom, { kind: "none" }, compendium, ACTIVE);

  assert.equal(dropped.race, null, "the custom race is cleared, so the player picks a race again");
  assert.equal(dropped.customLineage, false);
  assert.equal(dropped.lineageReplacement, null);
  assert.deepEqual(dropped.racialAbilityBonuses, {}, "the custom race's ability bonus is cleared with it");
});

test("swapping from Custom Lineage to a catalog lineage clears the custom race too", () => {
  const custom = changeLineage(holding(ALPHA), { kind: "custom" }, compendium, ACTIVE);

  const swapped = changeLineage(custom, { kind: "lineage", name: BETA }, compendium, ACTIVE);

  assert.equal(swapped.race, null, "the custom race is cleared");
  assert.equal(swapped.customLineage, false);
  assert.equal(swapped.lineageReplacement, BETA);
});

test("a pick of the lineage swapped to is kept, and only the old lineage's pick is released", () => {
  const alphaPick = picked(holding(ALPHA), "Sample Shot");
  const betaPick = picked(holding(BETA), "Sample Jab");
  const saved: Character = { ...alphaPick, ruleChoices: [...(alphaPick.ruleChoices ?? []), ...(betaPick.ruleChoices ?? [])] };

  const swapped = changeLineage(saved, { kind: "lineage", name: BETA }, compendium, ACTIVE);

  assert.deepEqual(pickedNames(swapped), ["Sample Jab"], "the pick of the new lineage stays");
  assert.deepEqual(swapped.needsReview, ["Sample Shot removed from Sample Lineage Alpha: ancestry no longer grants it"]);
});

test("changing race keeps the picks of the lineage the character still holds", () => {
  const before = picked(holding(ALPHA), "Sample Shot");

  const changed = changeRace(before, compendium, ACTIVE);

  assert.equal(changed.lineageReplacement, ALPHA);
  assert.deepEqual(pickedNames(changed), ["Sample Shot"], "the held lineage still grants its pick");
  assert.equal(changed.needsReview, undefined, "no notice for a pick the character still holds");
});
