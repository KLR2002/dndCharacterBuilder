import { test } from "node:test";
import assert from "node:assert/strict";
import { increaseSummary } from "../src/rules/ancestryIncreases.ts";
import type { AbilityScoreChoiceData, RaceData, SubraceData } from "../src/types/dnd5e.ts";

// The race card's one-line summary of a held race or subrace's increases. Every name here is invented.

const SOURCE = "TST";
const ALL_SIX = ["str", "dex", "con", "int", "wis", "cha"] as const;

const subrace = (
  name: string,
  raceName: string,
  abilityScoreIncrease: Record<string, number>[],
  extra: Partial<SubraceData> = {},
): SubraceData => ({
  name,
  source: SOURCE,
  raceName,
  raceSource: SOURCE,
  abilityScoreIncrease,
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
  ...extra,
});

const race = (
  name: string,
  abilityScoreIncrease: Record<string, number>[],
  abilityScoreChoices?: AbilityScoreChoiceData[],
): RaceData => ({
  name,
  source: SOURCE,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease,
  ...(abilityScoreChoices ? { abilityScoreChoices } : {}),
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
});

test("a fixed increase and a choice from two scores read as one line", () => {
  const variant = subrace("Sample Variant", "Sample Tiefling", [{ int: 1 }], {
    replacesRaceAbilityScores: true,
    abilityScoreChoices: [{ from: ["dex", "cha"], count: 1, amount: 2 }],
  });
  assert.equal(increaseSummary(undefined, variant), "INT +1, +2 DEX or CHA");
});

test("a pool of every score but the fixed one reads as others", () => {
  const halfling = race(
    "Sample Half",
    [{ cha: 2 }],
    [{ from: ["str", "dex", "con", "int", "wis"], count: 2, amount: 1 }],
  );
  assert.equal(increaseSummary(halfling), "CHA +2, +1 to 2 others");
});

test("a pool of all six scores reads as scores", () => {
  const human = race("Sample Human", [], [{ from: [...ALL_SIX], count: 2, amount: 1 }]);
  assert.equal(increaseSummary(human), "+1 to 2 scores");
});

test("a single pick from all six reads as score", () => {
  const custom = race("Sample Lineage", [], [{ from: [...ALL_SIX], count: 1, amount: 2 }]);
  assert.equal(increaseSummary(custom), "+2 to 1 score");
});

test("a pool of three scores lists them with a final or", () => {
  const mixed = race("Sample Mixed", [], [{ from: ["str", "dex", "con"], count: 1, amount: 2 }]);
  assert.equal(increaseSummary(mixed), "+2 STR, DEX or CON");
});

test("a pick of more than one from a short pool names the count", () => {
  const pair = race("Sample Pair", [], [{ from: ["str", "dex", "con"], count: 2, amount: 1 }]);
  assert.equal(increaseSummary(pair), "+1 to 2 of STR, DEX or CON");
});

test("a replacing subrace shows only its own increases", () => {
  const replacing = race("Sample Fiendish", [{ con: 2 }]);
  const sub = subrace("Sample Fiend", "Sample Fiendish", [{ wis: 1 }], { replacesRaceAbilityScores: true });
  assert.equal(increaseSummary(replacing, sub), "WIS +1");
});

test("a subrace that adds to its race combines the fixed increases", () => {
  const hill = race("Sample Hill Race", [{ con: 2 }]);
  const sub = subrace("Sample Hill", "Sample Hill Race", [{ wis: 1 }]);
  assert.equal(increaseSummary(hill, sub), "CON +2, WIS +1");
});

test("fixed increases on the same score are summed", () => {
  const sub = race("Sample Summed", [{ int: 1 }]);
  const extra = subrace("Sample Extra", "Sample Summed", [{ int: 1 }]);
  assert.equal(increaseSummary(sub, extra), "INT +2");
});

test("a race with neither fixed increases nor a choice has no summary", () => {
  assert.equal(increaseSummary(race("Sample Flexible", [])), "");
});
