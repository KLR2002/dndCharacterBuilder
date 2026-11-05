import { test } from "node:test";
import assert from "node:assert/strict";
import { ORIGIN_CUSTOMIZATION_BOOK } from "../src/constants/books.ts";
import { REQUIRED_CATALOG_FORMAT } from "../src/services/compendiumStorage.ts";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import { resolveAncestryState } from "../src/rules/ancestryEngine.ts";
import { toggleRacialPick } from "../src/rules/builderTransitions.ts";
import type { AbilityKey, Character } from "../src/types/character.ts";
import type { AbilityScoreChoiceData, OriginRuleRecord, RaceData, SubraceData } from "../src/types/dnd5e.ts";

// Increase Choices are offered from the record each ancestry holds, Origin Customization widens their pools, and a pick
// that would share a score or pass the cap is refused. Every race, subrace and rule row here is invented.

const SOURCE = "TST";
const ACTIVE = [SOURCE, ORIGIN_CUSTOMIZATION_BOOK];
const WITHOUT_TCE = [SOURCE];
const ALL_SCORES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

const CHOICE = "Sample Choice";
const CUSTOM = "Sample Custom";
const FIXED_CHOICE = "Sample Fixed Choice";
const SHARED = "Sample Shared";
const MIXED = "Sample Mixed";
const REPLACER = "Sample Replacer";
const FLEX = "Sample Flexible";

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
  race(CHOICE, { abilityScoreChoices: [choice(ALL_SCORES, 2, 1)] }),
  race(CUSTOM, { abilityScoreChoices: [choice(ALL_SCORES, 1, 2)] }),
  race(FIXED_CHOICE, { abilityScoreIncrease: [{ int: 1 }], abilityScoreChoices: [choice(["dex", "cha"], 1, 2)] }),
  race(SHARED, { abilityScoreIncrease: [{ int: 1 }], abilityScoreChoices: [choice(ALL_SCORES, 2, 1)] }),
  race(
    MIXED,
    { abilityScoreIncrease: [{ cha: 2 }], abilityScoreChoices: [choice(["str", "dex", "con", "int", "wis"], 2, 1)] },
    [
      subrace(REPLACER, MIXED, {
        replacesRaceAbilityScores: true,
        abilityScoreIncrease: [{ dex: 1 }],
        abilityScoreChoices: [choice(["wis", "cha"], 1, 2)],
      }),
    ],
  ),
  race(FLEX, {}),
];

const rule: OriginRuleRecord = {
  name: "Sample Origin Customization",
  source: ORIGIN_CUSTOMIZATION_BOOK,
  proficiencySwaps: [{ from: "skill", to: ["skill"] }],
};

const compendium = inMemoryCompendium({ races: records, originRules: [rule], catalogFormat: REQUIRED_CATALOG_FORMAT }, { integrated: true });
const stale = inMemoryCompendium({ races: records, originRules: [rule], catalogFormat: REQUIRED_CATALOG_FORMAT - 1 }, { integrated: true });
const catalogs = { compendium, activeBooks: ACTIVE };
const withoutTce = { compendium, activeBooks: WITHOUT_TCE };

const held = (name: string, overrides: Partial<Character> = {}) => makeChar({ race: { name, source: SOURCE }, ...overrides });
const choiceId = (name: string) => `choice|race|${name}|${SOURCE}|0`;

test("each Increase Choice is offered with its record's id, pool, count and amount", () => {
  const state = resolveAncestryState(held(CHOICE), catalogs);
  assert.deepEqual(state.increaseChoices, [{ id: choiceId(CHOICE), pool: ALL_SCORES, picked: [], count: 2, amount: 1 }]);
});

test("a replacing subrace offers only its own choices, with the race's fixed and choice set aside", () => {
  const char = makeChar({ race: { name: MIXED, source: SOURCE, subraceName: REPLACER, subraceSource: SOURCE } });
  const state = resolveAncestryState(char, withoutTce);
  assert.deepEqual(state.increaseChoices, [
    { id: `choice|subrace|${MIXED}|${SOURCE}|${REPLACER}|${SOURCE}|0`, pool: ["wis", "cha"], picked: [], count: 1, amount: 2 },
  ]);
});

test("Origin Customization widens a choice's pool to all six scores, less the ones a fixed increase takes", () => {
  assert.deepEqual(resolveAncestryState(held(FIXED_CHOICE), catalogs).increaseChoices[0].pool, ["str", "dex", "con", "wis", "cha"]);
  assert.deepEqual(resolveAncestryState(held(FIXED_CHOICE), withoutTce).increaseChoices[0].pool, ["dex", "cha"]);
});

test("a score another racial increase already takes, or one past 20, is not offered", () => {
  const onDex = held(SHARED, {
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 20, cha: 10 },
    racialChoiceBonus: [{ key: "dex", amount: 1, choiceId: choiceId(SHARED) }],
  });
  const [offer] = resolveAncestryState(onDex, catalogs).increaseChoices;
  assert.deepEqual(offer.pool, ["str", "con", "cha"], "INT is the fixed increase, DEX is picked, WIS would pass 20");
  assert.deepEqual(offer.picked, ["dex"]);
});

test("a choice-only race offers its choice, and only a race with neither fixed increases nor choices is flexible", () => {
  const flexible = resolveAncestryState(held(FLEX), catalogs);
  assert.equal(flexible.hasFlexibleIncreases, true);
  assert.deepEqual(flexible.increaseChoices, []);

  const choiceOnly = resolveAncestryState(held(CHOICE), catalogs);
  assert.equal(choiceOnly.hasFlexibleIncreases, false);

  const custom = resolveAncestryState(held(CUSTOM), catalogs);
  assert.equal(custom.hasFlexibleIncreases, false);
  assert.deepEqual(custom.increaseChoices.map(({ count, amount }) => ({ count, amount })), [{ count: 1, amount: 2 }]);
});

test("a stale catalog offers no choices and no flexible increases", () => {
  const staleCatalogs = { compendium: stale, activeBooks: ACTIVE };
  assert.deepEqual(resolveAncestryState(held(CUSTOM), staleCatalogs).increaseChoices, []);
  assert.equal(resolveAncestryState(held(FLEX), staleCatalogs).hasFlexibleIncreases, false);
});

test("a pick over a choice's count is refused and the character is unchanged", () => {
  const first = toggleRacialPick(held(CUSTOM), { choiceId: choiceId(CUSTOM), key: "cha", amount: 2 }, catalogs);
  assert.deepEqual(first.racialChoiceBonus, [{ key: "cha", amount: 2, choiceId: choiceId(CUSTOM) }]);
  assert.deepEqual(first.racialAbilityBonuses, { cha: 2 });

  const second = toggleRacialPick(first, { choiceId: choiceId(CUSTOM), key: "str", amount: 2 }, catalogs);
  assert.equal(second, first);
});

test("a pick on a blocked score is refused, and a pick on a score the pool lacks is refused", () => {
  const blocked = held(SHARED, { baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 20, cha: 10 } });
  assert.equal(toggleRacialPick(blocked, { choiceId: choiceId(SHARED), key: "wis", amount: 1 }, catalogs), blocked);
  assert.equal(toggleRacialPick(blocked, { choiceId: choiceId(SHARED), key: "int", amount: 1 }, catalogs), blocked);

  const outside = held(FIXED_CHOICE);
  assert.equal(toggleRacialPick(outside, { choiceId: choiceId(FIXED_CHOICE), key: "str", amount: 2 }, withoutTce), outside);
  const accepted = toggleRacialPick(outside, { choiceId: choiceId(FIXED_CHOICE), key: "dex", amount: 2 }, withoutTce);
  assert.deepEqual(accepted.racialChoiceBonus, [{ key: "dex", amount: 2, choiceId: choiceId(FIXED_CHOICE) }]);
});

test("a second tap on a picked score removes its pick, and the derived bonus follows", () => {
  const picked = toggleRacialPick(held(CUSTOM), { choiceId: choiceId(CUSTOM), key: "cha", amount: 2 }, catalogs);
  const removed = toggleRacialPick(picked, { choiceId: choiceId(CUSTOM), key: "cha", amount: 2 }, catalogs);
  assert.deepEqual(removed.racialChoiceBonus, []);
  assert.deepEqual(removed.racialAbilityBonuses, {});
});

test("a Flexible Increases pick is saved without a choice id, and a blocked score is refused for it too", () => {
  const flexible = held(FLEX, { baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 20, cha: 10 } });
  const picked = toggleRacialPick(flexible, { key: "str", amount: 1 }, catalogs);
  assert.deepEqual(picked.racialChoiceBonus, [{ key: "str", amount: 1 }]);
  assert.equal(toggleRacialPick(picked, { key: "wis", amount: 1 }, catalogs), picked);
});

test("a stale catalog refuses every pick", () => {
  const char = held(CUSTOM);
  assert.equal(toggleRacialPick(char, { choiceId: choiceId(CUSTOM), key: "cha", amount: 2 }, { compendium: stale, activeBooks: ACTIVE }), char);
});
