import { test } from "node:test";
import assert from "node:assert/strict";
import { integratedTestCompendium, makeChar, resetTestCompendium } from "./testUtils.ts";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { learnableSpells } from "../src/rules/learnableSpells.ts";
import { getClassSpellProfiles, type ClassSpellProfile } from "../src/rules/spellcasting.ts";
import { levelUpLearnableSpells, newSpellsForLevelUp, planLevelUp, setPlanSubclass } from "../src/rules/levelUpFlow.ts";
import type { Character } from "../src/types/character.ts";

const compendium = integratedTestCompendium();
const opts = { compendium, activeBooks: ALL_BOOKS };

function profileOf(character: Character, className: string): ClassSpellProfile {
  const profile = getClassSpellProfiles(character, opts).find((p) => p.className === className);
  assert.ok(profile, `${className} has a Spell Owner`);
  return profile;
}

const eldritchKnight3 = makeChar({
  baseAbilityScores: { str: 15, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
  classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Eldritch Knight", subclassSource: "PHB" }],
});

test("an Eldritch Knight's list is restricted to Abjuration and Evocation, outside cantrips, and offers Wizard spells", () => {
  const { spells, restrictedSchools } = learnableSpells(eldritchKnight3, profileOf(eldritchKnight3, "Fighter"), opts);
  assert.deepEqual(restrictedSchools, ["Abjuration", "Evocation"]);
  assert.ok(spells.some((s) => s.name === "Magic Missile"), "a Wizard spell of a restricted school is listed");
  assert.ok(spells.some((s) => s.name === "Identify"), "a Wizard spell of an unrestricted school is listed");
  assert.ok(spells.some((s) => s.level === 0 && s.school === "Evocation"), "a restricted-school cantrip is never restricted");
});

test("an Arcane Trickster's restricted schools are Enchantment and Illusion; other owners are unrestricted", () => {
  const trickster = makeChar({
    baseAbilityScores: { str: 8, dex: 16, con: 14, int: 14, wis: 10, cha: 12 },
    classes: [{ className: "Rogue", source: "PHB", level: 3, subclassName: "Arcane Trickster", subclassSource: "PHB" }],
  });
  assert.deepEqual(learnableSpells(trickster, profileOf(trickster, "Rogue"), opts).restrictedSchools, ["Enchantment", "Illusion"]);

  const wizard = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
  });
  assert.deepEqual(learnableSpells(wizard, profileOf(wizard, "Wizard"), opts).restrictedSchools, []);
});

test("a level-up Fighter 2 to 3 Eldritch Knight is offered the list learnableSpells gives for that profile", () => {
  resetTestCompendium();
  const fighter2 = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 2 }],
  });
  const result = planLevelUp(fighter2, { className: "Fighter", hitPoints: { mode: "average" }, ...opts });
  if (!result.ok) assert.fail(result.reason);
  const plan = setPlanSubclass(fighter2, result.plan, "Eldritch Knight", "PHB", opts);
  const offered = newSpellsForLevelUp(fighter2, plan, opts);
  const direct = learnableSpells(eldritchKnight3, profileOf(eldritchKnight3, "Fighter"), opts).spells;
  assert.ok(offered.length > 0);
  assert.deepEqual(
    offered.map((s) => s.name),
    direct.map((s) => s.name),
    "the level-up list is the list learnableSpells gives for the same owner",
  );
});

test("a level-up plan's learnable list carries the restricted schools of the planned Eldritch Knight", () => {
  const fighter2 = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 2 }],
  });
  const result = planLevelUp(fighter2, { className: "Fighter", hitPoints: { mode: "average" }, ...opts });
  if (!result.ok) assert.fail(result.reason);
  const plan = setPlanSubclass(fighter2, result.plan, "Eldritch Knight", "PHB", opts);
  const learnable = levelUpLearnableSpells(fighter2, plan, opts);
  assert.deepEqual(learnable.restrictedSchools, ["Abjuration", "Evocation"]);
  assert.deepEqual(learnable.spells.map((s) => s.name), newSpellsForLevelUp(fighter2, plan, opts).map((s) => s.name));
});

test("a spell known by one Spell Owner is still offered to another owner's class", () => {
  const character = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 14 },
    classes: [
      { className: "Wizard", source: "PHB", level: 3 },
      { className: "Sorcerer", source: "PHB", level: 1 },
    ],
    knownSpells: [{ name: "Shield", source: "PHB", ownerKey: "Wizard__PHB" }],
  });

  const sorcerer2 = planLevelUp(character, { className: "Sorcerer", ...opts });
  if (!sorcerer2.ok) assert.fail(sorcerer2.reason);
  const offeredToSorcerer = newSpellsForLevelUp(character, sorcerer2.plan, opts);
  assert.ok(offeredToSorcerer.some((s) => s.name === "Shield"), "the Sorcerer owner does not know Shield, so it is offered");

  const wizard4 = planLevelUp(character, { className: "Wizard", ...opts });
  if (!wizard4.ok) assert.fail(wizard4.reason);
  const offeredToWizard = newSpellsForLevelUp(character, wizard4.plan, opts);
  assert.ok(!offeredToWizard.some((s) => s.name === "Shield"), "the Wizard owner already knows Shield, so it is not offered");
});
