import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { createCompendium } from "../src/services/compendium.ts";
import { levelUpStepComplete, newSpellsForLevelUp, planLevelUp, setPlanSubclass, type LevelUpPlan } from "../src/rules/levelUpFlow.ts";
import type { CharacterCatalogs } from "../src/rules/catalogs.ts";
import type { SpellData } from "../src/types/dnd5e.ts";
import { integratedTestCompendium, makeChar, srdBaselineBundle, srdBaselineCompendium } from "./testUtils.ts";

const srdOpts: CharacterCatalogs = { compendium: srdBaselineCompendium(), activeBooks: ALL_BOOKS };

function planFor(character: ReturnType<typeof makeChar>, className: string, opts: CharacterCatalogs): LevelUpPlan {
  const result = planLevelUp(character, { className, compendium: opts.compendium, activeBooks: opts.activeBooks });
  if (!result.ok) assert.fail(result.reason);
  return result.plan;
}

function withLearned(plan: LevelUpPlan, spells: SpellData[]): LevelUpPlan {
  return { ...plan, picks: { ...plan.picks, learnedSpells: spells.map((s) => ({ name: s.name, source: s.source })) } };
}

function firstOf(spells: SpellData[], pick: "cantrip" | "leveled"): SpellData {
  const found = spells.find((s) => (pick === "cantrip" ? s.level === 0 : s.level > 0));
  assert.ok(found, `a ${pick} is offered`);
  return found;
}

test("a Sorcerer 3 to 4 is due 1 cantrip and 1 spell, and the Spells step completes only with exactly those", () => {
  const sorcerer = makeChar({ classes: [{ className: "Sorcerer", source: "PHB", level: 3 }] });
  const plan = planFor(sorcerer, "Sorcerer", srdOpts);
  assert.deepEqual(plan.spellsDue, { cantrips: 1, spells: 1 });
  assert.ok(plan.steps.some((s) => s.id === "spells"));

  const offered = newSpellsForLevelUp(sorcerer, plan, srdOpts);
  const cantrip = firstOf(offered, "cantrip");
  const leveled = firstOf(offered, "leveled");
  assert.equal(levelUpStepComplete(withLearned(plan, [leveled]), "spells", srdOpts), false, "one spell alone is short of the cantrip");
  assert.equal(levelUpStepComplete(withLearned(plan, [cantrip]), "spells", srdOpts), false, "one cantrip alone is short of the spell");
  assert.equal(levelUpStepComplete(withLearned(plan, [cantrip, leveled]), "spells", srdOpts), true);
  assert.equal(levelUpStepComplete(withLearned(plan, [cantrip, leveled, leveled]), "spells", srdOpts), false, "one spell too many");
});

test("a Wizard 2 to 3 is due 2 spellbook spells and no cantrips", () => {
  const wizard = makeChar({ classes: [{ className: "Wizard", source: "PHB", level: 2 }] });
  const plan = planFor(wizard, "Wizard", srdOpts);
  assert.deepEqual(plan.spellsDue, { cantrips: 0, spells: 2 });
  const leveled = firstOf(newSpellsForLevelUp(wizard, plan, srdOpts), "leveled");
  assert.equal(levelUpStepComplete(withLearned(plan, [leveled]), "spells", srdOpts), false);
});

test("a Cleric 1 to 2 has no Spells step, and a Cleric 3 to 4 brings one cantrip", () => {
  const cleric1 = makeChar({ classes: [{ className: "Cleric", source: "PHB", level: 1 }] });
  const to2 = planFor(cleric1, "Cleric", srdOpts);
  assert.equal(to2.steps.some((s) => s.id === "spells"), false);

  const cleric3 = makeChar({ classes: [{ className: "Cleric", source: "PHB", level: 3 }] });
  const to4 = planFor(cleric3, "Cleric", srdOpts);
  assert.deepEqual(to4.spellsDue, { cantrips: 1, spells: 0 });
  assert.ok(to4.steps.some((s) => s.id === "spells"));
  assert.equal(levelUpStepComplete(to4, "spells", srdOpts), false);
  const cantrip = firstOf(newSpellsForLevelUp(cleric3, to4, srdOpts), "cantrip");
  assert.equal(levelUpStepComplete(withLearned(to4, [cantrip]), "spells", srdOpts), true);
});

test("a new class's first level is due from zero", () => {
  const empty = makeChar({ baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 14 }, classes: [] });
  const plan = planFor(empty, "Sorcerer", srdOpts);
  assert.deepEqual(plan.spellsDue, { cantrips: 4, spells: 2 });
});

test("a stale Catalog keeps today's rule: a Sorcerer 3 to 4 has the Spells step and completes with no picks", () => {
  const stale = createCompendium({ ...srdBaselineBundle(), hasIntegratedCatalog: true, catalogFormat: 16 });
  assert.equal(stale.stale, true);
  const staleOpts: CharacterCatalogs = { compendium: stale, activeBooks: ALL_BOOKS };
  const sorcerer = makeChar({ classes: [{ className: "Sorcerer", source: "PHB", level: 3 }] });
  const plan = planFor(sorcerer, "Sorcerer", staleOpts);
  assert.equal(plan.spellsDue, null);
  assert.ok(plan.steps.some((s) => s.id === "spells"));
  assert.equal(levelUpStepComplete(plan, "spells", staleOpts), true);
});

test("picking Eldritch Knight in a Fighter 2 to 3 plan brings the Spells step with 2 cantrips and 3 spells; another subclass takes it away", () => {
  const integrated = integratedTestCompendium();
  const intOpts: CharacterCatalogs = { compendium: integrated, activeBooks: ALL_BOOKS };
  const fighter = makeChar({ classes: [{ className: "Fighter", source: "PHB", level: 2 }] });
  const plan = planFor(fighter, "Fighter", intOpts);
  assert.equal(plan.steps.some((s) => s.id === "spells"), false, "no subclass picked: no Spells step");

  const knight = setPlanSubclass(fighter, plan, "Eldritch Knight", "PHB", intOpts);
  assert.deepEqual(knight.spellsDue, { cantrips: 2, spells: 3 });
  assert.ok(knight.steps.some((s) => s.id === "spells"));

  const champion = setPlanSubclass(fighter, knight, "Champion", "PHB", intOpts);
  assert.equal(champion.spellsDue, null);
  assert.equal(champion.steps.some((s) => s.id === "spells"), false);
});
