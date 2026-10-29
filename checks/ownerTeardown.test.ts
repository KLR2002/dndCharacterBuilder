import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile, teardownSubclass } from "../src/rules/characterReconciler.ts";
import { GIANT_POWER_CHOICE_ID } from "../src/rules/choices/types.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { makeChar } from "./testUtils.ts";

// Subclass teardown removes a Rule Choice only when its id is recognised (by the subclass choice
// table or a specialised choice module) and its owner is the torn-down class with a subclass.
// Every case below asserts the removal and at least one non-owner choice that must be kept.

const RACE_CHOICE = {
  id: "MPMM__Aasimar__null__Celestial Revelation",
  trait: "Celestial Revelation",
  origin: "race" as const,
  choose: 1,
  from: ["Radiant Soul"],
  picked: ["Radiant Soul"],
};

const BIOME_CHOICE = {
  id: "PHB__Druid__Circle of the Land__Biome",
  trait: "Circle of the Land: Biome",
  origin: "subclass" as const,
  choose: 1,
  from: ["Coast"],
  picked: ["Coast"],
};

const AFFINITY_CHOICE = {
  id: "XGE__Sorcerer__Divine Soul__Affinity",
  trait: "Divine Soul: Divine Affinity",
  origin: "subclass" as const,
  choose: 1,
  from: ["Good", "Evil"],
  picked: ["Good"],
};

test("teardown never removes an id that no table or module recognises, even when its text looks like an owned choice", () => {
  const initial = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 3, subclassName: "Circle of the Land" }],
    ruleChoices: [
      // Name-alike ids that the subclass table does not contain. They must survive teardown.
      { ...BIOME_CHOICE, id: "HOMEBREW__Druid__Circle of the Land__Biome" },
      { ...AFFINITY_CHOICE, id: "PHB__Sorcerer__Divine Soul__Affinity Extra" },
      { ...BIOME_CHOICE, id: "PHB__Druid__Circle of the Land__Biome Variant", origin: "subclass" as const },
    ],
  });

  const tornDown = teardownSubclass(initial, "Druid", "Circle of the Land", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(
    tornDown.ruleChoices?.map((rc) => rc.id),
    [
      "HOMEBREW__Druid__Circle of the Land__Biome",
      "PHB__Sorcerer__Divine Soul__Affinity Extra",
      "PHB__Druid__Circle of the Land__Biome Variant",
    ],
  );
  assert.deepEqual(tornDown.needsReview ?? [], []);
});

test("Druid teardown removes the Circle of the Land biome and keeps a race choice", () => {
  const initial = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 3, subclassName: "Circle of the Land" }],
    ruleChoices: [BIOME_CHOICE, RACE_CHOICE],
  });

  const tornDown = teardownSubclass(initial, "Druid", "Circle of the Land", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(tornDown.ruleChoices?.map((rc) => rc.id), [RACE_CHOICE.id]);
  assert.deepEqual(tornDown.needsReview, ["Circle of the Land: Biome removed: subclass no longer held"]);
});

test("Sorcerer teardown removes the Divine Soul affinity and keeps a Druid-owned choice", () => {
  const initial = makeChar({
    classes: [{ className: "Sorcerer", source: "XGE", level: 3, subclassName: "Divine Soul" }],
    ruleChoices: [AFFINITY_CHOICE, BIOME_CHOICE],
  });

  const tornDown = teardownSubclass(initial, "Sorcerer", "Divine Soul", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(tornDown.ruleChoices?.map((rc) => rc.id), [BIOME_CHOICE.id]);
  assert.deepEqual(tornDown.needsReview, ["Divine Soul: Divine Affinity removed: subclass no longer held"]);
});

test("Cleric teardown removes domain cantrips for the old domain and keeps a Warlock-owned choice", () => {
  const acolyte = {
    id: "PHB__Cleric__Nature Domain__Acolyte of Nature",
    trait: "Acolyte of Nature Cantrip",
    origin: "subclass" as const,
    choose: 1,
    from: ["Druidcraft"],
    picked: ["Druidcraft"],
  };
  const reaper = {
    id: "DMG__Cleric__Death Domain__Reaper",
    trait: "Reaper Cantrip",
    origin: "subclass" as const,
    choose: 1,
    from: ["Chill Touch"],
    picked: ["Chill Touch"],
  };
  const genieKind = {
    id: "TCE__Warlock__The Genie__Kind",
    trait: "The Genie: Genie Kind",
    origin: "subclass" as const,
    choose: 1,
    from: ["Djinni"],
    picked: ["Djinni"],
  };
  const initial = makeChar({
    classes: [{ className: "Cleric", source: "PHB", level: 3, subclassName: "Nature" }],
    ruleChoices: [acolyte, reaper, genieKind],
  });

  const tornDown = teardownSubclass(initial, "Cleric", "Nature", currentCompendium(), ALL_BOOKS);

  // Both domain cantrips are Cleric subclass choices, so both go; the Warlock-owned kind stays.
  assert.deepEqual(tornDown.ruleChoices?.map((rc) => rc.id), [genieKind.id]);
  assert.deepEqual(tornDown.needsReview, [
    "Acolyte of Nature Cantrip removed: subclass no longer held",
    "Reaper Cantrip removed: subclass no longer held",
  ]);
});

test("Fighter teardown removes the Champion additional style and keeps the class Fighting Style", () => {
  const championStyle = {
    id: "PHB__Fighter__Additional Fighting Style 10",
    trait: "Additional Fighting Style",
    origin: "class" as const,
    choose: 1,
    from: ["Archery"],
    picked: ["Archery"],
  };
  const classStyle = {
    id: "PHB__Fighter__Fighting Style",
    trait: "Fighting Style",
    origin: "class" as const,
    choose: 1,
    from: ["Defense"],
    picked: ["Defense"],
  };
  const initial = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 10, subclassName: "Champion" }],
    ruleChoices: [championStyle, classStyle],
  });

  const tornDown = teardownSubclass(initial, "Fighter", "Champion", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(tornDown.ruleChoices?.map((rc) => rc.id), [classStyle.id]);
  assert.deepEqual(tornDown.needsReview, ["Additional Fighting Style removed: subclass no longer held"]);
});

test("Fighter teardown removes Battle Master maneuvers and keeps the class Fighting Style", () => {
  const maneuvers = {
    id: "PHB__Fighter__Battle Master__Maneuvers 3",
    trait: "Combat Superiority (3rd Level)",
    origin: "subclass" as const,
    choose: 3,
    from: ["Trip Attack", "Riposte", "Disarming Attack"],
    picked: ["Trip Attack", "Riposte", "Disarming Attack"],
  };
  const classStyle = {
    id: "PHB__Fighter__Fighting Style",
    trait: "Fighting Style",
    origin: "class" as const,
    choose: 1,
    from: ["Defense"],
    picked: ["Defense"],
  };
  const initial = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Battle Master" }],
    ruleChoices: [maneuvers, classStyle],
  });

  const tornDown = teardownSubclass(initial, "Fighter", "Battle Master", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(tornDown.ruleChoices?.map((rc) => rc.id), [classStyle.id]);
  assert.deepEqual(tornDown.needsReview, ["Combat Superiority (3rd Level) removed: subclass no longer held"]);
});

test("Warlock teardown removes the Genie kind and keeps the Pact of the Tome cantrips", () => {
  const initial = makeChar({
    classes: [{ className: "Warlock", source: "TCE", level: 3, subclassName: "The Genie" }],
    ruleChoices: [
      {
        id: "TCE__Warlock__The Genie__Kind",
        trait: "The Genie: Genie Kind",
        origin: "subclass",
        choose: 1,
        from: ["Djinni"],
        picked: ["Djinni"],
      },
      {
        id: "PHB__Warlock__Pact Boon",
        trait: "Pact Boon",
        origin: "class",
        choose: 1,
        from: ["Pact of the Tome"],
        picked: ["Pact of the Tome"],
      },
      {
        id: "Warlock__Pact of the Tome__Cantrips",
        trait: "Pact of the Tome Cantrips",
        origin: "class",
        choose: 3,
        from: ["Guidance", "Vicious Mockery", "Sacred Flame"],
        picked: ["Guidance"],
      },
    ],
    knownSpells: [
      { name: "Guidance", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
    ],
  });

  const tornDown = teardownSubclass(initial, "Warlock", "The Genie", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(
    tornDown.ruleChoices?.map((rc) => rc.id),
    ["PHB__Warlock__Pact Boon", "Warlock__Pact of the Tome__Cantrips"],
  );
  assert.deepEqual(tornDown.needsReview, ["The Genie: Genie Kind removed: subclass no longer held"]);
});

test("Artificer subclass teardown keeps class-owned infusion picks and removes them only on de-levelling", () => {
  const infusion = {
    id: "TCE__Artificer__Infusions 2",
    trait: "Infusions Known (2nd Level)",
    origin: "class" as const,
    choose: 4,
    from: ["Enhanced Defense"],
    picked: ["Enhanced Defense"],
  };
  const druid = { ...BIOME_CHOICE };

  const changed = makeChar({
    classes: [{ className: "Artificer", source: "TCE", level: 3, subclassName: "Armorer" }],
    ruleChoices: [infusion, druid],
    activeInfusions: [{ infusionName: "Enhanced Defense" }],
  });
  const swapped = teardownSubclass(changed, "Artificer", "Armorer", currentCompendium(), ALL_BOOKS);
  assert.deepEqual(swapped.ruleChoices?.map((rc) => rc.id), [infusion.id, druid.id]);

  const delevelled = teardownSubclass(
    { ...changed, classes: [{ className: "Artificer", source: "TCE", level: 1, subclassName: "Armorer" }] },
    "Artificer",
    "Armorer",
    currentCompendium(), ALL_BOOKS,
  );
  assert.deepEqual(delevelled.ruleChoices?.map((rc) => rc.id), [druid.id]);
  assert.deepEqual(delevelled.needsReview, [
    "Enhanced Defense removed: Artificer level or known infusion no longer meets prerequisite",
  ]);
});

test("Barbarian teardown removes the Totem Spirit and keeps class-owned Primal Knowledge", () => {
  const totemSpirit = {
    id: "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3",
    trait: "Totem Spirit (3rd Level)",
    origin: "subclass" as const,
    choose: 1,
    from: ["Bear", "Eagle", "Wolf"],
    picked: ["Bear"],
  };
  const primalKnowledge = {
    id: "TCE__Barbarian__Primal Knowledge 3",
    trait: "Primal Knowledge (3rd Level)",
    origin: "subclass" as const,
    choose: 1,
    from: ["Athletics", "Stealth"],
    picked: ["Athletics"],
  };
  const initial = makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 3, subclassName: "Totem Warrior" }],
    ruleChoices: [totemSpirit, primalKnowledge],
    optionalFeatureReplacements: { "Primal Knowledge": true },
  });

  const tornDown = teardownSubclass(initial, "Barbarian", "Totem Warrior", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(tornDown.ruleChoices?.map((rc) => rc.id), [primalKnowledge.id]);
  assert.deepEqual(tornDown.needsReview, ["Totem Spirit (3rd Level) removed: subclass no longer held"]);
});

// Review notices: every state a teardown or the Reconciler prunes names what it removed.

const giantCantrip = (name: string) => ({
  name,
  source: "PHB",
  ownerKey: "Barbarian__BGG",
  ability: "wis" as const,
  className: "Barbarian",
});

test("subclass teardown records a review notice when it clears subclass spell swaps", () => {
  const initial = makeChar({
    classes: [{ className: "Sorcerer", source: "TCE", level: 3, subclassName: "Clockwork Soul" }],
    subclassSpellSwaps: { Alarm: "Shield" },
  });

  const tornDown = teardownSubclass(initial, "Sorcerer", "Clockwork Soul", currentCompendium(), ALL_BOOKS);

  assert.equal(tornDown.subclassSpellSwaps, undefined);
  assert.deepEqual(tornDown.needsReview, ["Subclass spell swaps removed: subclass no longer held"]);
});

test("subclass teardown records a review notice for each resource counter it removes", () => {
  const initial = makeChar({
    classes: [{ className: "Wizard", source: "TCE", level: 3, subclassName: "Bladesinging" }],
    resourceCounters: {
      bladesong: { id: "bladesong", name: "Bladesong", current: 2, max: 2, resetOn: "short" },
      arcane_recovery: { id: "arcane_recovery", name: "Arcane Recovery", current: 1, max: 1, resetOn: "long" },
    },
  });

  const tornDown = teardownSubclass(initial, "Wizard", "Bladesinging", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(Object.keys(tornDown.resourceCounters), ["arcane_recovery"]);
  assert.deepEqual(tornDown.needsReview, ["Bladesong removed: subclass no longer held"]);
});

test("subclass teardown records a review notice for each Giant Power cantrip it removes from knownSpells", () => {
  const initial = makeChar({
    classes: [{ className: "Barbarian", source: "BGG", level: 5, subclassName: "Path of the Giant" }],
    knownSpells: [giantCantrip("Druidcraft")],
  });

  const tornDown = teardownSubclass(initial, "Barbarian", "Path of the Giant", currentCompendium(), ALL_BOOKS);

  assert.deepEqual(tornDown.knownSpells, []);
  assert.deepEqual(tornDown.needsReview, ["Giant Power cantrip Druidcraft removed: subclass no longer held"]);
});

test("the Giant Power cantrip sync records a review notice when the pick changes", () => {
  const changed = makeChar({
    classes: [{ className: "Barbarian", source: "BGG", level: 3, subclassName: "Path of the Giant" }],
    ruleChoices: [
      {
        id: GIANT_POWER_CHOICE_ID,
        trait: "Giant Power Cantrip",
        origin: "subclass",
        choose: 1,
        from: ["Druidcraft", "Thaumaturgy"],
        picked: ["Thaumaturgy"],
      },
    ],
    knownSpells: [giantCantrip("Druidcraft")],
  });

  const synced = reconcile(changed, currentCompendium(), { activeBooks: ALL_BOOKS });

  assert.deepEqual(synced.knownSpells?.map((k) => k.name), ["Thaumaturgy"]);
  assert.deepEqual(synced.needsReview, [
    "Giant Power cantrip Druidcraft removed: Giant Power pick is now Thaumaturgy",
  ]);
  assert.deepEqual(reconcile(synced, currentCompendium(), { activeBooks: ALL_BOOKS }), synced, "reconciling again records nothing new");
});

test("the Giant Power cantrip sync records a review notice when the pick is cleared", () => {
  const cleared = makeChar({
    classes: [{ className: "Barbarian", source: "BGG", level: 3, subclassName: "Path of the Giant" }],
    knownSpells: [giantCantrip("Thaumaturgy")],
  });

  const synced = reconcile(cleared, currentCompendium(), { activeBooks: ALL_BOOKS });

  assert.deepEqual(synced.knownSpells, []);
  assert.deepEqual(synced.needsReview, [
    "Giant Power cantrip Thaumaturgy removed: Giant Power pick no longer held",
  ]);
});

test("a saved Giant Barbarian holding both cantrips keeps only the picked one, and leaves other spells alone", () => {
  const saved = makeChar({
    classes: [{ className: "Barbarian", source: "BGG", level: 3, subclassName: "Path of the Giant" }],
    ruleChoices: [
      {
        id: GIANT_POWER_CHOICE_ID,
        trait: "Giant Power Cantrip",
        origin: "subclass",
        choose: 1,
        from: ["Druidcraft", "Thaumaturgy"],
        picked: ["Druidcraft"],
      },
    ],
    knownSpells: [
      giantCantrip("Druidcraft"),
      giantCantrip("Thaumaturgy"),
      { name: "Shield", source: "PHB", ownerKey: "Wizard__PHB", ability: "int" as const, className: "Wizard" },
    ],
  });

  const synced = reconcile(saved, currentCompendium(), { activeBooks: ALL_BOOKS });

  assert.deepEqual(synced.knownSpells?.map((k) => k.name), ["Shield", "Druidcraft"]);
  assert.deepEqual(synced.knownSpells?.find((k) => k.name === "Shield"), saved.knownSpells?.[2]);
  assert.deepEqual(synced.needsReview, [
    "Giant Power cantrip Thaumaturgy removed: Giant Power pick is now Druidcraft",
  ]);
  assert.deepEqual(reconcile(synced, currentCompendium(), { activeBooks: ALL_BOOKS }), synced, "reconciling again records nothing new");
});

// Conjunctive predicates: a class name or a subclass name alone never tears down another class's state.

test("a subclass name alone does not clear swaps, and a class name alone does not clear another class's Giant cantrip", () => {
  const druid = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 3, subclassName: "Circle of the Land" }],
    subclassSpellSwaps: { Alarm: "Shield" },
  });
  const swapsKept = teardownSubclass(druid, "Druid", "Clockwork Soul", currentCompendium(), ALL_BOOKS);
  assert.deepEqual(swapsKept.subclassSpellSwaps, { Alarm: "Shield" });

  const giant = makeChar({
    classes: [{ className: "Barbarian", source: "BGG", level: 5, subclassName: "Path of the Giant" }],
    ruleChoices: [
      {
        id: GIANT_POWER_CHOICE_ID,
        trait: "Giant Power Cantrip",
        origin: "subclass",
        choose: 1,
        from: ["Druidcraft", "Thaumaturgy"],
        picked: ["Druidcraft"],
      },
    ],
    knownSpells: [giantCantrip("Druidcraft")],
  });
  const fighterTorn = teardownSubclass(giant, "Fighter", "Path of the Giant", currentCompendium(), ALL_BOOKS);
  assert.deepEqual(fighterTorn.knownSpells?.map((k) => k.name), ["Druidcraft"]);
  assert.deepEqual(fighterTorn.needsReview ?? [], []);
});
