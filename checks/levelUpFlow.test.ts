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
