import { test } from "node:test";
import assert from "node:assert/strict";
import { inMemoryCompendium, loadTestCatalog, makeChar } from "./testUtils.ts";
import { ALL_BOOKS } from "../src/constants/books.ts";
import type { AsiSelection } from "../src/types/character.ts";
import {
  applyLevelUpPlan,
  levelUpClassChoicesView,
  levelUpStepComplete,
  levelUpSummary,
  planLevelUp,
  setPlanAsi,
  setPlanExpertisePick,
} from "../src/rules/levelUpFlow.ts";

const compendium = inMemoryCompendium({ classes: loadTestCatalog("classes"), feats: loadTestCatalog("feats") });
const opts = { compendium, activeBooks: ALL_BOOKS };

const ROGUE_3 = makeChar({
  classes: [{ className: "Rogue", level: 3, source: "PHB", subclassName: "Thief", subclassSource: "PHB" }],
  chosenSkills: ["Stealth", "Perception", "Deception", "Acrobatics"],
  addedTools: ["Thieves' Tools"],
  chosenExpertise: ["Stealth", "Perception"],
});

const SKILL_EXPERT: AsiSelection = {
  level: 4,
  className: "Rogue",
  classLevel: 4,
  type: "feat",
  featName: "Skill Expert",
  featSource: "TCE",
  featAbility: "dex",
  asi: { dex: 1 },
};

const PLAIN_ASI: AsiSelection = { level: 4, className: "Rogue", classLevel: 4, type: "asi", asi: { dex: 2 } };

function roguePlan() {
  const result = planLevelUp(ROGUE_3, { className: "Rogue", hitPoints: { mode: "average" }, ...opts });
  if (!result.ok) assert.fail(result.reason);
  return result.plan;
}

test("setPlanAsi on Skill Expert adds the Class Choices step and the feat's Expertise milestone, minus the claimed skills", () => {
  const plan = roguePlan();
  assert.deepEqual(plan.steps.map((s) => s.id), ["class", "hitPoints", "asiFeat", "review"]);

  const withFeat = setPlanAsi(ROGUE_3, plan, SKILL_EXPERT, opts);
  assert.deepEqual(withFeat.steps.map((s) => s.id), ["class", "hitPoints", "asiFeat", "classChoices", "review"]);
  const milestone = (withFeat.expertiseMilestones ?? []).find((m) => m.id === "feat_skill_expert");
  assert.ok(milestone, "the feat's milestone is offered");
  assert.deepEqual([...milestone.options].sort(), ["Acrobatics", "Deception"], "Stealth and Perception are claimed by the held Expertise");
});

test("planLevelUp reads the feat's Expertise when the plan already holds the ASI/Feat pick", () => {
  const result = planLevelUp(ROGUE_3, { className: "Rogue", hitPoints: { mode: "average" }, picks: { asi: SKILL_EXPERT }, ...opts });
  if (!result.ok) assert.fail(result.reason);
  assert.equal(result.plan.steps.some((s) => s.id === "classChoices"), true);
  assert.deepEqual(result.plan.expertiseMilestones?.map((m) => m.id), ["feat_skill_expert"]);
});

test("the Class Choices step is complete only once one Expertise is picked", () => {
  const withFeat = setPlanAsi(ROGUE_3, roguePlan(), SKILL_EXPERT, opts);
  assert.equal(levelUpStepComplete(withFeat, "classChoices", opts), false);
  const picked = setPlanExpertisePick(withFeat, "Deception");
  assert.equal(levelUpStepComplete(picked, "classChoices", opts), true);
});

test("the applied plan saves the Expertise pick after the held ones, with Skill Expert in the ASI selections", () => {
  const picked = setPlanExpertisePick(setPlanAsi(ROGUE_3, roguePlan(), SKILL_EXPERT, opts), "Deception");
  const applied = applyLevelUpPlan(ROGUE_3, picked, { fullHealOnLevelUp: false, ...opts });
  assert.deepEqual(applied.chosenExpertise, ["Stealth", "Perception", "Deception"]);
  assert.equal(applied.asiSelections?.some((s) => s.featName === "Skill Expert"), true);
});

test("switching the pick back to a plain ASI removes the Class Choices step, the milestone and the Expertise pick", () => {
  const picked = setPlanExpertisePick(setPlanAsi(ROGUE_3, roguePlan(), SKILL_EXPERT, opts), "Deception");
  const plain = setPlanAsi(ROGUE_3, picked, PLAIN_ASI, opts);
  assert.equal(plain.steps.some((s) => s.id === "classChoices"), false);
  assert.deepEqual(plain.expertiseMilestones, []);
  assert.deepEqual(plain.picks.expertisePicks ?? [], []);
});

test("the Review rows show the feat and the Expertise pick", () => {
  const picked = setPlanExpertisePick(setPlanAsi(ROGUE_3, roguePlan(), SKILL_EXPERT, opts), "Deception");
  const rows = new Map(levelUpSummary(picked, ROGUE_3, { fullHealOnLevelUp: false, ...opts }).map((r) => [r.label, r.value]));
  assert.equal(rows.get("ASI/Feat"), "Skill Expert");
  assert.equal(rows.get("Expertise"), "Deception");
});

test("the Class Choices view of the plan lists the feat's milestone and applies", () => {
  const withFeat = setPlanAsi(ROGUE_3, roguePlan(), SKILL_EXPERT, opts);
  const view = levelUpClassChoicesView(ROGUE_3, withFeat, opts);
  assert.equal(view.applies, true);
  assert.deepEqual(view.expertise.picks.map(({ milestone }) => milestone.id), ["feat_skill_expert"]);
});
