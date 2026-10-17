import test from "node:test";
import assert from "node:assert/strict";
import { commitCharacterName } from "../src/rules/characterName.ts";

test("commitCharacterName trims surrounding whitespace from the input", () => {
  assert.equal(commitCharacterName("  Elowen  ", "Old"), "Elowen");
  assert.equal(commitCharacterName("\tKael\n", "Old"), "Kael");
});

test("commitCharacterName keeps the previous name when the input is blank", () => {
  assert.equal(commitCharacterName("", "Old"), "Old");
  assert.equal(commitCharacterName("   ", "Old"), "Old");
  assert.equal(commitCharacterName("\t \n", "Old"), "Old");
});

test("commitCharacterName preserves inner spaces", () => {
  assert.equal(commitCharacterName("  Sir  Reginald   the Bold ", "Old"), "Sir  Reginald   the Bold");
});

test("commitCharacterName does not truncate long names", () => {
  const longName = "Maximilian Aurelius Bartholomew Cornelius Dragonheart the Third of Eldermoor";
  assert.equal(commitCharacterName(`  ${longName}  `, "Old"), longName);
});
