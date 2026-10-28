import test from "node:test";
import assert from "node:assert/strict";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import { featCounterId, featSpellRuleChoices, heldFeatsOf } from "../src/rules/choices/featSpells.ts";
import { clearAncestryChoice } from "../src/rules/ancestryEngine.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile, teardownSubclass } from "../src/rules/characterReconciler.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { applyOriginFeat } from "../src/rules/feats.ts";
import { applyAsiSelection } from "../src/rules/leveling.ts";
import { applySoleSubclasses, changeRace, changeSubclass, removeClassLevel, setCustomBackground } from "../src/rules/builderTransitions.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import type { ClassData, FeatData } from "../src/types/dnd5e.ts";
import type { AvailableRuleChoice } from "../src/rules/choices/types.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import {
  grantedSpellBackgrounds,
  grantedSpellClasses,
  grantedSpellFeats,
  grantedSpellSpells,
} from "./grantedSpellsFixture.ts";

// Which record of a feat held in two books a background claim resolves to (ADR 0017). Every name is invented
// (checks/grantedSpellsFixture.ts). "TST" and "TST2" are two invented books that each hold Sample Initiate.

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });
const sampleInitiate = grantedSpellFeats().find((feat) => feat.name === "Sample Initiate") as FeatData;

/** The sample feats, with a Sample Initiate record for each book given, in the order given. */
const catalogFeats = (...books: string[]): FeatData[] => [
  ...books.map((source): FeatData => ({ ...sampleInitiate, source })),
  ...grantedSpellFeats().filter((feat) => feat.name !== "Sample Initiate"),
];

/** A character whose background claims Sample Initiate, the background being the one given. */
const claimed = (background: { name: string; source: string }): Character =>
  makeChar({
    classes: [mage(4)],
    background: { name: background.name, source: background.source },
    originFeats: [{ level: 1, type: "feat", featName: "Sample Initiate", featSource: BACKGROUND_FEAT_SOURCE }],
  });

test("a background-claimed feat held in two books resolves to the background's own book before catalog order", () => {
  const held = heldFeatsOf(claimed({ name: "Sample Drifter", source: "TST2" }), catalogFeats("TST", "TST2"));
  assert.equal(held[0]?.feat.source, "TST2", "the book the background comes from is chosen before the first record listed");
});

test("an active book's record of a background-claimed feat outranks the background's own book and the catalog order", () => {
  const held = heldFeatsOf(claimed({ name: "Sample Drifter", source: "TST2" }), catalogFeats("TST2", "TST"), ["TST"]);
  assert.equal(held[0]?.feat.source, "TST", "the active book's record is chosen, though it is listed second and is not the background's book");
});

test("a pick made on a background-claimed feat is saved under the record it was made on, and every later load keeps it", () => {
  const compendium = inMemoryCompendium({
    classes: grantedSpellClasses(),
    feats: catalogFeats("TST", "TST2"),
    spells: grantedSpellSpells(),
    backgrounds: grantedSpellBackgrounds(),
  });
  const offered = (character: Character, option: string): AvailableRuleChoice => {
    const choice = featSpellRuleChoices(character, compendium).find((c) => c.options.some((o) => o.name === option));
    assert.ok(choice, `${option} is offered`);
    return choice;
  };
  let character = claimed({ name: "Sample Drifter", source: "TST2" });
  character = pickRuleChoice(character, offered(character, "Sample Mage Spells"), "Sample Mage Spells", compendium);
  character = pickRuleChoice(character, offered(character, "Sample Ember"), "Sample Ember", compendium);

  const saved = character.ruleChoices ?? [];
  assert.ok(
    saved.length > 0 && saved.every((entry) => entry.id.startsWith("TST2__Feat Spells__Sample Initiate__")),
    `the picks are keyed by the record they were made on: ${saved.map((entry) => entry.id).join(" | ")}`,
  );

  let loaded = character;
  for (let load = 0; load < 2; load += 1) loaded = reconcile(migrateCharacter(loaded, [], grantedSpellClasses()), compendium);
  assert.deepEqual(loaded.ruleChoices, character.ruleChoices, "the picks are kept as saved, with the same ids, on every load");
  assert.deepEqual(loaded.needsReview ?? [], [], "no notice is raised on load");
});

test("a background book switched off keeps the pick made on the record still offered, and reconciling without the active books keeps it too", () => {
  const compendium = inMemoryCompendium(
    {
      classes: grantedSpellClasses(),
      feats: catalogFeats("TST", "TST2"),
      spells: grantedSpellSpells(),
      backgrounds: grantedSpellBackgrounds(),
    },
    { integrated: true },
  );
  let character = claimed({ name: "Sample Drifter", source: "TST2" });
  const list = featSpellRuleChoices(character, compendium, ["TST"]).find((c) => c.options.some((o) => o.name === "Sample Mage Spells"));
  assert.ok(list, "the list is offered from the active book");
  character = pickRuleChoice(character, list, "Sample Mage Spells", compendium);
  assert.ok(
    character.ruleChoices?.some((entry) => entry.id.startsWith("TST__Feat Spells__Sample Initiate__")),
    "the pick is made on the record of the active book",
  );

  const reconciled = reconcile(character, compendium);
  assert.deepEqual(reconciled.ruleChoices, character.ruleChoices, "the pick is kept");
  assert.deepEqual(reconciled.needsReview ?? [], [], "no notice is raised");
});

// Two records of Sample Initiate: the first book's lists the Mage and the Cleric list, the second book's only the Cleric list.
// The background comes from the second book, so without the active books the second record is the one held.
const twoListsCatalog = (): FeatData[] => [
  { ...sampleInitiate, source: "TST" },
  { ...sampleInitiate, source: "TST2", additionalSpells: (sampleInitiate.additionalSpells ?? []).filter((grant) => grant.name === "Sample Cleric Spells") },
  ...grantedSpellFeats().filter((feat) => feat.name !== "Sample Initiate"),
];

const twoListsCompendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  feats: twoListsCatalog(),
  spells: grantedSpellSpells(),
  backgrounds: grantedSpellBackgrounds(),
});

const TWO_ACTIVE_BOOKS = ["TST", "TST2"];
const MAGE_COUNTER = featCounterId("Sample Initiate", "Sample Mage Spells", "Sample Pulse");

/** A background from the second book claims Sample Initiate. The first book's record is held, its Mage list is picked and that list's counter is used. */
const claimedWithMageCounter = (): Character =>
  makeChar({
    classes: [mage(4)],
    background: { name: "Sample Drifter", source: "TST2" },
    originFeats: [{ level: 1, type: "feat", featName: "Sample Initiate", featSource: BACKGROUND_FEAT_SOURCE }],
    ruleChoices: [
      {
        id: "TST__Feat Spells__Sample Initiate__Spell List",
        trait: "Sample Initiate Spell List",
        origin: "feat",
        choose: 1,
        from: ["Sample Mage Spells", "Sample Cleric Spells"],
        picked: ["Sample Mage Spells"],
      },
    ],
    resourceCounters: {
      [MAGE_COUNTER]: { id: MAGE_COUNTER, name: "Innate: Sample Pulse", current: 0, max: 1, resetOn: "long" },
    },
  });

test("applying an origin feat keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const applied = applyOriginFeat(
    claimedWithMageCounter(),
    { level: 1, type: "feat", featName: "Sample Study", featSource: "TST" },
    undefined,
    twoListsCompendium,
    TWO_ACTIVE_BOOKS,
  );
  assert.ok(applied.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(applied.needsReview ?? [], [], "no notice is raised");
});

test("changing race keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const changed = changeRace(claimedWithMageCounter(), twoListsCompendium, TWO_ACTIVE_BOOKS);
  assert.ok(changed.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(changed.needsReview ?? [], [], "no notice is raised");
});

test("applying an ability score increase keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const applied = applyAsiSelection(
    claimedWithMageCounter(),
    { level: 4, type: "feat", featName: "Sample Study", featSource: "TST" },
    twoListsCompendium,
    TWO_ACTIVE_BOOKS,
  );
  assert.ok(applied.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(applied.needsReview ?? [], [], "no notice is raised");
});

test("changing the subclass keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const withPath = {
    ...claimedWithMageCounter(),
    classes: [{ ...mage(4), subclassName: "Sample Old Path", subclass: "Sample Old Path", subclassSource: "TST" }],
  };
  const changed = changeSubclass(withPath, "Sample Mage", "Sample New Path", "TST", [], twoListsCompendium, TWO_ACTIVE_BOOKS);
  assert.ok(changed.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(changed.needsReview ?? [], [], "no notice is raised");
});

test("applying the lone subclass keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const mageWithOneSubclass = {
    ...grantedSpellClasses().find((c) => c.name === "Sample Mage"),
    subclasses: [{ name: "Sample Sole Path", source: "TST" }],
  } as unknown as ClassData;
  const compendium = inMemoryCompendium({
    classes: [mageWithOneSubclass],
    feats: twoListsCatalog(),
    spells: grantedSpellSpells(),
    backgrounds: grantedSpellBackgrounds(),
  });
  const applied = applySoleSubclasses(claimedWithMageCounter(), compendium, TWO_ACTIVE_BOOKS);
  assert.equal(applied.classes[0]?.subclassName, "Sample Sole Path", "the lone subclass is applied");
  assert.ok(applied.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(applied.needsReview ?? [], [], "no notice is raised");
});

// A custom background has no book of its own, so with both books active the record resolved is the first of them in catalog
// order. A third, inactive book listed first is what would otherwise be resolved once the background is custom.
const customBackgroundCatalog = (): FeatData[] => [
  { ...sampleInitiate, source: "TST3", additionalSpells: (sampleInitiate.additionalSpells ?? []).filter((grant) => grant.name === "Sample Cleric Spells") },
  ...twoListsCatalog(),
];

test("setting a custom background keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const compendium = inMemoryCompendium({
    classes: grantedSpellClasses(),
    feats: customBackgroundCatalog(),
    spells: grantedSpellSpells(),
    backgrounds: grantedSpellBackgrounds(),
  });
  const changed = setCustomBackground(claimedWithMageCounter(), "Sample Custom", [], {}, compendium, TWO_ACTIVE_BOOKS);
  assert.equal(changed.background?.source, "Custom", "the background is custom");
  assert.ok(changed.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(changed.needsReview ?? [], [], "no notice is raised");
});

test("clearing an ancestry choice keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const base = claimedWithMageCounter();
  const withAncestryPick: Character = {
    ...base,
    ruleChoices: [
      ...(base.ruleChoices ?? []),
      { id: "TST__Sample Race__Sample Pick", trait: "Sample Pick", origin: "race", choose: 1, from: ["Sample Alpha", "Sample Beta"], picked: ["Sample Alpha"] },
    ],
  };
  const cleared = clearAncestryChoice(withAncestryPick, "TST__Sample Race__Sample Pick", { compendium: twoListsCompendium, activeBooks: TWO_ACTIVE_BOOKS });
  assert.equal(cleared.ruleChoices?.some((entry) => entry.id === "TST__Sample Race__Sample Pick"), false, "the ancestry pick is cleared");
  assert.ok(cleared.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(cleared.needsReview ?? [], [], "no notice is raised");
});

test("a pick made in the rest modal keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  // An invented race choice of the kind a long rest lets the player change.
  const changeable: AvailableRuleChoice = {
    id: "TST__Sample Race__Sample Pick",
    traitName: "Sample Pick",
    choose: 1,
    level: 1,
    effectLevel: 1,
    origin: "race",
    options: [
      { name: "Sample Alpha", description: "Placeholder option." },
      { name: "Sample Beta", description: "Placeholder option." },
    ],
  };
  const picked = pickRuleChoice(claimedWithMageCounter(), changeable, "Sample Alpha", twoListsCompendium, TWO_ACTIVE_BOOKS);
  assert.ok(picked.ruleChoices?.some((entry) => entry.id === changeable.id && entry.picked.includes("Sample Alpha")), "the pick is recorded");
  assert.ok(picked.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(picked.needsReview ?? [], [], "no notice is raised");
});

test("a proficiency pick keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  // An invented background choice of a tool, the kind a Proficiency Choice offers.
  const proficiency: AvailableRuleChoice = {
    id: "TST__Sample Background__Sample Tool Pick",
    traitName: "Sample Tool Pick",
    choose: 1,
    level: 1,
    effectLevel: 1,
    origin: "background",
    pick: "proficiency",
    options: [
      { name: "Sample Lute", description: "Placeholder tool." },
      { name: "Sample Kit", description: "Placeholder tool." },
    ],
  };
  const picked = pickRuleChoice(claimedWithMageCounter(), proficiency, "Sample Lute", twoListsCompendium, TWO_ACTIVE_BOOKS);
  assert.ok(picked.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(picked.needsReview ?? [], [], "no notice is raised");
});

test("removing a class level keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const removed = removeClassLevel(claimedWithMageCounter(), "Sample Mage", twoListsCompendium, TWO_ACTIVE_BOOKS);
  assert.equal(removed.classes[0]?.level, 3, "the level is removed");
  assert.ok(removed.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(removed.needsReview ?? [], [], "no notice is raised");
});

test("tearing down a subclass keeps the counter of a background-claimed feat that two active books hold, with no notice", () => {
  const torn = teardownSubclass(claimedWithMageCounter(), "Sample Mage", "Sample Old Path", twoListsCompendium, TWO_ACTIVE_BOOKS);
  assert.ok(torn.resourceCounters?.[MAGE_COUNTER], "the counter of the list held is kept");
  assert.deepEqual(torn.needsReview ?? [], [], "no notice is raised");
});
