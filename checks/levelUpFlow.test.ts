import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium, srdBaselineCompendium } from "./testUtils.ts";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { planLevelUp, applyLevelUpPlan, type LevelUpPlan } from "../src/rules/levelUpFlow.ts";
import { maxHp } from "../src/rules/hp.ts";
import { removeClassLevel } from "../src/rules/builderTransitions.ts";

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

test("Fighter 3->4 plans only Class, Hit Points, ASI/Feat, Review", () => {
  const result = planLevelUp(FIGHTER_3, { className: "Fighter" });
  if (!result.ok) assert.fail(result.reason);
  assert.deepEqual(
    result.plan.steps.map((s) => s.id),
    ["class", "hitPoints", "asiFeat", "review"]
  );
});

test("Wizard 1->2 plans only Class, Hit Points, Subclass, Spells, Review", () => {
  const wizard = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
  });
  const result = planLevelUp(wizard, { className: "Wizard" });
  if (!result.ok) assert.fail(result.reason);
  assert.deepEqual(
    result.plan.steps.map((s) => s.id),
    ["class", "hitPoints", "subclass", "spells", "review"]
  );
});

test("a Wizard 3 planning Fighter 1 (requirements met) includes Class Choices", () => {
  const wizard3 = makeChar({
    baseAbilityScores: { str: 14, dex: 10, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
  });
  const result = planLevelUp(wizard3, { className: "Fighter", source: "PHB" });
  if (!result.ok) assert.fail(result.reason);
  assert.equal(result.plan.fromLevel, 0);
  assert.equal(result.plan.toLevel, 1);
  // Fighter 1 brings the Fighting Style, resolved through the feature's options.
  assert.deepEqual(
    result.plan.steps.map((s) => s.id),
    ["class", "hitPoints", "classChoices", "review"]
  );
});

test("a multiclass entry into a class whose entry grants a skill pick plans Class Choices", () => {
  // Rogue's multiclassing record offers a skill pick, so its level 1 brings a Class Choice.
  const fighter3 = makeChar({
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
  const result = planLevelUp(fighter3, { className: "Rogue", source: "PHB" });
  if (!result.ok) assert.fail(result.reason);
  assert.equal(result.plan.fromLevel, 0);
  assert.equal(result.plan.toLevel, 1);
  assert.deepEqual(
    result.plan.steps.map((s) => s.id),
    ["class", "hitPoints", "classChoices", "review"]
  );
});

test("a first Fighter 1 plan includes Class Choices", () => {
  const fresh = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
  });
  const result = planLevelUp(fresh, { className: "Fighter", source: "PHB" });
  if (!result.ok) assert.fail(result.reason);
  assert.deepEqual(
    result.plan.steps.map((s) => s.id),
    ["class", "hitPoints", "classChoices", "review"]
  );
});

test("a Fighter 3->4 plan still does not include Class Choices", () => {
  const result = planLevelUp(FIGHTER_3, { className: "Fighter" });
  if (!result.ok) assert.fail(result.reason);
  assert.ok(!result.plan.steps.some((s) => s.id === "classChoices"));
});

test("a new class with an unmet requirement is refused, naming the requirement", () => {
  const fighterInt12 = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 12, wis: 10, cha: 10 },
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
  const result = planLevelUp(fighterInt12, { className: "Wizard", source: "PHB" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /Wizard/);
  assert.match(result.reason, /Intelligence 13/);
});

test("a new class with the requirement met plans a level 1 of it", () => {
  const fighterInt13 = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 13, wis: 10, cha: 10 },
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
  const result = planLevelUp(fighterInt13, { className: "Wizard", source: "PHB" });
  if (!result.ok) assert.fail(result.reason);
  assert.equal(result.plan.fromLevel, 0);
  assert.equal(result.plan.toLevel, 1);
  assert.deepEqual(
    result.plan.steps.map((s) => s.id),
    ["class", "hitPoints", "spells", "review"]
  );
});

test("Hit Points by average: a d10 class with Constitution 14 adds 8", () => {
  const result = planLevelUp(FIGHTER_3, { className: "Fighter", hitPoints: { mode: "average" } });
  if (!result.ok) assert.fail(result.reason);
  assert.equal(result.plan.hitPoints.mode, "average");
  assert.equal(result.plan.hitPoints.amount, 8);
});

test("Hit Points by roll from a fixed random source (a die face per call): face plus 2, never less than 1", () => {
  const rolled = planLevelUp(FIGHTER_3, {
    className: "Fighter",
    hitPoints: { mode: "roll" },
    random: () => 10,
  });
  if (!rolled.ok) assert.fail(rolled.reason);
  assert.equal(rolled.plan.hitPoints.mode, "roll");
  assert.equal(rolled.plan.hitPoints.roll, 10);
  assert.equal(rolled.plan.hitPoints.amount, 12);

  const lowCon = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 6, int: 10, wis: 10, cha: 10 },
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
  const minimum = planLevelUp(lowCon, {
    className: "Fighter",
    hitPoints: { mode: "roll" },
    random: () => 0,
  });
  if (!minimum.ok) assert.fail(minimum.reason);
  assert.equal(minimum.plan.hitPoints.roll, 1);
  assert.equal(minimum.plan.hitPoints.amount, 1);
});

test("an unapplied plan leaves the Character deep-equal; applying sets the level and every pick", () => {
  const before = makeChar({
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
    currentHp: 20,
  });
  const snapshot = structuredClone(before);
  const result = planLevelUp(before, {
    className: "Fighter",
    hitPoints: { mode: "average" },
    picks: { asi: { level: 4, type: "asi", asi: { con: 2 } } },
  });
  if (!result.ok) assert.fail(result.reason);
  // Cancelled on Review: the plan was never applied, the Character is exactly as before.
  assert.deepEqual(before, snapshot);

  const applied = applyLevelUpPlan(before, result.plan, { fullHealOnLevelUp: false });
  assert.equal(applied.classes[0].level, 4);
  const asi = applied.asiSelections.find(
    (s) => s.className === "Fighter" && (s.classLevel ?? s.level) === 4
  );
  assert.ok(asi);
  assert.deepEqual(asi.asi, { con: 2 });
  assert.equal(applied.currentHp, 20);
  // Applying returns a new Character; the original is untouched.
  assert.deepEqual(before, snapshot);
});

test("applying a rolled Fighter 3->4 plan raises maxHp by the die face plus the Constitution modifier, minimum 1", () => {
  const before = maxHp(FIGHTER_3);
  const rolled = planLevelUp(FIGHTER_3, {
    className: "Fighter",
    hitPoints: { mode: "roll" },
    random: () => 10,
  });
  if (!rolled.ok) assert.fail(rolled.reason);
  assert.equal(rolled.plan.hitPoints.roll, 10);
  const applied = applyLevelUpPlan(FIGHTER_3, rolled.plan, { fullHealOnLevelUp: false });
  assert.equal(applied.classes[0].level, 4);
  // d10 face 10 + Con 14 (+2): the rolled amount, not the fixed average 6 + 2.
  assert.equal(maxHp(applied), before + 12);

  const lowCon = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 6, int: 10, wis: 10, cha: 10 },
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
  const lowRolled = planLevelUp(lowCon, {
    className: "Fighter",
    hitPoints: { mode: "roll" },
    random: () => 0,
  });
  if (!lowRolled.ok) assert.fail(lowRolled.reason);
  assert.equal(lowRolled.plan.hitPoints.roll, 1);
  const appliedLow = applyLevelUpPlan(lowCon, lowRolled.plan, { fullHealOnLevelUp: false });
  // face 1 - Con 2 floors at 1.
  assert.equal(maxHp(appliedLow), maxHp(lowCon) + 1);
});

test("applying a rolled plan records the die face, so a later Constitution change moves that level's HP", () => {
  const fresh = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
  });
  const rolled = planLevelUp(fresh, {
    className: "Fighter",
    source: "PHB",
    hitPoints: { mode: "roll" },
    random: () => 7,
  });
  if (!rolled.ok) assert.fail(rolled.reason);
  assert.equal(rolled.plan.hitPoints.roll, 7); // the source returns the face 7
  const applied = applyLevelUpPlan(fresh, rolled.plan, { fullHealOnLevelUp: false });
  assert.equal(applied.classes[0].level, 1);
  // The record holds the face, not the rolled amount face + Con.
  assert.deepEqual(applied.rolledHitPoints, { "Fighter__1": 7 });
  assert.equal(maxHp(applied), 9); // face 7 + Con 2
  const raisedCon = { ...applied, baseAbilityScores: { ...applied.baseAbilityScores, con: 16 } };
  assert.equal(maxHp(raisedCon), 10); // face 7 + Con 3
});

test("applying an averaged Fighter 3->4 plan raises maxHp by the fixed average", () => {
  const before = maxHp(FIGHTER_3);
  const averaged = planLevelUp(FIGHTER_3, { className: "Fighter", hitPoints: { mode: "average" } });
  if (!averaged.ok) assert.fail(averaged.reason);
  const applied = applyLevelUpPlan(FIGHTER_3, averaged.plan, { fullHealOnLevelUp: false });
  assert.equal(applied.classes[0].level, 4);
  // fixed average 6 + Con 2.
  assert.equal(maxHp(applied), before + 8);
});

test("removing the level restores the previous maxHp", () => {
  const before = maxHp(FIGHTER_3);
  const rolled = planLevelUp(FIGHTER_3, {
    className: "Fighter",
    hitPoints: { mode: "roll" },
    random: () => 10,
  });
  if (!rolled.ok) assert.fail(rolled.reason);
  const applied = applyLevelUpPlan(FIGHTER_3, rolled.plan, { fullHealOnLevelUp: false });
  assert.equal(maxHp(applied), before + 12);
  const removed = removeClassLevel(applied, "Fighter", inMemoryCompendium(), ALL_BOOKS);
  assert.equal(removed.classes[0].level, 3);
  assert.equal(maxHp(removed), before);
});

test("applying a Wizard 1->2 plan sets the level, the subclass pick and the learned spells together", () => {
  const wizard = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    currentHp: 4,
  });
  const result = planLevelUp(wizard, {
    className: "Wizard",
    picks: {
      subclass: { name: "School of Evocation", source: "SRD" },
      learnedSpells: [{ name: "Magic Missile", source: "PHB" }],
    },
  });
  if (!result.ok) assert.fail(result.reason);
  const applied = applyLevelUpPlan(wizard, result.plan, { fullHealOnLevelUp: true });
  assert.equal(applied.classes[0].level, 2);
  assert.equal(applied.classes[0].subclassName, "School of Evocation");
  assert.ok((applied.knownSpells ?? []).some((s) => s.name === "Magic Missile"));
});

test("a plan refuses a class already at level 20 and a character already at total level 20", () => {
  const scores = { str: 15, dex: 14, con: 14, int: 16, wis: 12, cha: 10 };
  const capped = makeChar({ baseAbilityScores: scores, classes: [{ className: "Fighter", source: "PHB", level: 20 }] });
  const inClass = planLevelUp(capped, { className: "Fighter" });
  assert.equal(inClass.ok, false, "a class beyond level 20 is refused");
  if (!inClass.ok) assert.match(inClass.reason, /20/);
  const multiclass = planLevelUp(capped, { className: "Wizard", source: "PHB" });
  assert.equal(multiclass.ok, false, "a total character level beyond 20 is refused");
  if (!multiclass.ok) assert.match(multiclass.reason, /20/);

  const split = makeChar({
    baseAbilityScores: scores,
    classes: [
      { className: "Fighter", source: "PHB", level: 19 },
      { className: "Wizard", source: "PHB", level: 1 },
    ],
  });
  assert.equal(planLevelUp(split, { className: "Fighter" }).ok, false, "total level 20 refuses another level");
});

test("applyLevelUpPlan applies a subclass only on a plan's Subclass step and never replaces a held one", () => {
  const srd = srdBaselineCompendium();
  const scores = { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 };
  const fighterAt = (level: number, subclassName?: string) =>
    makeChar({
      baseAbilityScores: scores,
      classes: [
        {
          className: "Fighter",
          source: "PHB",
          level,
          ...(subclassName ? { subclassName, subclass: subclassName, subclassSource: "SRD" } : {}),
        },
      ],
    });

  // Level 2 is below the Fighter's subclass level: the plan has no Subclass step, so the sole
  // offered subclass is not applied.
  const to2 = planLevelUp(fighterAt(1), { className: "Fighter", compendium: srd, activeBooks: ALL_BOOKS });
  if (!to2.ok) assert.fail(to2.reason);
  assert.ok(!to2.plan.steps.some((s) => s.id === "subclass"));
  const applied2 = applyLevelUpPlan(fighterAt(1), to2.plan, { compendium: srd, activeBooks: ALL_BOOKS, fullHealOnLevelUp: false });
  assert.equal(applied2.classes[0].level, 2);
  assert.equal(applied2.classes[0].subclassName, undefined, "no Subclass step, no subclass applied");

  // Level 3 reaches the subclass level: the plan has the step and the sole offered subclass is taken.
  const to3 = planLevelUp(fighterAt(2), { className: "Fighter", compendium: srd, activeBooks: ALL_BOOKS });
  if (!to3.ok) assert.fail(to3.reason);
  assert.ok(to3.plan.steps.some((s) => s.id === "subclass"));
  const applied3 = applyLevelUpPlan(fighterAt(2), to3.plan, { compendium: srd, activeBooks: ALL_BOOKS, fullHealOnLevelUp: false });
  assert.equal(applied3.classes[0].level, 3);
  assert.equal(applied3.classes[0].subclassName, "Champion");

  // A later level-up has no Subclass step and never touches the held subclass, even with a pick recorded.
  const to4 = planLevelUp(applied3, {
    className: "Fighter",
    compendium: srd,
    activeBooks: ALL_BOOKS,
    picks: { subclass: { name: "Battle Master", source: "PHB" } },
  });
  if (!to4.ok) assert.fail(to4.reason);
  assert.ok(!to4.plan.steps.some((s) => s.id === "subclass"), "a held subclass means no Subclass step");
  const applied4 = applyLevelUpPlan(applied3, to4.plan, { compendium: srd, activeBooks: ALL_BOOKS, fullHealOnLevelUp: false });
  assert.equal(applied4.classes[0].level, 4);
  assert.equal(applied4.classes[0].subclassName, "Champion", "a held subclass is never replaced");
});

test("applyLevelUpPlan refuses a stale plan that would take a class or the character beyond level 20", () => {
  const capped = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 20 }],
  });
  const stale: LevelUpPlan = {
    characterId: capped.id,
    className: "Fighter",
    source: "PHB",
    fromLevel: 20,
    toLevel: 21,
    steps: [],
    hitPoints: { mode: "average", amount: 8 },
    picks: {},
  };
  assert.equal(applyLevelUpPlan(capped, stale), capped, "a plan to level 21 is refused");
});
