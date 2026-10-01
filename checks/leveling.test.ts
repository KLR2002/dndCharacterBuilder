import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import {
  getPendingLevelChoices,
  applyAsiSelection,
  removeAsiSelection,
  subclassLevel,
  asiLevels,
} from "../src/rules/leveling.ts";
import type { CharacterClass, AsiSelection } from "../src/types/character.ts";

const cl = (className: string, level: number, subclassName?: string): CharacterClass => ({
  className,
  source: "PHB",
  level,
  subclassName,
});

test("asiLevels follows 2014 rules for Fighter, Rogue, and other classes", () => {
  assert.deepEqual(asiLevels("Fighter"), [4, 6, 8, 12, 14, 16, 19]);
  assert.deepEqual(asiLevels("Rogue"), [4, 8, 10, 12, 16, 19]);
  assert.deepEqual(asiLevels("Wizard"), [4, 8, 12, 16, 19]);
  assert.deepEqual(asiLevels("Cleric"), [4, 8, 12, 16, 19]);
  assert.deepEqual(asiLevels("Barbarian"), [4, 8, 12, 16, 19]);
  assert.deepEqual(asiLevels("Paladin"), [4, 8, 12, 16, 19]);
});

test("subclassLevel returns 1 for Cleric/Sorcerer/Warlock, 2 for Druid/Wizard, 3 for others", () => {
  assert.equal(subclassLevel("Cleric"), 1);
  assert.equal(subclassLevel("Sorcerer"), 1);
  assert.equal(subclassLevel("Warlock"), 1);
  assert.equal(subclassLevel("Druid"), 2);
  assert.equal(subclassLevel("Wizard"), 2);
  assert.equal(subclassLevel("Fighter"), 3);
  assert.equal(subclassLevel("Rogue"), 3);
  assert.equal(subclassLevel("Barbarian"), 3);
  assert.equal(subclassLevel("Bard"), 3);
  assert.equal(subclassLevel("Monk"), 3);
  assert.equal(subclassLevel("Paladin"), 3);
  assert.equal(subclassLevel("Ranger"), 3);
});

test("getPendingLevelChoices flags pending ASI slots based on class-level progression", () => {
  // Fighter at level 6 has 2 ASI thresholds: 4 and 6
  const fighter6 = makeChar({
    classes: [cl("Fighter", 6, "Champion")],
  });
  const pendingFighter = getPendingLevelChoices(fighter6);
  assert.deepEqual(pendingFighter.pendingAsi, [
    { className: "Fighter", classLevel: 4 },
    { className: "Fighter", classLevel: 6 },
  ]);

  // Rogue at level 10 has 3 ASI thresholds: 4, 8, 10
  const rogue10 = makeChar({
    classes: [cl("Rogue", 10, "Thief")],
  });
  const pendingRogue = getPendingLevelChoices(rogue10);
  assert.deepEqual(pendingRogue.pendingAsi, [
    { className: "Rogue", classLevel: 4 },
    { className: "Rogue", classLevel: 8 },
    { className: "Rogue", classLevel: 10 },
  ]);

  // Wizard at level 8 has 2 ASI thresholds: 4, 8
  const wizard8 = makeChar({
    classes: [cl("Wizard", 8, "Evocation")],
  });
  const pendingWizard = getPendingLevelChoices(wizard8);
  assert.deepEqual(pendingWizard.pendingAsi, [
    { className: "Wizard", classLevel: 4 },
    { className: "Wizard", classLevel: 8 },
  ]);
});

test("getPendingLevelChoices excludes fulfilled ASI slots", () => {
  const fighter6WithAsi = makeChar({
    classes: [cl("Fighter", 6, "Champion")],
    asiSelections: [
      { className: "Fighter", classLevel: 4, level: 4, type: "asi", asi: { str: 2 } },
    ],
  });
  const pending = getPendingLevelChoices(fighter6WithAsi);
  // Only level 6 ASI remains pending
  assert.deepEqual(pending.pendingAsi, [
    { className: "Fighter", classLevel: 6 },
  ]);

  // Also handles legacy selections with level matching classLevel when single-class
  const fighter6Legacy = makeChar({
    classes: [cl("Fighter", 6, "Champion")],
    asiSelections: [
      { level: 4, type: "asi", asi: { str: 2 } },
    ],
  });
  const pendingLegacy = getPendingLevelChoices(fighter6Legacy);
  assert.deepEqual(pendingLegacy.pendingAsi, [
    { className: "Fighter", classLevel: 6 },
  ]);
});

test("getPendingLevelChoices flags pending subclasses according to class thresholds", () => {
  // Cleric 1 without subclass -> pending at level 1
  const cleric1 = makeChar({ classes: [cl("Cleric", 1)] });
  assert.deepEqual(getPendingLevelChoices(cleric1).pendingSubclasses, [
    { className: "Cleric", classLevel: 1 },
  ]);

  // Cleric 1 with subclass -> none
  const cleric1WithSub = makeChar({ classes: [cl("Cleric", 1, "Life Domain")] });
  assert.deepEqual(getPendingLevelChoices(cleric1WithSub).pendingSubclasses, []);

  // Wizard 1 -> no subclass pending yet (requires level 2)
  const wizard1 = makeChar({ classes: [cl("Wizard", 1)] });
  assert.deepEqual(getPendingLevelChoices(wizard1).pendingSubclasses, []);

  // Wizard 2 without subclass -> pending at level 2
  const wizard2 = makeChar({ classes: [cl("Wizard", 2)] });
  assert.deepEqual(getPendingLevelChoices(wizard2).pendingSubclasses, [
    { className: "Wizard", classLevel: 2 },
  ]);

  // Fighter 2 -> no subclass pending yet (requires level 3)
  const fighter2 = makeChar({ classes: [cl("Fighter", 2)] });
  assert.deepEqual(getPendingLevelChoices(fighter2).pendingSubclasses, []);

  // Fighter 3 without subclass -> pending at level 3
  const fighter3 = makeChar({ classes: [cl("Fighter", 3)] });
  assert.deepEqual(getPendingLevelChoices(fighter3).pendingSubclasses, [
    { className: "Fighter", classLevel: 3 },
  ]);
});

test("getPendingLevelChoices respects classDataCatalog if provided", () => {
  const customCatalog = [
    { name: "Fighter", source: "PHB", subclasses: [] }, // No subclasses available
    { name: "Cleric", source: "PHB", subclasses: [{ name: "Life Domain" }] },
  ];
  const char = makeChar({
    classes: [cl("Fighter", 3), cl("Cleric", 1)],
  });
  const pending = getPendingLevelChoices(char, customCatalog);
  // Fighter has empty subclasses list in catalog, so not pending
  assert.deepEqual(pending.pendingSubclasses, [
    { className: "Cleric", classLevel: 1 },
  ]);
});

test("getPendingLevelChoices handles multiclass combinations correctly", () => {
  // Fighter 4 / Rogue 4 without any ASI or subclasses
  const multi = makeChar({
    classes: [cl("Fighter", 4), cl("Rogue", 4)],
  });
  const pending = getPendingLevelChoices(multi);
  assert.deepEqual(pending.pendingAsi, [
    { className: "Fighter", classLevel: 4 },
    { className: "Rogue", classLevel: 4 },
  ]);
  assert.deepEqual(pending.pendingSubclasses, [
    { className: "Fighter", classLevel: 3 },
    { className: "Rogue", classLevel: 3 },
  ]);
});

test("applyAsiSelection adds a new ASI selection", () => {
  const initial = makeChar({
    classes: [cl("Fighter", 4, "Champion")],
    asiSelections: [],
  });

  const selection: AsiSelection = {
    className: "Fighter",
    classLevel: 4,
    level: 4,
    type: "asi",
    asi: { str: 2 },
  };

  const updated = applyAsiSelection(initial, selection);
  assert.equal(updated.asiSelections.length, 1);
  assert.deepEqual(updated.asiSelections[0], selection);
  // Original is not mutated
  assert.equal(initial.asiSelections.length, 0);
});

test("applyAsiSelection replaces existing ASI selection for same class and level", () => {
  const initial = makeChar({
    classes: [cl("Fighter", 4, "Champion")],
    asiSelections: [
      { className: "Fighter", classLevel: 4, level: 4, type: "asi", asi: { str: 2 } },
    ],
  });

  // Player changes choice from +2 STR to Feat: Great Weapon Master
  const featSelection: AsiSelection = {
    className: "Fighter",
    classLevel: 4,
    level: 4,
    type: "feat",
    featName: "Great Weapon Master",
    featSource: "PHB",
  };

  const updated = applyAsiSelection(initial, featSelection);
  assert.equal(updated.asiSelections.length, 1);
  assert.equal(updated.asiSelections[0].type, "feat");
  assert.equal(updated.asiSelections[0].featName, "Great Weapon Master");
  // Original was not mutated
  assert.equal(initial.asiSelections[0].type, "asi");
});

test("removeAsiSelection removes the specified ASI selection", () => {
  const initial = makeChar({
    classes: [cl("Fighter", 6, "Champion"), cl("Rogue", 4, "Thief")],
    asiSelections: [
      { className: "Fighter", classLevel: 4, level: 4, type: "asi", asi: { str: 2 } },
      { className: "Fighter", classLevel: 6, level: 6, type: "asi", asi: { con: 2 } },
      { className: "Rogue", classLevel: 4, level: 4, type: "feat", featName: "Alert", featSource: "PHB" },
    ],
  });

  // Remove Fighter level 4 ASI
  const afterRemove = removeAsiSelection(initial, "Fighter", 4);
  assert.equal(afterRemove.asiSelections.length, 2);
  assert.equal(
    afterRemove.asiSelections.some(
      (s) => s.className === "Fighter" && (s.classLevel ?? s.level) === 4
    ),
    false
  );
  // Other selections remain intact
  assert.equal(
    afterRemove.asiSelections.some(
      (s) => s.className === "Fighter" && (s.classLevel ?? s.level) === 6
    ),
    true
  );
  assert.equal(
    afterRemove.asiSelections.some(
      (s) => s.className === "Rogue" && (s.classLevel ?? s.level) === 4
    ),
    true
  );

  // Original character is not mutated
  assert.equal(initial.asiSelections.length, 3);
});
