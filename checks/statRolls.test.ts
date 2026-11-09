import { test } from "node:test";
import assert from "node:assert/strict";
import { ABILITIES, ABILITY_NAMES } from "../src/rules/abilities.ts";
import type { AbilityKey } from "../src/types/character.ts";
import { checkSource, INITIATIVE_SOURCE, saveSource } from "../src/rules/statRolls.ts";

test("each ability check's Roll Log source reads like \"Strength check\"", () => {
  const expected: Record<AbilityKey, string> = {
    str: "Strength check",
    dex: "Dexterity check",
    con: "Constitution check",
    int: "Intelligence check",
    wis: "Wisdom check",
    cha: "Charisma check",
  };
  for (const key of ABILITIES) {
    assert.equal(checkSource(key), expected[key]);
    assert.equal(checkSource(key), `${ABILITY_NAMES[key]} check`);
  }
});

test("each saving throw's Roll Log source reads like \"Wisdom save\"", () => {
  const expected: Record<AbilityKey, string> = {
    str: "Strength save",
    dex: "Dexterity save",
    con: "Constitution save",
    int: "Intelligence save",
    wis: "Wisdom save",
    cha: "Charisma save",
  };
  for (const key of ABILITIES) {
    assert.equal(saveSource(key), expected[key]);
    assert.equal(saveSource(key), `${ABILITY_NAMES[key]} save`);
  }
});

test("the initiative roll's Roll Log source is \"Initiative\"", () => {
  assert.equal(INITIATIVE_SOURCE, "Initiative");
});
