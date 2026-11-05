import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSrdCatalog } from "./testUtils.ts";

test("the SRD Baseline Half-Elf has fixed Charisma 2 and a choice of two scores at +1 from the five others", () => {
  const races = loadSrdCatalog<{ name: string; abilityScoreIncrease: Record<string, number>[]; abilityScoreChoices?: unknown }[]>("races");
  const halfElf = races.find((race) => race.name === "Half-Elf");
  assert.ok(halfElf, "the SRD Baseline has a Half-Elf");
  assert.deepEqual(halfElf.abilityScoreIncrease, [{ cha: 2 }]);
  assert.deepEqual(halfElf.abilityScoreChoices, [{ from: ["str", "dex", "con", "int", "wis"], count: 2, amount: 1 }]);
});
