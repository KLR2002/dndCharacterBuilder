import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import {
  applyLevelUpPlan,
  clearPlanReplacedSpell,
  levelUpReplacementOptions,
  levelUpStepComplete,
  levelUpSummary,
  planLevelUp,
  setPlanReplacedForget,
  setPlanReplacedLearn,
  togglePlanSpell,
  type LevelUpPlan,
} from "../src/rules/levelUpFlow.ts";
import type { CharacterCatalogs } from "../src/rules/catalogs.ts";
import { makeChar, srdBaselineCompendium } from "./testUtils.ts";

const srdOpts: CharacterCatalogs = { compendium: srdBaselineCompendium(), activeBooks: ALL_BOOKS };

function planFor(character: ReturnType<typeof makeChar>, className: string): LevelUpPlan {
  const result = planLevelUp(character, { className, compendium: srdOpts.compendium, activeBooks: srdOpts.activeBooks });
  if (!result.ok) assert.fail(result.reason);
  return result.plan;
}

function spellNamed(name: string): { name: string; source: string } {
  const found = srdBaselineCompendium().findSpell(name);
  assert.ok(found, `${name} is in the SRD Baseline`);
  return { name: found.name, source: found.source };
}

// A Sorcerer 4 holding Shield under the Sorcerer's own key, plus one other known spell.
function sorcerer4WithShield() {
  return makeChar({
    classes: [{ className: "Sorcerer", source: "PHB", level: 4 }],
    knownSpells: [
      { name: "Shield", source: "SRD", ownerKey: "Sorcerer__PHB" },
      { name: "Mage Hand", source: "SRD", ownerKey: "Sorcerer__PHB" },
    ],
  });
}

test("a Sorcerer 4 to 5 may forget its own Shield, and the replacement learns Magic Missile", () => {
  const sorcerer = sorcerer4WithShield();
  const plan = planFor(sorcerer, "Sorcerer");
  const options = levelUpReplacementOptions(sorcerer, plan, srdOpts);
  assert.ok(options, "a known caster offers a replacement");
  assert.ok(options.forget.some((s) => s.name === "Shield"), "Shield can be forgotten");
  assert.equal(options.learn.some((s) => s.name === "Shield"), false, "a known spell is not offered to learn");
  assert.equal(options.learn.some((s) => s.name === "Magic Missile"), true, "Magic Missile can be learned");

  const replaced = setPlanReplacedLearn(setPlanReplacedForget(plan, spellNamed("Shield")), spellNamed("Magic Missile"));
  const withNewPick = togglePlanSpell(replaced, spellNamed("Thunderwave"));
  assert.equal(levelUpStepComplete(withNewPick, "spells", srdOpts), true, "the new pick and the replacement complete the step");

  const after = applyLevelUpPlan(sorcerer, withNewPick, { activeBooks: ALL_BOOKS, compendium: srdOpts.compendium });
  const owned = (after.knownSpells ?? []).filter((k) => k.ownerKey === "Sorcerer__PHB").map((k) => k.name);
  assert.equal(owned.includes("Shield"), false, "Shield is gone for the Sorcerer");
  assert.equal(owned.includes("Magic Missile"), true, "Magic Missile is known");
  assert.equal(owned.includes("Thunderwave"), true, "the new pick is known");
  assert.equal(owned.includes("Mage Hand"), true, "other spells stay");
});

test("a half-made replacement keeps the Spells step incomplete", () => {
  const sorcerer = sorcerer4WithShield();
  const plan = planFor(sorcerer, "Sorcerer");
  const withNewPick = togglePlanSpell(plan, spellNamed("Thunderwave"));
  assert.equal(levelUpStepComplete(withNewPick, "spells", srdOpts), true, "the step completes with no replacement");

  const forgetOnly = setPlanReplacedForget(withNewPick, spellNamed("Shield"));
  assert.equal(levelUpStepComplete(forgetOnly, "spells", srdOpts), false, "a forget without a learn is half a replacement");

  const cleared = clearPlanReplacedSpell(forgetOnly);
  assert.equal(levelUpStepComplete(cleared, "spells", srdOpts), true, "clearing the replacement completes the step again");
});

test("a Wizard offers no replacement", () => {
  const wizard = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
    knownSpells: [{ name: "Shield", source: "SRD", ownerKey: "Wizard__PHB" }],
  });
  const plan = planFor(wizard, "Wizard");
  assert.equal(levelUpReplacementOptions(wizard, plan, srdOpts), null);
});

test("a Wizard 3 and Sorcerer 3 levelling the Sorcerer forgets only Sorcerer spells", () => {
  const character = makeChar({
    classes: [
      { className: "Wizard", source: "PHB", level: 3 },
      { className: "Sorcerer", source: "PHB", level: 3 },
    ],
    knownSpells: [
      { name: "Shield", source: "SRD", ownerKey: "Wizard__PHB" },
      { name: "Mage Armor", source: "SRD", ownerKey: "Sorcerer__PHB" },
    ],
  });
  const plan = planFor(character, "Sorcerer");
  const options = levelUpReplacementOptions(character, plan, srdOpts);
  assert.ok(options, "the Sorcerer offers a replacement");
  assert.deepEqual(options.forget.map((s) => s.name), ["Mage Armor"]);
});

test("a stale Catalog offers no replacement", () => {
  const sorcerer = sorcerer4WithShield();
  const plan = planFor(sorcerer, "Sorcerer");
  const stale = { ...srdOpts, compendium: { ...srdOpts.compendium, stale: true } } as CharacterCatalogs;
  assert.equal(levelUpReplacementOptions(sorcerer, plan, stale), null);
});

test("a learn picked as a new spell is dropped from the replacement", () => {
  const sorcerer = sorcerer4WithShield();
  const plan = setPlanReplacedLearn(setPlanReplacedForget(planFor(sorcerer, "Sorcerer"), spellNamed("Shield")), spellNamed("Magic Missile"));
  const picked = togglePlanSpell(plan, spellNamed("Magic Missile"));
  assert.equal(picked.picks.replacedSpell?.learn, undefined);
  assert.equal(picked.picks.replacedSpell?.forget?.name, "Shield");
});

test("the Review shows the replacement as Replace: old → new", () => {
  const sorcerer = sorcerer4WithShield();
  const plan = setPlanReplacedLearn(setPlanReplacedForget(planFor(sorcerer, "Sorcerer"), spellNamed("Shield")), spellNamed("Magic Missile"));
  const rows = levelUpSummary(plan, sorcerer, srdOpts);
  assert.deepEqual(rows.find((row) => row.label === "Replace"), { label: "Replace", value: "Shield → Magic Missile" });
});
