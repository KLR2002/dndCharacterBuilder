import test from "node:test";
import assert from "node:assert/strict";
import { changeLineage, changeRace } from "../src/rules/builderTransitions.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { featCounterId, featSpellRuleChoices, raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import type { RaceData } from "../src/types/dnd5e.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellFeats, grantedSpellSpells } from "./grantedSpellsFixture.ts";

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
const HILL = "Sample Hillfolk";
const cantripPick = { ability: "int" as const, known: { "1": { _: [{ choose: "level=0|class=Sample Mage" }] } } };
// A race with a fixed ability bonus, a spell pick and a skill pick, as a dwarf-shaped race gives.
const hillRecord = race(HILL, { abilityScoreIncrease: [{ con: 2 }], additionalSpells: [cantripPick] });

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  spells: grantedSpellSpells(),
  races: [
    race(BASE, {}),
    race(ALPHA, { additionalSpells: [cantripPick] }),
    race(BETA, { additionalSpells: [cantripPick] }),
    hillRecord,
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

// A Custom Lineage character holds an origin feat, and the feat's spell pick and Long Rest counter (ADR 0017). The feat is
// invented: Sample Initiate offers a Mage list with a cantrip and a daily spell.
const featCompendium = inMemoryCompendium(
  { classes: grantedSpellClasses(), spells: grantedSpellSpells(), feats: grantedSpellFeats() },
  { integrated: true },
);
const pulseCounter = featCounterId("Sample Initiate", "Sample Mage Spells", "Sample Pulse");

const pickIn = (character: Character, option: string): Character => {
  const choice = featSpellRuleChoices(character, featCompendium).find((c) => c.options.some((o) => o.name === option));
  assert.ok(choice, `${option} is offered by the origin feat`);
  return pickRuleChoice(character, choice, option, featCompendium);
};

/** A character of the race holding the origin feat, with its Mage list picked and the cantrip and daily counter in place. */
const withOriginFeat = (race: Character["race"], customLineage: boolean): Character => {
  const origin = makeChar({
    classes: [mage],
    race,
    customLineage,
    originFeats: [{ level: 1, type: "feat", featName: "Sample Initiate", featSource: "TST" }],
  });
  const picked = pickIn(pickIn(origin, "Sample Mage Spells"), "Sample Ember");
  return {
    ...picked,
    resourceCounters: { [pulseCounter]: { id: pulseCounter, name: "Innate: Sample Pulse", current: 1, max: 1, resetOn: "long" } },
  };
};

/** A Custom Lineage character whose origin feat has its Mage list picked, with the cantrip and the daily counter in place. */
const customWithOriginFeat = (): Character => withOriginFeat(CUSTOM, true);

test("choosing None from Custom Lineage clears its origin feat, the spell pick and counter it granted, with notices", () => {
  const custom = customWithOriginFeat();
  assert.ok(pickedNames(custom).includes("Sample Ember"), "the origin feat's pick is recorded before the change");

  const dropped = changeLineage(custom, { kind: "none" }, featCompendium, ACTIVE);

  assert.deepEqual(dropped.originFeats ?? [], [], "the origin feat is gone");
  assert.deepEqual(pickedNames(dropped), [], "its spell pick is released");
  assert.equal(dropped.resourceCounters?.[pulseCounter], undefined, "its counter is released");
  assert.ok(
    dropped.needsReview?.some((notice) => /Sample Ember removed from Sample Initiate: feat no longer held/.test(notice)),
    `the pick's release is noticed: ${JSON.stringify(dropped.needsReview)}`,
  );
  assert.ok(
    dropped.needsReview?.some((notice) => /Innate: Sample Pulse removed from Sample Initiate: feat no longer held/.test(notice)),
    `the counter's release is noticed: ${JSON.stringify(dropped.needsReview)}`,
  );
});

test("changing race away from Custom Lineage clears its origin feat and what it granted, as choosing None does", () => {
  const changed = changeRace(customWithOriginFeat(), featCompendium, ACTIVE);
  assert.deepEqual(changed.originFeats ?? [], [], "the origin feat is gone");
  assert.equal(changed.customLineage, false, "the custom flag clears with the race");
  assert.deepEqual(pickedNames(changed), [], "the origin feat's pick is released");
});

test("applying a catalog race to a Custom Lineage character clears its origin feat and the custom flag", () => {
  const applied = applyAncestrySelection(customWithOriginFeat(), race(BASE, {}), undefined, {
    compendium: featCompendium,
    activeBooks: ACTIVE,
  });
  assert.equal(applied.race?.name, BASE);
  assert.equal(applied.customLineage, false);
  assert.deepEqual(applied.originFeats ?? [], [], "the origin feat is gone");
  assert.deepEqual(pickedNames(applied), [], "its spell pick is released");
});

test("applying the Custom Lineage record makes the character a Custom Lineage, as changeLineage does", () => {
  const applied = applyAncestrySelection(makeChar({ classes: [mage] }), race("Custom Lineage", { source: "TCE" }), undefined, {
    compendium,
    activeBooks: ACTIVE,
  });
  assert.equal(applied.race?.name, "Custom Lineage");
  assert.equal(applied.customLineage, true, "the race picker reaches the same state as the lineage control");
});

test("a save that names the Custom Lineage race without the custom flag loads with the flag set and the race kept", () => {
  const saved = makeChar({ classes: [mage], race: CUSTOM, customLineage: false });
  const loaded = migrateCharacter(JSON.parse(JSON.stringify(saved)), undefined, grantedSpellClasses());
  assert.equal(loaded.customLineage, true, "the flag follows the race");
  assert.deepEqual(loaded.race, CUSTOM, "the race stays");

  const oldSave = JSON.parse(JSON.stringify(saved)) as Record<string, unknown>;
  delete oldSave.customLineage;
  assert.equal(migrateCharacter(oldSave, undefined, grantedSpellClasses()).customLineage, true, "a save with no flag too");

  const plain = migrateCharacter(JSON.parse(JSON.stringify(holding(ALPHA))), undefined, grantedSpellClasses());
  assert.equal(plain.customLineage, false, "a character that is not a Custom Lineage stays so");
});

// A Variant subrace gives an origin feat as Custom Lineage does, so leaving the race releases the feat the same way.
const VARIANT = { name: BASE, source: "TST", subraceName: "Variant", subraceSource: "TST" };

test("changing race away from a Variant subrace clears the origin feat it gave, its spell pick and counter, with notices", () => {
  const changed = changeRace(withOriginFeat(VARIANT, false), featCompendium, ACTIVE);
  assert.deepEqual(changed.originFeats ?? [], [], "the origin feat is gone");
  assert.deepEqual(pickedNames(changed), [], "its spell pick is released");
  assert.equal(changed.resourceCounters?.[pulseCounter], undefined, "its counter is released");
  assert.ok(
    changed.needsReview?.some((notice) => /Sample Ember removed from Sample Initiate: feat no longer held/.test(notice)),
    `the pick's release is noticed: ${JSON.stringify(changed.needsReview)}`,
  );
  assert.ok(
    changed.needsReview?.some((notice) => /Innate: Sample Pulse removed from Sample Initiate: feat no longer held/.test(notice)),
    `the counter's release is noticed: ${JSON.stringify(changed.needsReview)}`,
  );
});

test("applying a catalog race to a Variant subrace character clears its origin feat and what it granted", () => {
  const applied = applyAncestrySelection(withOriginFeat(VARIANT, false), race(BASE, {}), undefined, {
    compendium: featCompendium,
    activeBooks: ACTIVE,
  });
  assert.deepEqual(applied.originFeats ?? [], [], "the origin feat is gone");
  assert.deepEqual(pickedNames(applied), [], "its spell pick is released");
  assert.equal(applied.resourceCounters?.[pulseCounter], undefined, "its counter is released");
});

test("a background feat stays when the race changes away from the race that gave the origin feat", () => {
  const withBackground: Character = {
    ...withOriginFeat(VARIANT, false),
    originFeats: [
      { level: 1, type: "feat", featName: "Sample Initiate", featSource: "TST" },
      { level: 1, type: "feat", featName: "Sample Warding", featSource: BACKGROUND_FEAT_SOURCE },
    ],
  };
  const changed = changeRace(withBackground, featCompendium, ACTIVE);
  assert.deepEqual(changed.originFeats?.map((feat) => feat.featName), ["Sample Warding"], "only the background feat stays");
});

test("changing subrace within the race that gives the origin feat keeps the feat, its pick and counter", () => {
  const subrace = {
    name: "Sample Sub",
    source: "TST",
    raceName: "Variant Human",
    raceSource: "TST",
    abilityScoreIncrease: [],
    darkvision: null,
    traits: [],
    description: "Placeholder description for the subrace.",
  };
  const variantHuman = withOriginFeat({ name: "Variant Human", source: "TST" }, false);
  const changed = applyAncestrySelection(variantHuman, race("Variant Human", {}), subrace, {
    compendium: featCompendium,
    activeBooks: ACTIVE,
  });
  assert.equal(changed.race?.subraceName, "Sample Sub");
  assert.deepEqual(changed.originFeats?.map((feat) => feat.featName), ["Sample Initiate"], "the origin feat stays");
  assert.ok(pickedNames(changed).includes("Sample Ember"), "its spell pick stays");
  assert.ok(changed.resourceCounters?.[pulseCounter], "its counter stays");
});

// A character of the catalog race with its fixed bonus applied, its spell pick made, and a skill pick of the race's in place.
// The skill pick is invented: Sample Versatility lets the character take one of two skills.
const hillFolk = (): Character => {
  const applied = applyAncestrySelection(makeChar({ classes: [mage] }), hillRecord, undefined, { compendium, activeBooks: ACTIVE });
  return {
    ...picked(applied, "Sample Shot"),
    skillChoices: [{ id: "Race: Sample Versatility", origin: "race", choose: 1, from: ["Survival", "Stealth"], picked: ["Survival"] }],
    chosenSkills: ["Survival"],
  };
};

test("choosing Custom Lineage from a catalog race clears its fixed bonus, spell pick and skill pick, with notices", () => {
  const before = hillFolk();
  assert.deepEqual(before.racialAbilityBonuses, { con: 2 }, "the fixed bonus is recorded before the change");
  assert.deepEqual(pickedNames(before), ["Sample Shot"], "the race's spell pick is recorded before the change");

  const custom = changeLineage(before, { kind: "custom" }, compendium, ACTIVE);

  assert.deepEqual(custom.racialAbilityBonuses, {}, "the fixed bonus is gone");
  assert.deepEqual(pickedNames(custom), [], "the race's spell pick is released");
  assert.equal(custom.skillChoices?.some((sc) => sc.origin === "race"), false, "the race's skill choice is cleared");
  assert.deepEqual(custom.chosenSkills, [], "the race's skill pick is cleared");
  assert.ok(
    custom.needsReview?.some((notice) => /Sample Shot removed from Sample Hillfolk/.test(notice)),
    `the spell pick's release is noticed: ${JSON.stringify(custom.needsReview)}`,
  );
  assert.ok(
    custom.needsReview?.some((notice) => /Survival removed from Sample Hillfolk/.test(notice)),
    `the skill pick's release is noticed: ${JSON.stringify(custom.needsReview)}`,
  );
});

test("choosing Custom Lineage from a catalog race holds the custom race with its flag", () => {
  const custom = changeLineage(hillFolk(), { kind: "custom" }, compendium, ACTIVE);

  assert.deepEqual(custom.race, CUSTOM, "the custom race is held");
  assert.equal(custom.customLineage, true, "the custom flag is set");
  assert.equal(custom.lineageReplacement, null);
});
