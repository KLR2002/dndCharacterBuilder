import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { setStandardArrayPick } from "../src/rules/builderTransitions.ts";
import { __setKvForTests, saveCharacters, loadCharacters } from "../src/services/storage.ts";

test("standard-array assignments survive save/reload and preserve independent picks", async () => {
  __setKvForTests(new Map());
  const original = makeChar({ abilityMethod: "standardArray" });
  const first = setStandardArrayPick(original, "str", 15);
  const second = setStandardArrayPick(first, "dex", 14);
  await saveCharacters([second]);
  const [loaded] = await loadCharacters();
  assert.deepEqual(loaded.standardArrayPicks, { str: 15, dex: 14 });
  assert.equal(loaded.baseAbilityScores.str, 15);
  assert.equal(loaded.baseAbilityScores.dex, 14);
  assert.equal(original.standardArrayPicks, undefined);
  assert.equal(original.baseAbilityScores.str, 10);
});

test("standard-array picks reject duplicate or invalid values and release replaced assignments", () => {
  const first = setStandardArrayPick(makeChar(), "str", 15);
  assert.equal(setStandardArrayPick(first, "dex", 15), first);
  for (const value of [11, 14.5, NaN, Infinity]) {
    assert.equal(setStandardArrayPick(first, "dex", value), first);
  }
  const replaced = setStandardArrayPick(first, "str", 14);
  const reassigned = setStandardArrayPick(replaced, "dex", 15);
  assert.deepEqual(reassigned.standardArrayPicks, { str: 14, dex: 15 });
  const cleared = setStandardArrayPick(reassigned, "str", null);
  assert.deepEqual(cleared.standardArrayPicks, { dex: 15 });
  assert.equal(cleared.baseAbilityScores.str, 10);
  assert.equal(cleared.baseAbilityScores.dex, 15);
  assert.deepEqual(reassigned.standardArrayPicks, { str: 14, dex: 15 });
});
