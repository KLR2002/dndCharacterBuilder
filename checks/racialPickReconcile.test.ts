import { test } from "node:test";
import assert from "node:assert/strict";
import { ORIGIN_CUSTOMIZATION_BOOK } from "../src/constants/books.ts";
import { REQUIRED_CATALOG_FORMAT } from "../src/services/compendiumStorage.ts";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import type { AbilityKey, Character } from "../src/types/character.ts";
import type { AbilityScoreChoiceData, OriginRuleRecord, RaceData, SubraceData } from "../src/types/dnd5e.ts";

// The reconcile pass keeps saved Increase Choice picks in step with the held ancestry's choices (ADR 0019). Every race,
// subrace and rule row here is invented.

const SOURCE = "TST";
const ACTIVE = [SOURCE, ORIGIN_CUSTOMIZATION_BOOK];
const WITHOUT_TCE = [SOURCE];
const FIVE_NO_CHA: AbilityKey[] = ["str", "dex", "con", "int", "wis"];

const HALF_KIN = "Sample Half Kin";
const NARROW = "Sample Narrow";
const FIXED_ONLY = "Sample Fixed Only";
const FLEX = "Sample Flexible";
const WIDE_RACE = "Sample Wide Race";
const REPLACER = "Sample Replacer";
const SWAP_RACE = "Sample Swap Race";

const choice = (from: AbilityKey[], count: number, amount: number): AbilityScoreChoiceData => ({ from, count, amount });

const subrace = (name: string, raceName: string, extra: Partial<SubraceData>): SubraceData => ({
  name,
  source: SOURCE,
  raceName,
  raceSource: SOURCE,
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
  ...extra,
});

const race = (name: string, extra: Partial<RaceData>, subraces: SubraceData[] = []): RaceData => ({
  name,
  source: SOURCE,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces,
  description: "Placeholder description for the race.",
  ...extra,
});

const records: RaceData[] = [
  race(HALF_KIN, { abilityScoreIncrease: [{ cha: 2 }], abilityScoreChoices: [choice(FIVE_NO_CHA, 2, 1)] }),
  race(NARROW, { abilityScoreChoices: [choice(["dex", "cha"], 1, 2)] }),
  race(FIXED_ONLY, { abilityScoreIncrease: [{ int: 1 }] }),
  race(FLEX, {}),
  race(SWAP_RACE, { abilityScoreIncrease: [{ int: 1 }], abilityScoreChoices: [choice(["dex", "cha"], 1, 2)] }),
  race(WIDE_RACE, { abilityScoreIncrease: [{ con: 2 }] }, [
    subrace(REPLACER, WIDE_RACE, { replacesRaceAbilityScores: true, abilityScoreIncrease: [{ dex: 1 }, { cha: 2 }] }),
  ]),
];

const compendium = inMemoryCompendium({ races: records, originRules: [], catalogFormat: REQUIRED_CATALOG_FORMAT }, { integrated: true });
const stale = inMemoryCompendium({ races: records, originRules: [], catalogFormat: REQUIRED_CATALOG_FORMAT - 1 }, { integrated: true });
const RULE: OriginRuleRecord = {
  name: "Sample Origin Customization",
  source: ORIGIN_CUSTOMIZATION_BOOK,
  proficiencySwaps: [{ from: "skill", to: ["skill"] }],
};
const withRule = inMemoryCompendium({ races: records, originRules: [RULE], catalogFormat: REQUIRED_CATALOG_FORMAT }, { integrated: true });

const choiceId = (name: string, index = 0) => `choice|race|${name}|${SOURCE}|${index}`;
const held = (name: string, overrides: Partial<Character> = {}) => makeChar({ race: { name, source: SOURCE }, ...overrides });
const removed = (ability: string) => `Ability increase to ${ability} removed: ancestry no longer offers it`;

test("a saved pick outside its choice's pool is released with a notice", () => {
  const char = held(NARROW, {
    racialChoiceBonus: [{ key: "wis", amount: 2, choiceId: choiceId(NARROW) }],
    racialAbilityBonuses: { wis: 2 },
  });
  const reconciled = reconcile(char, compendium, { activeBooks: WITHOUT_TCE });
  assert.deepEqual(reconciled.racialChoiceBonus, []);
  assert.deepEqual(reconciled.racialAbilityBonuses, {});
  assert.deepEqual(reconciled.needsReview, [removed("Wisdom")]);
});

test("a saved pick on a choice the held ancestry no longer has is released with a notice", () => {
  const char = held(FIXED_ONLY, {
    racialChoiceBonus: [{ key: "dex", amount: 1, choiceId: choiceId(FIXED_ONLY) }],
    racialAbilityBonuses: { int: 1, dex: 1 },
  });
  const reconciled = reconcile(char, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(reconciled.racialChoiceBonus, []);
  assert.deepEqual(reconciled.racialAbilityBonuses, { int: 1 });
  assert.deepEqual(reconciled.needsReview, [removed("Dexterity")]);
});

test("a pick over the choice's count is released, and the earlier pick is kept", () => {
  const char = held(NARROW, {
    racialChoiceBonus: [
      { key: "cha", amount: 2, choiceId: choiceId(NARROW) },
      { key: "dex", amount: 2, choiceId: choiceId(NARROW) },
    ],
    racialAbilityBonuses: { cha: 2, dex: 2 },
  });
  const reconciled = reconcile(char, compendium, { activeBooks: WITHOUT_TCE });
  assert.deepEqual(reconciled.racialChoiceBonus, [{ key: "cha", amount: 2, choiceId: choiceId(NARROW) }]);
  assert.deepEqual(reconciled.racialAbilityBonuses, { cha: 2 });
  assert.deepEqual(reconciled.needsReview, [removed("Dexterity")]);
});

test("legacy picks on a Half-Elf-like ancestry are assigned to its choice and keep their scores with no notice", () => {
  const char = held(HALF_KIN, {
    racialChoiceBonus: [
      { key: "str", amount: 1 },
      { key: "dex", amount: 1 },
    ],
    racialAbilityBonuses: { cha: 2, str: 1, dex: 1 },
  });
  const reconciled = reconcile(char, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(reconciled.racialChoiceBonus, [
    { key: "str", amount: 1, choiceId: choiceId(HALF_KIN) },
    { key: "dex", amount: 1, choiceId: choiceId(HALF_KIN) },
  ]);
  assert.deepEqual(reconciled.racialAbilityBonuses, { cha: 2, str: 1, dex: 1 });
  assert.equal(reconciled.needsReview, undefined);
  assert.deepEqual(reconcile(reconciled, compendium, { activeBooks: ACTIVE }), reconciled, "a second pass changes nothing");
});

test("a legacy pick that fits no choice is released with the same notice", () => {
  const char = held(HALF_KIN, {
    racialChoiceBonus: [{ key: "cha", amount: 1 }],
    racialAbilityBonuses: { cha: 3 },
  });
  const reconciled = reconcile(char, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(reconciled.racialChoiceBonus, []);
  assert.deepEqual(reconciled.racialAbilityBonuses, { cha: 2 });
  assert.deepEqual(reconciled.needsReview, [removed("Charisma")]);
});

test("a legacy pick on an ancestry with Flexible Increases stays a flexible pick", () => {
  const char = held(FLEX, {
    racialChoiceBonus: [{ key: "str", amount: 1 }],
    racialAbilityBonuses: { str: 1 },
  });
  const reconciled = reconcile(char, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(reconciled.racialChoiceBonus, [{ key: "str", amount: 1 }]);
  assert.equal(reconciled.needsReview, undefined);
});

test("a stale catalog keeps saved picks as stored, adds no notice, and releases nothing", () => {
  const char = held(HALF_KIN, {
    racialChoiceBonus: [
      { key: "str", amount: 1 },
      { key: "wis", amount: 2, choiceId: choiceId(NARROW) },
    ],
    racialAbilityBonuses: { cha: 2, str: 1, wis: 2 },
  });
  const reconciled = reconcile(char, stale, { activeBooks: ACTIVE });
  assert.deepEqual(reconciled.racialChoiceBonus, char.racialChoiceBonus);
  assert.deepEqual(reconciled.racialAbilityBonuses, { cha: 2, str: 1, wis: 2 });
  assert.equal(reconciled.needsReview, undefined);
});

test("a saved replacing subrace with stacked bonuses and no picks reconciles to its own increases with no notice", () => {
  const char = makeChar({
    race: { name: WIDE_RACE, source: SOURCE, subraceName: REPLACER, subraceSource: SOURCE },
    racialAbilityBonuses: { con: 2, dex: 1, cha: 2 },
  });
  const reconciled = reconcile(char, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(reconciled.racialAbilityBonuses, { dex: 1, cha: 2 });
  assert.equal(reconciled.needsReview, undefined);
});

test("a held race missing from the catalog leaves its saved picks untouched", () => {
  const char = held("Sample Unknown", {
    racialChoiceBonus: [{ key: "wis", amount: 1, choiceId: "choice|race|Sample Unknown|TST|0" }],
    racialAbilityBonuses: { wis: 1 },
  });
  const reconciled = reconcile(char, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(reconciled.racialChoiceBonus, char.racialChoiceBonus);
  assert.equal(reconciled.needsReview, undefined);
});

test("a swap onto the score a saved pick holds is dropped with a notice, and the pick stays", () => {
  const swapId = `race|${SWAP_RACE}|${SOURCE}|0|int`;
  const char = held(SWAP_RACE, {
    originAbilitySwaps: { [swapId]: "dex" },
    racialChoiceBonus: [{ key: "dex", amount: 2, choiceId: choiceId(SWAP_RACE) }],
    racialAbilityBonuses: { dex: 3 },
  });
  const reconciled = reconcile(char, withRule, { activeBooks: ACTIVE });
  assert.deepEqual(reconciled.racialChoiceBonus, [{ key: "dex", amount: 2, choiceId: choiceId(SWAP_RACE) }]);
  assert.equal(reconciled.originAbilitySwaps, undefined);
  assert.deepEqual(reconciled.racialAbilityBonuses, { int: 1, dex: 2 });
  assert.deepEqual(reconciled.needsReview, ["Ability swap to Dexterity removed: another increase already uses it"]);
  assert.deepEqual(reconcile(reconciled, withRule, { activeBooks: ACTIVE }), reconciled, "a second pass changes nothing");
});
