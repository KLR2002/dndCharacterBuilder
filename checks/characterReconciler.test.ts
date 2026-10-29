import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";

const validMulticlassCharacter = () =>
  makeChar({
    classes: [
      { className: "Fighter", source: "PHB", level: 3, subclassName: "Battle Master" },
      { className: "Warlock", source: "PHB", level: 11 },
      { className: "Artificer", source: "TCE", level: 2 },
    ],
    ruleChoices: [
      { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", picked: ["Archery"], choose: 1, options: [], origin: "class" },
      { id: "PHB__Fighter__Battle Master__Maneuvers 3", trait: "Combat Superiority", picked: ["Parry", "Riposte", "Trip Attack"], choose: 3, options: [], origin: "class" },
      { id: "PHB__Warlock__Pact Boon", trait: "Pact Boon", picked: ["Pact of the Tome"], choose: 1, options: [], origin: "class" },
      { id: "Warlock__Pact of the Tome__Cantrips", trait: "Pact of the Tome Cantrips", picked: ["Guidance", "Shillelagh", "Vicious Mockery"], choose: 3, options: [], origin: "class" },
      { id: "PHB__Warlock__Invocations 2", trait: "Eldritch Invocations (2nd Level)", picked: ["Agonizing Blast", "Armor of Shadows"], choose: 2, options: [], origin: "class" },
      { id: "Warlock__Mystic Arcanum 11", trait: "Mystic Arcanum (6th Level)", picked: ["Circle of Death"], choose: 1, options: [], origin: "class" },
      { id: "TCE__Artificer__Infusions 2", trait: "Infusions Known (2nd Level)", picked: ["Enhanced Defense", "Mind Sharpener"], choose: 4, options: [], origin: "class" },
    ],
    knownSpells: [
      { name: "Eldritch Blast", ability: "cha", className: "Warlock", source: "PHB" },
      { name: "Guidance", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
      { name: "Shillelagh", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
      { name: "Vicious Mockery", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
    ],
  });

test("reconcile running twice on a valid character changes nothing", () => {
  const compendium = currentCompendium();
  const valid = validMulticlassCharacter();

  const once = reconcile(valid, compendium, { activeBooks: ALL_BOOKS });
  const twice = reconcile(once, compendium, { activeBooks: ALL_BOOKS });

  // A valid character is a fixed point: nothing is pruned, reordered or noticed.
  assert.deepEqual(once.ruleChoices, valid.ruleChoices);
  assert.deepEqual(once.knownSpells, valid.knownSpells);
  assert.deepEqual(once.needsReview ?? [], []);
  assert.deepEqual(twice, once);
});

test("reconcile records a review notice when de-levelling removes Pact of the Tome cantrips", () => {
  const compendium = currentCompendium();
  const warlock3 = makeChar({
    classes: [{ className: "Warlock", source: "PHB", level: 3 }],
    ruleChoices: [
      { id: "PHB__Warlock__Pact Boon", trait: "Pact Boon", origin: "class", choose: 1, from: [], picked: ["Pact of the Tome"] },
      { id: "Warlock__Pact of the Tome__Cantrips", trait: "Pact of the Tome Cantrips", origin: "class", choose: 3, from: [], picked: ["Guidance"] },
    ],
    knownSpells: [
      { name: "Guidance", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
    ],
  });

  const delevelled = reconcile(
    { ...warlock3, classes: [{ className: "Warlock", source: "PHB", level: 2 }] },
    compendium, { activeBooks: ALL_BOOKS }
  );

  assert.ok(!delevelled.ruleChoices?.some((rc) => rc.id === "Warlock__Pact of the Tome__Cantrips"));
  assert.ok(!delevelled.knownSpells?.some((k) => k.ownerKey === "Warlock__Tome"));
  assert.deepEqual(delevelled.needsReview, [
    "Pact Boon removed: prerequisite no longer satisfied",
    "Pact of the Tome Cantrips removed: character no longer possesses Pact of the Tome",
  ]);
});

test("reconcile records a review notice when de-levelling drops Pact Boon below level 3", () => {
  const compendium = currentCompendium();
  const delevelled = makeChar({
    classes: [
      { className: "Warlock", source: "PHB", level: 2 },
      { className: "Fighter", source: "PHB", level: 3 },
    ],
    ruleChoices: [
      { id: "PHB__Warlock__Pact Boon", trait: "Pact Boon", origin: "class", choose: 1, from: [], picked: ["Pact of the Blade"] },
      { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: [], picked: ["Dueling"] },
    ],
  });

  const updated = reconcile(delevelled, compendium, { activeBooks: ALL_BOOKS });

  assert.deepEqual(updated.ruleChoices, [
    { id: "PHB__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: [], picked: ["Dueling"] },
  ]);
  assert.deepEqual(updated.needsReview, ["Pact Boon removed: prerequisite no longer satisfied"]);
});
