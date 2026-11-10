import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { ALL_BOOKS } from "../src/constants/books.ts";
import {
  applyLevelUpPlan,
  asiFeatSubChoices,
  chooseAverageHitPoints,
  classStepOptions,
  flowSteps,
  levelUpStepComplete,
  levelUpSummary,
  newSpellsForLevelUp,
  planLevelUp,
  rollPlanHitPoints,
  setPlanAsi,
  setPlanClassChoicePick,
  setPlanFeatPick,
  setPlanSubclass,
  subclassOptionsForPlan,
  togglePlanSpell,
  type LevelUpPlan,
} from "../src/rules/levelUpFlow.ts";
import { maxHp } from "../src/rules/hp.ts";

const FIGHTER_3 = makeChar({
  baseAbilityScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
  classes: [
    {
      className: "Fighter",
      source: "PHB",
      level: 3,
      subclassName: "Champion",
      subclass: "Champion",
      subclassSource: "SRD",
    },
  ],
});

function fighterPlan(hitPoints: { mode: "average" } | { mode: "roll" } = { mode: "average" }): LevelUpPlan {
  const result = planLevelUp(FIGHTER_3, { className: "Fighter", hitPoints });
  if (!result.ok) assert.fail(result.reason);
  return result.plan;
}

test("flowSteps lists only the Class step before a class is picked, the plan's steps after", () => {
  assert.deepEqual(flowSteps(null).map((s) => s.id), ["class"]);
  assert.deepEqual(flowSteps(fighterPlan()).map((s) => s.id), ["class", "hitPoints", "asiFeat", "review"]);
});

test("classStepOptions lists the held class first with its level change, the others at 1, the missed requirement as a score", () => {
  const options = classStepOptions(FIGHTER_3, { activeBooks: ALL_BOOKS });
  const held = options[0];
  assert.equal(held.className, "Fighter");
  assert.equal(held.held, true);
  assert.equal(held.fromLevel, 3);
  assert.equal(held.toLevel, 4);
  assert.equal(held.missingRequirement, undefined);
  const byName = new Map(options.map((o) => [o.className, o]));
  const rogue = byName.get("Rogue");
  assert.ok(rogue);
  assert.equal(rogue.held, false);
  assert.equal(rogue.toLevel, 1);
  assert.equal(rogue.missingRequirement, undefined, "Dex 14 meets the Rogue requirement");
  const wizard = byName.get("Wizard");
  assert.ok(wizard);
  assert.equal(wizard.missingRequirement, "Int 13", "Int 10 misses the Wizard requirement, shown as the score only");
  const bard = byName.get("Bard");
  assert.equal(bard?.missingRequirement, "Cha 13");
  // A held class appears exactly once.
  assert.equal(options.filter((o) => o.className === "Fighter").length, 1);
});

test("rollPlanHitPoints rolls the Hit Die once through the dice module and returns the Roll for the log", () => {
  const plan = fighterPlan({ mode: "average" });
  const snapshot = structuredClone(plan);
  const { plan: rolled, roll } = rollPlanHitPoints(plan, FIGHTER_3, () => 10);
  assert.equal(rolled.hitPoints.mode, "roll");
  assert.equal(rolled.hitPoints.roll, 10);
  assert.equal(rolled.hitPoints.amount, 12, "d10 face 10 + Con 2");
  assert.deepEqual(roll, { dice: [{ sides: 10, face: 10, dropped: false }], modifier: 2, total: 12 });
  assert.deepEqual(plan, snapshot, "the original plan is not mutated");

  const lowCon = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 6, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 3 }],
  });
  const lowPlan = planLevelUp(lowCon, { className: "Fighter", hitPoints: { mode: "roll" } });
  if (!lowPlan.ok) assert.fail(lowPlan.reason);
  const low = rollPlanHitPoints(lowPlan.plan, lowCon, () => 0);
  assert.equal(low.plan.hitPoints.roll, 1, "the face is clamped to at least 1");
  assert.equal(low.plan.hitPoints.amount, 1, "face 1 + Con -2 floors at 1");
  assert.equal(low.roll.total, -1, "the logged Roll keeps the raw total face + Con");
});

test("chooseAverageHitPoints switches a rolled plan back to the fixed average", () => {
  const rolled = rollPlanHitPoints(fighterPlan({ mode: "roll" }), FIGHTER_3, () => 10).plan;
  assert.equal(rolled.hitPoints.mode, "roll");
  const averaged = chooseAverageHitPoints(rolled, FIGHTER_3);
  assert.equal(averaged.hitPoints.mode, "average");
  assert.equal(averaged.hitPoints.amount, 8, "fixed average 6 + Con 2 for a d10 class");
  assert.equal(averaged.hitPoints.roll, undefined);
});

test("plan pick editors set their pick immutably", () => {
  const plan = fighterPlan();
  const snapshot = structuredClone(plan);

  const withAsi = setPlanAsi(plan, { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { con: 2 } });
  assert.deepEqual(withAsi.picks.asi?.asi, { con: 2 });
  assert.deepEqual(plan.picks, {}, "the original plan keeps no pick");

  const wizard = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  });
  const wizardPlanResult = planLevelUp(wizard, { className: "Wizard" });
  if (!wizardPlanResult.ok) assert.fail(wizardPlanResult.reason);
  const withSub = setPlanSubclass(wizardPlanResult.plan, "School of Evocation", "SRD");
  assert.deepEqual(withSub.picks.subclass, { name: "School of Evocation", source: "SRD" });

  const withSpell = togglePlanSpell(withSub, { name: "Magic Missile", source: "PHB" });
  assert.deepEqual(withSpell.picks.learnedSpells, [{ name: "Magic Missile", source: "PHB" }]);
  const withoutSpell = togglePlanSpell(withSpell, { name: "Magic Missile", source: "PHB" });
  assert.deepEqual(withoutSpell.picks.learnedSpells, []);
  assert.deepEqual(plan, snapshot);
});

test("a multiclass plan carries the level's class choices, and applying a picked choice records it on the Character", () => {
  const result = planLevelUp(FIGHTER_3, { className: "Rogue", source: "PHB" });
  if (!result.ok) assert.fail(result.reason);
  assert.ok(result.plan.steps.some((s) => s.id === "classChoices"));
  const choices = result.plan.classChoices ?? [];
  assert.ok(choices.length > 0, "the Rogue level 1 brings its multiclass skill pick");
  const skillChoice = choices.find((c) => c.pick === "proficiency");
  assert.ok(skillChoice, "the multiclass skill pick is a Proficiency Choice");
  const picked = setPlanClassChoicePick(result.plan, skillChoice.id, "Stealth", skillChoice.choose);
  assert.deepEqual(picked.picks.classChoicePicks?.[skillChoice.id], ["Stealth"]);

  const applied = applyLevelUpPlan(FIGHTER_3, picked, { fullHealOnLevelUp: false });
  assert.ok((applied.classes ?? []).some((c) => c.className === "Rogue" && c.level === 1));
  assert.ok(
    (applied.proficiencyPicks?.[skillChoice.id] ?? []).includes("Stealth"),
    "the planned choice pick is recorded on the applied Character"
  );
});

test("a Fighter 1 multiclass plan applies a picked Fighting Style rule choice", () => {
  const wizard3 = makeChar({
    baseAbilityScores: { str: 14, dex: 10, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
  });
  const result = planLevelUp(wizard3, { className: "Fighter", source: "PHB" });
  if (!result.ok) assert.fail(result.reason);
  const style = (result.plan.classChoices ?? []).find((c) => c.id.includes("Fighting Style"));
  assert.ok(style, "Fighter 1 brings the Fighting Style choice");
  const picked = setPlanClassChoicePick(result.plan, style.id, "Defense", style.choose);
  const applied = applyLevelUpPlan(wizard3, picked, { fullHealOnLevelUp: false });
  const ruleChoice = (applied.ruleChoices ?? []).find((rc) => rc.id === style.id);
  assert.deepEqual(ruleChoice?.picked, ["Defense"]);
});

test("levelUpStepComplete reads the plan: class needs a plan, asiFeat needs a pick, classChoices needs every choice picked", () => {
  assert.equal(levelUpStepComplete(null, "class"), false);
  const plan = fighterPlan();
  assert.equal(levelUpStepComplete(plan, "class"), true);
  assert.equal(levelUpStepComplete(plan, "hitPoints"), true);
  assert.equal(levelUpStepComplete(plan, "spells"), true);
  assert.equal(levelUpStepComplete(plan, "asiFeat"), false);
  assert.equal(levelUpStepComplete(setPlanAsi(plan, { level: 4, type: "asi", asi: { con: 2 } }), "asiFeat"), true);
  assert.equal(levelUpStepComplete(plan, "review"), false, "the unpicked ASI/Feat step blocks Review");
  assert.equal(levelUpStepComplete(setPlanAsi(plan, { level: 4, type: "asi", asi: { con: 2 } }), "review"), true);

  const rogue = planLevelUp(FIGHTER_3, { className: "Rogue", source: "PHB" });
  if (!rogue.ok) assert.fail(rogue.reason);
  assert.equal(levelUpStepComplete(rogue.plan, "classChoices"), false);
  const choice = (rogue.plan.classChoices ?? [])[0];
  assert.ok(choice);
  const picked = setPlanClassChoicePick(rogue.plan, choice.id, choice.options[0].name, choice.choose);
  // Pick every choice fully.
  let allPicked = picked;
  for (const c of rogue.plan.classChoices ?? []) {
    const have = allPicked.picks.classChoicePicks?.[c.id] ?? [];
    for (let i = have.length; i < c.choose; i++) {
      allPicked = setPlanClassChoicePick(allPicked, c.id, c.options[i % c.options.length].name, c.choose);
    }
  }
  assert.equal(levelUpStepComplete(allPicked, "classChoices"), true);
});

test("a feat offering +1 to one of several abilities keeps the ASI/Feat step incomplete until one is chosen", () => {
  const plan = fighterPlan();
  const opts = { character: FIGHTER_3, activeBooks: ALL_BOOKS };
  const athlete = setPlanAsi(plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Athlete", featSource: "PHB" });
  assert.equal(levelUpStepComplete(athlete, "asiFeat", opts), false, "no ability chosen yet");
  const withAbility = setPlanAsi(plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Athlete", featSource: "PHB", featAbility: "str", asi: { str: 1 } });
  assert.equal(levelUpStepComplete(withAbility, "asiFeat", opts), true, "Athlete grants no rule choice of its own");
  assert.equal(levelUpStepComplete(withAbility, "review", opts), true);
});

test("a feat with its own rule choice (a fighting style) is incomplete until the pick is made, and applying records it", () => {
  const plan = fighterPlan();
  const opts = { character: FIGHTER_3, activeBooks: ALL_BOOKS };
  const initiate = setPlanAsi(plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Fighting Initiate", featSource: "TCE" });
  assert.equal(levelUpStepComplete(initiate, "asiFeat", opts), false, "the style is not picked yet");
  const choices = asiFeatSubChoices(initiate, FIGHTER_3, { activeBooks: ALL_BOOKS });
  assert.equal(choices.length, 1, "Fighting Initiate grants exactly its style choice");
  const choice = choices[0];
  assert.ok(choice.id.includes("Fighting Initiate"));
  assert.ok(choice.options.length > 0, "the style options come from the catalog");
  const picked = setPlanFeatPick(initiate, choice.id, choice.options[0].name, choice.choose);
  assert.deepEqual(picked.picks.featPicks?.[choice.id], [choice.options[0].name]);
  assert.equal(levelUpStepComplete(picked, "asiFeat", opts), true);
  assert.equal(levelUpStepComplete(picked, "review", opts), true);

  const applied = applyLevelUpPlan(FIGHTER_3, picked, { fullHealOnLevelUp: false });
  const ruleChoice = (applied.ruleChoices ?? []).find((rc) => rc.id === choice.id);
  assert.deepEqual(ruleChoice?.picked, [choice.options[0].name], "the planned style pick is recorded on the applied Character");
  assert.ok(applied.asiSelections.some((s) => s.featName === "Fighting Initiate"), "the feat itself is applied");
});

test("levelUpSummary lists the feat's own picks as rows", () => {
  const plan = fighterPlan();
  const initiate = setPlanAsi(plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Fighting Initiate", featSource: "TCE" });
  const choice = asiFeatSubChoices(initiate, FIGHTER_3, { activeBooks: ALL_BOOKS })[0];
  const picked = setPlanFeatPick(initiate, choice.id, choice.options[0].name, choice.choose);
  const rows = new Map(levelUpSummary(picked, FIGHTER_3, { fullHealOnLevelUp: false, activeBooks: ALL_BOOKS }).map((r) => [r.label, r.value]));
  assert.equal(rows.get("ASI/Feat"), "Fighting Initiate");
  assert.equal(rows.get(choice.traitName), choice.options[0].name);
});

test("levelUpSummary lists the level and hit points before → after, plus every pick", () => {
  const plan = fighterPlan();
  const rows = levelUpSummary(plan, FIGHTER_3, { fullHealOnLevelUp: false });
  const byLabel = new Map(rows.map((r) => [r.label, r.value]));
  assert.equal(byLabel.get("Class"), "Fighter 3 → 4");
  assert.equal(byLabel.get("Level"), "3 → 4");
  assert.equal(byLabel.get("Hit points"), `${maxHp(FIGHTER_3)} → ${maxHp(FIGHTER_3) + 8}`);
  assert.equal(byLabel.get("Hit points method"), "Average +8");

  const rolled = rollPlanHitPoints(fighterPlan({ mode: "roll" }), FIGHTER_3, () => 10).plan;
  const rolledRows = new Map(levelUpSummary(rolled, FIGHTER_3, { fullHealOnLevelUp: false }).map((r) => [r.label, r.value]));
  assert.equal(rolledRows.get("Hit points"), `${maxHp(FIGHTER_3)} → ${maxHp(FIGHTER_3) + 12}`);
  assert.match(rolledRows.get("Hit points method") ?? "", /Roll/);

  const withAsi = setPlanAsi(plan, { level: 4, type: "feat", featName: "Grappler", featSource: "PHB" });
  const asiRows = new Map(levelUpSummary(withAsi, FIGHTER_3, { fullHealOnLevelUp: false }).map((r) => [r.label, r.value]));
  assert.equal(asiRows.get("ASI/Feat"), "Grappler");
});

test("subclassOptionsForPlan lists the planned class's subclasses in the active books", () => {
  const wizard = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  });
  const result = planLevelUp(wizard, { className: "Wizard" });
  if (!result.ok) assert.fail(result.reason);
  const options = subclassOptionsForPlan(result.plan, { activeBooks: ALL_BOOKS });
  assert.ok(options.length >= 1);
  assert.ok(options.every((o) => o.name.length > 0 && o.source.length > 0));
});

test("newSpellsForLevelUp offers the spells newly available at the new level, minus the known ones", () => {
  const wizard = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    knownSpells: [{ name: "Magic Missile", source: "PHB", ownerKey: "Wizard__PHB" }],
  });
  const to2 = planLevelUp(wizard, { className: "Wizard" });
  if (!to2.ok) assert.fail(to2.reason);
  const level1 = newSpellsForLevelUp(wizard, to2.plan, { activeBooks: ALL_BOOKS });
  assert.ok(level1.length > 0);
  assert.ok(level1.every((s) => s.level <= 1), "a level 2 Wizard has only first-level slots");
  assert.ok(!level1.some((s) => s.name === "Magic Missile"), "a known spell is not offered again");
  assert.ok(level1.some((s) => s.name === "Shield"), "an unlearned first-level Wizard spell is offered");

  const wizard2 = { ...wizard, classes: [{ className: "Wizard", source: "PHB", level: 2 }] };
  const to3 = planLevelUp(wizard2, { className: "Wizard" });
  if (!to3.ok) assert.fail(to3.reason);
  const level2 = newSpellsForLevelUp(wizard2, to3.plan, { activeBooks: ALL_BOOKS });
  assert.ok(level2.some((s) => s.level === 2), "a level 3 Wizard is offered second-level spells");
  assert.ok(level2.every((s) => s.level <= 2));
});
