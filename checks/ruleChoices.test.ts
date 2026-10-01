import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { availableRuleChoices, ruleChoiceId, type Character } from "../src/rules/ruleChoices.ts";
import { makeChar } from "./testUtils.ts";

const races = JSON.parse(readFileSync(new URL("../src/data/races.json", import.meta.url), "utf8"));
const catalog = { races };

const raceChar = (name: string, source: string, subrace?: { name: string; source: string }): Character =>
  makeChar({ race: { name, source, subraceName: subrace?.name, subraceSource: subrace?.source } });

test("a character's rule choices are keyed by source first, so same-named ancestries stay distinct", () => {
  const id = ruleChoiceId({ source: "MTF", race: "Elf", subrace: { name: "Eladrin", source: "MTF" }, trait: "Fey Step" });
  assert.ok(id.startsWith("MTF__Elf__Eladrin__Fey Step"), `unexpected id shape: ${id}`);
});

test("an aasimar's revelation is available as one pick from three at third level", () => {
  const available = availableRuleChoices(raceChar("Aasimar", "MPMM"), races, 1);
  assert.equal(available.length, 0, "the revelation is not available at first level");

  const atThree = availableRuleChoices(raceChar("Aasimar", "MPMM"), races, 3);
  assert.equal(atThree.length, 1);
  assert.equal(atThree[0].id, ruleChoiceId({ source: "MPMM", race: "Aasimar", subrace: null, trait: "Celestial Revelation" }));
  assert.equal(atThree[0].choose, 1);
  assert.deepEqual(atThree[0].options.map((o) => o.name), ["Necrotic Shroud", "Radiant Consumption", "Radiant Soul"]);
  assert.equal(atThree[0].replaces, undefined);
});

test("an eladrin's season is available from first level but its effect waits for third", () => {
  const atOne = availableRuleChoices(raceChar("Eladrin", "MPMM"), races, 1);
  assert.equal(atOne.length, 1);
  assert.equal(atOne[0].level, 1);
  assert.equal(atOne[0].effectLevel, 3);
  assert.deepEqual(atOne[0].options.map((o) => o.name), ["Autumn", "Winter", "Spring", "Summer"]);
});

test("a variant half-elf's descent feature is available from first level and records what it replaces", () => {
  const available = availableRuleChoices(
    raceChar("Half-Elf", "PHB", { name: "Drow Descent", source: "SCAG" }),
    races,
    1
  );
  assert.equal(available.length, 1);
  assert.equal(available[0].replaces, "Skill Versatility");
  assert.deepEqual(available[0].options.map((o) => o.name), ["Skill Versatility", "Drow Magic"]);
});

test("ancestries with no rule choice offer none", () => {
  assert.deepEqual(availableRuleChoices(raceChar("Goliath", "VGM"), races, 20), []);
  assert.deepEqual(availableRuleChoices(makeChar(), races, 20), []);
});

test("choices are offered only when their source book is active", () => {
  const activeBooks = ["PHB", "MPMM"];
  assert.equal(availableRuleChoices(raceChar("Aasimar", "MPMM"), races, 3, activeBooks).length, 1);
  assert.equal(availableRuleChoices(raceChar("Aasimar", "MPMM"), races, 3, ["PHB"]).length, 0);
});

test("a character without recorded choices migrates without error and defaults to none", () => {
  const legacy = JSON.parse(JSON.stringify({ ...makeChar(), ruleChoices: undefined }));
  delete legacy.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.deepEqual(migrated.ruleChoices, []);
});

test("a variant half-elf with no recorded choice is flagged for review", () => {
  const legacy = JSON.parse(
    JSON.stringify(raceChar("Half-Elf", "PHB", { name: "Drow Descent", source: "SCAG" }))
  );
  delete legacy.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.ok(
    (migrated.needsReview ?? []).some((m) => m.includes("ruleChoices")),
    `expected a ruleChoices review flag, got ${JSON.stringify(migrated.needsReview)}`
  );
});

test("a character with no ancestry rule choice is not flagged", () => {
  const legacy = JSON.parse(JSON.stringify(raceChar("Goliath", "VGM")));
  delete legacy.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.equal((migrated.needsReview ?? []).some((m) => m.includes("ruleChoices")), false);
});

test("an aasimar who already chose a revelation is not flagged", () => {
  const id = ruleChoiceId({ source: "MPMM", race: "Aasimar", subrace: null, trait: "Celestial Revelation" });
  const chosen = { race: { name: "Aasimar", source: "MPMM" }, ruleChoices: [{ id, origin: "race", choose: 1, from: ["Necrotic Shroud"], picked: ["Necrotic Shroud"] }] };
  const legacy = JSON.parse(JSON.stringify(makeChar(chosen as Partial<Character>)));
  delete legacy.ruleChoices;
  legacy.ruleChoices = chosen.ruleChoices;
  const migrated = migrateCharacter(legacy, races);
  assert.equal(migrated.ruleChoices?.length, 1);
  assert.equal((migrated.needsReview ?? []).some((m) => m.includes("ruleChoices")), false);
});

test("a malformed rule choice entry is rejected rather than silently dropped", () => {
  const legacy = JSON.parse(JSON.stringify(makeChar()));
  legacy.ruleChoices = [{ origin: "race" }];
  assert.throws(() => migrateCharacter(legacy, races), /ruleChoices/);
});