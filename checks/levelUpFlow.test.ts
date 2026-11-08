import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { planLevelUp } from "../src/rules/levelUpFlow.ts";

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

test("Hit Points by roll from a fixed random source: face plus 2, never less than 1", () => {
  const rolled = planLevelUp(FIGHTER_3, {
    className: "Fighter",
    hitPoints: { mode: "roll" },
    random: () => 0.95,
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
