import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { featCounterId, featSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { removeOriginFeat } from "../src/rules/feats.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { toggleInnateSpellUse } from "../src/rules/characterSpells.ts";
import type { AsiSelection, Character, CharacterClass } from "../src/types/character.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import type { InnateSpellProfile } from "../src/rules/innateMagic.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import {
  grantedSpellBackgrounds,
  grantedSpellClasses,
  grantedSpellFeats,
  grantedSpellRaces,
  grantedSpellSpells,
} from "./grantedSpellsFixture.ts";

// Releases and notices of granted spell picks and their Long Rest counters (ADR 0017). Every name is invented
// (checks/grantedSpellsFixture.ts). Sample Initiate offers a Mage list and a Cleric list; its Mage list gives
// Sample Ember and Sample Pulse, and its Cleric list gives Sample Ward (and Sample Spark, from the book TST2).

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  feats: grantedSpellFeats(),
  spells: grantedSpellSpells(),
  races: grantedSpellRaces(),
  backgrounds: grantedSpellBackgrounds(),
});

const ACTIVE = ["TST"];
const ALL_BOOKS = ["TST", "TST2"];
const catalogs = { compendium, activeBooks: ACTIVE };

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

const takenFeat = (featName: string): AsiSelection => ({
  level: 4,
  type: "feat",
  featName,
  featSource: "TST",
});

/** Records the option a player would tick for a feat: the one offered choice of the feat that lists it. Reconciles, as the builder does. */
function pickOption(character: Character, option: string, featName: string, activeBooks: string[] | undefined = ACTIVE): Character {
  const choice: AvailableRuleChoice | undefined = featSpellRuleChoices(character, compendium, activeBooks).find(
    (c) => c.id.split("__")[2] === featName && c.options.some((o) => o.name === option),
  );
  assert.ok(choice, `${option} is offered for ${featName}`);
  return pickRuleChoice(character, choice, option, compendium);
}

const initiateCard = (character: Character): InnateSpellProfile | undefined =>
  evaluateCharacter(character, catalogs).grantedSpellSources.find((source) => source.title === "Sample Initiate (Sample Mage)");

/** The Mage-list character of the tests: Sample Ember is picked, and Sample Pulse with it, once per Long Rest. */
function initiateWithMageList(): Character {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] });
  character = pickOption(character, "Sample Mage Spells", "Sample Initiate");
  character = pickOption(character, "Sample Ember", "Sample Initiate");
  character = pickOption(character, "Sample Pulse", "Sample Initiate");
  return character;
}

test("picking another spell list releases the old list's Long Rest counter, with a notice naming the spell and the feat", () => {
  let character = initiateWithMageList();
  const pulse = initiateCard(character)?.spells.find((spell) => spell.name === "Sample Pulse");
  assert.ok(pulse?.resourceCounterId, "the daily spell has a counter");
  character = toggleInnateSpellUse(character, pulse);
  assert.ok(character.resourceCounters?.[pulse.resourceCounterId], "the counter has been used");

  const changed = pickOption(character, "Sample Cleric Spells", "Sample Initiate");
  assert.equal(changed.resourceCounters?.[pulse.resourceCounterId], undefined, "the old list's counter is released");
  assert.ok(
    changed.needsReview?.includes("Innate: Sample Pulse removed from Sample Initiate: spell list changed"),
    `the counter's release is noticed: ${JSON.stringify(changed.needsReview)}`,
  );
  assert.ok(
    changed.needsReview?.includes("Sample Ember removed from Sample Initiate: spell list changed"),
    `the pick's release is noticed: ${JSON.stringify(changed.needsReview)}`,
  );
});

test("reconciling a feat that holds another list releases the old list's counters and keeps the new list's", () => {
  const oldCounter = featCounterId("Sample Initiate", "Sample Mage Spells", "Sample Pulse");
  const newCounter = featCounterId("Sample Initiate", "Sample Cleric Spells", "Sample Ward");
  const character = makeChar({
    classes: [mage(4)],
    originFeats: [takenFeat("Sample Initiate")],
    ruleChoices: [
      {
        id: "TST__Feat Spells__Sample Initiate__Spell List",
        trait: "Sample Initiate Spell List",
        origin: "feat",
        choose: 1,
        from: ["Sample Mage Spells", "Sample Cleric Spells"],
        picked: ["Sample Cleric Spells"],
      },
    ],
    resourceCounters: {
      [oldCounter]: { id: oldCounter, name: "Innate: Sample Pulse", current: 0, max: 1, resetOn: "long" },
      [newCounter]: { id: newCounter, name: "Innate: Sample Ward", current: 0, max: 1, resetOn: "long" },
    },
  });

  const reconciled = reconcile(character, compendium);
  assert.equal(reconciled.resourceCounters?.[oldCounter], undefined, "the counter of the list no longer held is released");
  assert.ok(reconciled.resourceCounters?.[newCounter], "the counter of the list held is kept");
  assert.ok(
    reconciled.needsReview?.includes("Innate: Sample Pulse removed from Sample Initiate: spell list changed"),
    `the release is noticed: ${JSON.stringify(reconciled.needsReview)}`,
  );
});

test("reconciling against a catalog that does not hold the feat keeps its picks, counters and notices", () => {
  const character = withPulseUsed(initiateWithMageList());
  const unloaded = inMemoryCompendium({
    classes: grantedSpellClasses(),
    races: grantedSpellRaces(),
    spells: grantedSpellSpells(),
    backgrounds: grantedSpellBackgrounds(),
  });

  const reconciled = reconcile(character, unloaded);
  assert.deepEqual(reconciled.ruleChoices, character.ruleChoices, "every pick is kept");
  assert.deepEqual(reconciled.resourceCounters, character.resourceCounters, "every counter is kept");
  assert.deepEqual(reconciled.needsReview ?? [], character.needsReview ?? [], "no notice is raised");
});

test("reconciling against a catalog that holds other books but not the feat's book keeps its picks, counters and notices", () => {
  // The SRD Baseline is the catalog when the integrated one is not loaded: it holds feats, but none of the feat's book.
  const character = withPulseUsed(initiateWithMageList());
  const baselineOnly = inMemoryCompendium({
    classes: grantedSpellClasses(),
    feats: [{ name: "Sample Elsewhere", source: "SRD", prerequisite: null, abilityScoreIncrease: null, description: "Placeholder description for the feat." }],
    races: grantedSpellRaces(),
    spells: grantedSpellSpells(),
    backgrounds: grantedSpellBackgrounds(),
  });

  const reconciled = reconcile(character, baselineOnly);
  assert.deepEqual(reconciled.ruleChoices, character.ruleChoices, "every pick is kept");
  assert.deepEqual(reconciled.resourceCounters, character.resourceCounters, "every counter is kept");
  assert.deepEqual(reconciled.needsReview ?? [], character.needsReview ?? [], "no notice is raised");
});

test("reconciling against a loaded catalog that no longer holds the feat still releases its picks and counters", () => {
  const character = withPulseUsed(initiateWithMageList());
  const withoutFeat = inMemoryCompendium({
    classes: grantedSpellClasses(),
    feats: grantedSpellFeats().filter((feat) => feat.name !== "Sample Initiate"),
    races: grantedSpellRaces(),
    spells: grantedSpellSpells(),
    backgrounds: grantedSpellBackgrounds(),
  });

  const reconciled = reconcile(character, withoutFeat);
  assert.deepEqual(reconciled.ruleChoices ?? [], [], "the picks are released");
  assert.deepEqual(reconciled.resourceCounters ?? {}, {}, "the counter is released");
  assert.ok(reconciled.needsReview?.includes("Sample Ember removed from Sample Initiate: feat no longer held"));
  // The catalog no longer names the feat, so its counter's notice cannot name it: the counter id carries only a slug.
  assert.ok(reconciled.needsReview?.includes("Innate: Sample Pulse removed: feat no longer held"));
});

test("migrating against an empty race catalog keeps a saved racial spell, with no notice", () => {
  const saved = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Gifted", source: "TST" },
    knownSpells: [{ name: "Sample Ember", source: "TST", ownerKey: "racial__innate" }],
  });

  const migrated = migrateCharacter(saved, [], grantedSpellClasses());
  assert.ok(
    migrated.knownSpells?.some((spell) => spell.name === "Sample Ember" && spell.ownerKey === "racial__innate"),
    "the saved racial spell is kept",
  );
  assert.deepEqual(migrated.needsReview ?? [], [], "no notice is raised");
});

test("removing a feat notices each released spell, its list and its counter, each naming the feat", () => {
  let character = initiateWithMageList();
  const pulse = initiateCard(character)?.spells.find((spell) => spell.name === "Sample Pulse");
  assert.ok(pulse?.resourceCounterId);
  character = toggleInnateSpellUse(character, pulse);

  const removed = removeOriginFeat(character, "Sample Initiate", compendium);
  const expected = [
    "Sample Mage Spells removed from Sample Initiate: feat no longer held",
    "Sample Ember removed from Sample Initiate: feat no longer held",
    "Sample Pulse removed from Sample Initiate: feat no longer held",
    "Innate: Sample Pulse removed from Sample Initiate: feat no longer held",
  ];
  for (const notice of expected) {
    assert.ok(removed.needsReview?.includes(notice), `${notice} (got ${JSON.stringify(removed.needsReview)})`);
  }
});

test("a spell whose book is switched off is released with a notice that names the spell and the feat", () => {
  let character = pickOption(makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Initiate")] }), "Sample Cleric Spells", "Sample Initiate", ALL_BOOKS);
  character = pickOption(character, "Sample Spark", "Sample Initiate", ALL_BOOKS);

  const reconciled = reconcileForActiveBooks(character, compendium, ACTIVE);
  assert.ok(!(reconciled.ruleChoices ?? []).some((entry) => entry.picked.includes("Sample Spark")), "the pick is released");
  assert.ok(
    reconciled.needsReview?.includes("Sample Spark removed from Sample Initiate: no longer offered"),
    `got ${JSON.stringify(reconciled.needsReview)}`,
  );
});

test("removing a feat notices its released casting ability by name, and the feat", () => {
  let character = makeChar({ classes: [mage(4)], originFeats: [takenFeat("Sample Lorekeeper")] });
  character = pickOption(character, "Sample Hall 1", "Sample Lorekeeper");
  character = pickOption(character, "int", "Sample Lorekeeper");

  const removed = removeOriginFeat(character, "Sample Lorekeeper", compendium);
  assert.ok(
    removed.needsReview?.includes("Intelligence casting ability removed from Sample Lorekeeper: feat no longer held"),
    `got ${JSON.stringify(removed.needsReview)}`,
  );
});

/** The character with its Sample Pulse counter used, as a player leaves it after a Long Rest's use. */
function withPulseUsed(character: Character): Character {
  const pulse = initiateCard(character)?.spells.find((spell) => spell.name === "Sample Pulse");
  assert.ok(pulse?.resourceCounterId);
  return toggleInnateSpellUse(character, pulse);
}
