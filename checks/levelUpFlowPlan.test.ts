import { test } from "node:test";
import assert from "node:assert/strict";
import { integratedTestCompendium, makeChar, resetTestCompendium } from "./testUtils.ts";
import { ALL_BOOKS } from "../src/constants/books.ts";
import {
  applyLevelUpPlan,
  asiFeatStepView,
  asiFeatSubChoices,
  chooseAverageHitPoints,
  classStepOptions,
  clearPlanClassChoicePick,
  flowSteps,
  levelUpClassChoicesView,
  levelUpStepComplete,
  levelUpSummary,
  newSpellsForLevelUp,
  planLevelUp,
  rollPlanHitPoints,
  setPlanAsi,
  setPlanClassChoicePick,
  setPlanExpertisePick,
  setPlanFeatPick,
  setPlanOptionalFeature,
  setPlanSubclass,
  subclassOptionsForPlan,
  togglePlanSpell,
  type LevelUpPlan,
} from "../src/rules/levelUpFlow.ts";
import { maxHp } from "../src/rules/hp.ts";
import type { FeatData } from "../src/types/dnd5e.ts";
import { __setRandomSourceForTests } from "../src/rules/dice.ts";

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
  // Fighter 4 gains the optional Martial Versatility, so its level brings the Class Choices step too.
  assert.deepEqual(flowSteps(fighterPlan()).map((s) => s.id), ["class", "hitPoints", "asiFeat", "classChoices", "review"]);
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

test("planLevelUp and rollPlanHitPoints draw from currentRandom() when no source is passed", () => {
  __setRandomSourceForTests(() => 9);
  try {
    const planned = planLevelUp(FIGHTER_3, { className: "Fighter", hitPoints: { mode: "roll" } });
    if (!planned.ok) assert.fail(planned.reason);
    assert.equal(planned.plan.hitPoints.roll, 9, "planLevelUp rolled the injected face, not the app's source");
    assert.equal(planned.plan.hitPoints.amount, 11, "face 9 + Con 2");
    const rolled = rollPlanHitPoints(fighterPlan({ mode: "average" }), FIGHTER_3);
    assert.equal(rolled.roll.dice[0]?.face, 9, "rollPlanHitPoints rolled the injected face, not the app's source");
    assert.equal(rolled.plan.hitPoints.roll, 9);
  } finally {
    __setRandomSourceForTests(null);
  }
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

  const withAsi = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { con: 2 } });
  assert.deepEqual(withAsi.picks.asi?.asi, { con: 2 });
  assert.deepEqual(plan.picks, {}, "the original plan keeps no pick");

  const wizard = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  });
  const wizardPlanResult = planLevelUp(wizard, { className: "Wizard" });
  if (!wizardPlanResult.ok) assert.fail(wizardPlanResult.reason);
  const withSub = setPlanSubclass(wizard, wizardPlanResult.plan, "School of Evocation", "SRD");
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
  assert.equal(levelUpStepComplete(setPlanAsi(FIGHTER_3, plan, { level: 4, type: "asi", asi: { con: 2 } }), "asiFeat"), true);
  assert.equal(levelUpStepComplete(plan, "review"), false, "the unpicked ASI/Feat step blocks Review");
  assert.equal(levelUpStepComplete(setPlanAsi(FIGHTER_3, plan, { level: 4, type: "asi", asi: { con: 2 } }), "review"), true);

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

test("the Class Choices view of a Battle Master Fighter 6 to 7 lists every plan choice, its maneuvers in the maneuver card", () => {
  const compendium = integratedTestCompendium();
  resetTestCompendium();
  const character = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 6, subclassName: "Battle Master", subclass: "Battle Master", subclassSource: "PHB" }],
  });
  const result = planLevelUp(character, { className: "Fighter", hitPoints: { mode: "average" }, compendium, activeBooks: ALL_BOOKS });
  if (!result.ok) assert.fail(result.reason);
  const planned = result.plan.classChoices ?? [];
  assert.ok(planned.some((choice) => choice.group === "maneuver"), "the plan carries the maneuver choice");

  const view = levelUpClassChoicesView(character, result.plan, { compendium, activeBooks: ALL_BOOKS });
  const shown = new Set([...view.skillPicks, ...Object.values(view.cards).flat()].map((choice) => choice.id));
  for (const choice of planned) assert.ok(shown.has(choice.id), `${choice.traitName} is shown`);
  assert.deepEqual(
    view.cards.maneuver.map((choice) => choice.id),
    planned.filter((choice) => choice.group === "maneuver").map((choice) => choice.id),
  );
});

test("picking Battle Master in a Fighter 2 to 3 plan brings its maneuver and tool choices; switching to Champion removes them", () => {
  const compendium = integratedTestCompendium();
  resetTestCompendium();
  const character = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 2 }],
  });
  const result = planLevelUp(character, { className: "Fighter", hitPoints: { mode: "average" }, compendium, activeBooks: ALL_BOOKS });
  if (!result.ok) assert.fail(result.reason);
  const planned = result.plan;
  assert.equal(planned.steps.some((s) => s.id === "classChoices"), false, "no subclass held: no class choices yet");
  assert.equal(planned.steps.some((s) => s.id === "subclass"), true);

  const opts = { compendium, activeBooks: ALL_BOOKS };
  const withBattleMaster = setPlanSubclass(character, planned, "Battle Master", "PHB", opts);
  assert.deepEqual(withBattleMaster.picks.subclass, { name: "Battle Master", source: "PHB" });
  assert.deepEqual(
    withBattleMaster.steps.map((s) => s.id),
    ["class", "hitPoints", "subclass", "classChoices", "review"],
    "the Class Choices step follows the Subclass step",
  );
  const maneuvers = (withBattleMaster.classChoices ?? []).filter((c) => c.group === "maneuver");
  assert.equal(maneuvers.length, 1);
  assert.equal(maneuvers[0].choose, 3, "a Battle Master at 3 learns three maneuvers");
  const tool = (withBattleMaster.classChoices ?? []).find((c) => c.pick === "proficiency" && c.traitName === "Student of War");
  assert.ok(tool, "Student of War's tool pick is listed");
  assert.equal(levelUpStepComplete(withBattleMaster, "classChoices", { compendium, activeBooks: ALL_BOOKS }), false);

  const picked = setPlanClassChoicePick(withBattleMaster, maneuvers[0].id, maneuvers[0].options[0].name, 3);
  const pickedManeuvers = setPlanClassChoicePick(picked, maneuvers[0].id, maneuvers[0].options[1].name, 3);
  const withTools = setPlanClassChoicePick(pickedManeuvers, tool.id, tool.options[0].name, tool.choose);
  const applied = applyLevelUpPlan(character, withTools, { fullHealOnLevelUp: false, compendium, activeBooks: ALL_BOOKS });
  assert.equal((applied.ruleChoices ?? []).find((rc) => rc.id === maneuvers[0].id)?.picked.length, 2);

  const champion = setPlanSubclass(character, withTools, "Champion", "PHB", opts);
  assert.equal(champion.steps.some((s) => s.id === "classChoices"), false, "Champion brings no class choices");
  assert.equal(champion.classChoices?.length ?? 0, 0);
  assert.deepEqual(champion.picks.classChoicePicks, {}, "the picks of choices Champion does not offer are dropped");
  assert.equal(champion.hitPoints, withTools.hitPoints, "hit points stay as they were");
  assert.equal(champion.picks.asi, withTools.picks.asi);
  assert.equal(champion.picks.learnedSpells, withTools.picks.learnedSpells);
});

test("picking Eldritch Knight in a Fighter 2 to 3 plan brings the Spells step; switching to Champion removes it and its learned spells", () => {
  const compendium = integratedTestCompendium();
  resetTestCompendium();
  const character = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 2 }],
  });
  const opts = { compendium, activeBooks: ALL_BOOKS };
  const result = planLevelUp(character, { className: "Fighter", hitPoints: { mode: "average" }, ...opts });
  if (!result.ok) assert.fail(result.reason);
  assert.equal(result.plan.steps.some((s) => s.id === "spells"), false, "no subclass held: no Spells step yet");

  const eldritch = setPlanSubclass(character, result.plan, "Eldritch Knight", "PHB", opts);
  assert.deepEqual(
    eldritch.steps.map((s) => s.id),
    ["class", "hitPoints", "subclass", "spells", "review"],
    "the Spells step follows the Subclass step",
  );
  const offered = newSpellsForLevelUp(character, eldritch, opts).map((spell) => spell.name);
  assert.ok(offered.includes("Magic Missile"), "the Eldritch Knight's spells are offered");

  const learned = togglePlanSpell(eldritch, { name: "Magic Missile", source: "PHB" });
  const kept = setPlanSubclass(character, learned, "Eldritch Knight", "PHB", opts);
  assert.deepEqual(kept.picks.learnedSpells, [{ name: "Magic Missile", source: "PHB" }], "a still offered spell stays picked");

  const champion = setPlanSubclass(character, learned, "Champion", "PHB", opts);
  assert.equal(champion.steps.some((s) => s.id === "spells"), false, "Champion brings no Spells step");
  assert.equal(champion.picks.learnedSpells, undefined, "the learned spells go with the step");
});

test("clearPlanClassChoicePick removes one choice's picks and leaves the others", () => {
  const plan = fighterPlan();
  const picked = { ...plan, picks: { ...plan.picks, classChoicePicks: { a: ["X"], b: ["Y"] } } };
  const cleared = clearPlanClassChoicePick(picked, "a");
  assert.deepEqual(cleared.picks.classChoicePicks, { b: ["Y"] });
  assert.deepEqual(picked.picks.classChoicePicks, { a: ["X"], b: ["Y"] }, "the given plan is never mutated");
});

test("a Rogue 5 to 6 plan offers only the new Expertise milestone, minus the skills the held one claims; both picks are required and applied", () => {
  const compendium = integratedTestCompendium();
  resetTestCompendium();
  const opts = { compendium, activeBooks: ALL_BOOKS };
  const character = makeChar({
    baseAbilityScores: { str: 10, dex: 16, con: 12, int: 14, wis: 10, cha: 10 },
    chosenSkills: ["Stealth", "Acrobatics", "Perception", "Deception"],
    chosenExpertise: ["Stealth", "Acrobatics"],
    classes: [{ className: "Rogue", source: "PHB", level: 5, subclassName: "Thief", subclass: "Thief", subclassSource: "PHB" }],
  });
  const result = planLevelUp(character, { className: "Rogue", hitPoints: { mode: "average" }, ...opts });
  if (!result.ok) assert.fail(result.reason);
  const plan = result.plan;
  assert.equal(plan.steps.some((s) => s.id === "classChoices"), true, "the Expertise milestone brings the Class Choices step");

  const view = levelUpClassChoicesView(character, plan, opts);
  assert.deepEqual(view.expertise.picks.map(({ milestone }) => milestone.id), ["rogue_6"], "rogue_1 is held, not new");
  assert.deepEqual(
    view.expertise.picks[0].from,
    ["Perception", "Deception", "Thieves' Tools"],
    "the skills the held milestone claims are not offered; a Rogue's Thieves' Tools are",
  );
  assert.equal(levelUpStepComplete(plan, "classChoices", opts), false);

  const onePick = setPlanExpertisePick(plan, "Perception");
  assert.equal(levelUpStepComplete(onePick, "classChoices", opts), false, "one of the two picks is not enough");
  const picked = setPlanExpertisePick(onePick, "Deception");
  assert.equal(levelUpStepComplete(picked, "classChoices", opts), true);
  assert.equal(levelUpStepComplete(onePick, "review", opts), false, "the unpicked Expertise step blocks Review");
  assert.equal(levelUpStepComplete(picked, "review", opts), true);

  const applied = applyLevelUpPlan(character, picked, { fullHealOnLevelUp: false, ...opts });
  assert.deepEqual(applied.chosenExpertise, ["Stealth", "Acrobatics", "Perception", "Deception"]);

  const rows = new Map(levelUpSummary(picked, character, { fullHealOnLevelUp: false, ...opts }).map((r) => [r.label, r.value]));
  assert.equal(rows.get("Expertise"), "Perception, Deception");
});

test("a Barbarian 2 to 3 plan whose only new choice is an optional feature shows the step, complete untouched; enabling it applies it", () => {
  const compendium = integratedTestCompendium();
  resetTestCompendium();
  const opts = { compendium, activeBooks: ALL_BOOKS };
  const character = makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 2, subclassName: "Path of the Berserker", subclass: "Path of the Berserker", subclassSource: "PHB" }],
  });
  const result = planLevelUp(character, { className: "Barbarian", hitPoints: { mode: "average" }, ...opts });
  if (!result.ok) assert.fail(result.reason);
  const plan = result.plan;
  assert.equal(plan.steps.some((s) => s.id === "classChoices"), true, "the optional feature brings the Class Choices step");
  assert.equal((plan.classChoices ?? []).length, 0, "the level brings no other choice");
  assert.equal(levelUpStepComplete(plan, "classChoices", opts), true, "optional features never block");

  const view = levelUpClassChoicesView(character, plan, opts);
  assert.deepEqual(view.optionalFeatures.map((o) => o.name), ["Primal Knowledge"]);

  const enabled = setPlanOptionalFeature(plan, "Primal Knowledge", true);
  const applied = applyLevelUpPlan(character, enabled, { fullHealOnLevelUp: false, ...opts });
  assert.equal(applied.optionalFeatureReplacements?.["Primal Knowledge"], true);

  const rows = new Map(levelUpSummary(enabled, character, { fullHealOnLevelUp: false, ...opts }).map((r) => [r.label, r.value]));
  assert.equal(rows.get("Optional & Replacement Class Features"), "Primal Knowledge");
});

test("a feat offering +1 to one of several abilities keeps the ASI/Feat step incomplete until one is chosen", () => {
  const plan = fighterPlan();
  const opts = { character: FIGHTER_3, activeBooks: ALL_BOOKS };
  const athlete = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Athlete", featSource: "PHB" });
  assert.equal(levelUpStepComplete(athlete, "asiFeat", opts), false, "no ability chosen yet");
  const withAbility = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Athlete", featSource: "PHB", featAbility: "str", asi: { str: 1 } });
  assert.equal(levelUpStepComplete(withAbility, "asiFeat", opts), true, "Athlete grants no rule choice of its own");
  assert.equal(levelUpStepComplete(withAbility, "review", opts), true);
});

test("a half-finished ASI pick (one +1 of two) keeps the ASI/Feat step incomplete", () => {
  const plan = fighterPlan();
  const opts = { character: FIGHTER_3, activeBooks: ALL_BOOKS };
  const half = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { str: 1 } });
  assert.equal(levelUpStepComplete(half, "asiFeat", opts), false, "one +1 of the two is not a complete ASI");
  assert.equal(levelUpStepComplete(half, "review", opts), false, "the half-finished ASI blocks Review too");
  const two = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { str: 1, dex: 1 } });
  assert.equal(levelUpStepComplete(two, "asiFeat", opts), true);
  const plus2 = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { con: 2 } });
  assert.equal(levelUpStepComplete(plus2, "asiFeat", opts), true);
});

test("asiFeatStepView derives the whole ASI/Feat selection from the plan's pick, so a remounted step shows it again", () => {
  const plan = fighterPlan();
  const opts = { activeBooks: ALL_BOOKS };
  const feats: FeatData[] = [
    {
      name: "Athlete",
      source: "PHB",
      prerequisite: null,
      abilityScoreIncrease: null,
      abilityScoreChoices: [{ from: ["str", "dex"], count: 1, amount: 1 }],
      description: "",
    },
  ];
  // A feat with an ability choice is picked but its ability is not chosen yet — the remount case.
  const athlete = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Athlete", featSource: "PHB" });
  const view = asiFeatStepView(athlete, FIGHTER_3, feats, opts);
  assert.equal(view.tab, "feat");
  assert.equal(view.featName, "Athlete");
  assert.equal(view.selectedFeat?.name, "Athlete");
  assert.equal(view.featAbility, null, "no ability chosen yet, so the ability chips render unpicked");
  assert.equal(view.featAbilityOptions.type, "choice");
  // Choosing the ability is a plan write; the view reads it back.
  const withAbility = setPlanAsi(FIGHTER_3, athlete, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Athlete", featSource: "PHB", featAbility: "str", asi: { str: 1 } });
  const abilityView = asiFeatStepView(withAbility, FIGHTER_3, feats, opts);
  assert.equal(abilityView.tab, "feat");
  assert.equal(abilityView.featAbility, "str");
  // A half-finished ASI pick in the plan replaces the feat: the view shows it on the ASI tab, nothing stale.
  const halfAsi = setPlanAsi(FIGHTER_3, athlete, { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { str: 1 } });
  const halfView = asiFeatStepView(halfAsi, FIGHTER_3, feats, opts);
  assert.equal(halfView.tab, "asi");
  assert.equal(halfView.featName, null);
  assert.equal(halfView.selectedFeat, null);
  assert.equal(halfView.asiMode, "plus1plus1");
  assert.deepEqual(halfView.plus1Picks, ["str"]);
  assert.equal(halfView.plus2Pick, null);
  // A +2 pick shows in the plus2 mode.
  const plus2 = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "asi", asi: { con: 2 } });
  const plus2View = asiFeatStepView(plus2, FIGHTER_3, feats, opts);
  assert.equal(plus2View.tab, "asi");
  assert.equal(plus2View.asiMode, "plus2");
  assert.equal(plus2View.plus2Pick, "con");
  assert.deepEqual(plus2View.plus1Picks, []);
  // No pick yet: the ASI tab, plus2 mode, nothing selected.
  const emptyView = asiFeatStepView(plan, FIGHTER_3, feats, opts);
  assert.equal(emptyView.tab, "asi");
  assert.equal(emptyView.asiMode, "plus2");
  assert.equal(emptyView.selectedFeat, null);
  assert.equal(emptyView.featAbility, null);
  // The feat's own rule choices are derived with the pick.
  const initiate = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Fighting Initiate", featSource: "TCE" });
  const subView = asiFeatStepView(initiate, FIGHTER_3, feats, opts);
  assert.equal(subView.tab, "feat");
  assert.ok(subView.subChoices.length >= 1, "the style choice is derived with the pick");
});

test("a feat with its own rule choice (a fighting style) is incomplete until the pick is made, and applying records it", () => {
  const plan = fighterPlan();
  const opts = { character: FIGHTER_3, activeBooks: ALL_BOOKS };
  const initiate = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Fighting Initiate", featSource: "TCE" });
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

test("setPlanFeatPick refuses a new option once the cap is reached; the picked ones stay deselectable", () => {
  const plan = fighterPlan();
  const initiate = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Fighting Initiate", featSource: "TCE" });
  const choice = asiFeatSubChoices(initiate, FIGHTER_3, { activeBooks: ALL_BOOKS })[0];
  assert.ok(choice, "Fighting Initiate grants its fighting style choice");
  assert.ok(choice.options.length >= 2);
  const picked = setPlanFeatPick(initiate, choice.id, choice.options[0].name, choice.choose);
  assert.deepEqual(picked.picks.featPicks?.[choice.id], [choice.options[0].name]);
  // At the cap (choose 1) a new option is refused outright: the plan comes back unchanged.
  const refused = setPlanFeatPick(picked, choice.id, choice.options[1].name, choice.choose);
  assert.equal(refused, picked, "at the cap a new option is refused, the plan is returned unchanged");
  assert.deepEqual(refused.picks.featPicks?.[choice.id], [choice.options[0].name]);
  // A picked option stays deselectable at the cap.
  const deselected = setPlanFeatPick(picked, choice.id, choice.options[0].name, choice.choose);
  assert.deepEqual(deselected.picks.featPicks?.[choice.id], []);
  // The same at a cap of two: the third option is refused, not silently dropped by a slice.
  const two = setPlanFeatPick(setPlanFeatPick(plan, "choice-1", "First Option", 2), "choice-1", "Second Option", 2);
  const refusedThird = setPlanFeatPick(two, "choice-1", "Third Option", 2);
  assert.equal(refusedThird, two);
  assert.deepEqual(refusedThird.picks.featPicks?.["choice-1"], ["First Option", "Second Option"]);
  assert.deepEqual(plan.picks, {}, "the original plan is not mutated");
});

test("levelUpSummary lists the feat's own picks as rows", () => {
  const plan = fighterPlan();
  const initiate = setPlanAsi(FIGHTER_3, plan, { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Fighting Initiate", featSource: "TCE" });
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

  const withAsi = setPlanAsi(FIGHTER_3, plan, { level: 4, type: "feat", featName: "Grappler", featSource: "PHB" });
  const asiRows = new Map(levelUpSummary(withAsi, FIGHTER_3, { fullHealOnLevelUp: false }).map((r) => [r.label, r.value]));
  assert.equal(asiRows.get("ASI/Feat"), "Grappler");
});

test("levelUpSummary writes the Constitution modifier with its sign, never \"+-\"", () => {
  const lowCon = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 6, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 3 }],
  });
  const planned = planLevelUp(lowCon, { className: "Fighter" });
  if (!planned.ok) assert.fail(planned.reason);
  const rolled = rollPlanHitPoints(planned.plan, lowCon, () => 10).plan;
  const rows = new Map(levelUpSummary(rolled, lowCon, { fullHealOnLevelUp: false }).map((r) => [r.label, r.value]));
  const method = rows.get("Hit points method") ?? "";
  assert.equal(method, "Roll 1d10-2: 10 → +8", "a negative Constitution modifier keeps its sign in the roll detail");
  assert.ok(!method.includes("+-"), "no \"+-\" in the hit points method");
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
