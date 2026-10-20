import test from "node:test";
import assert from "node:assert/strict";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { inMemoryCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";
import { lamplighterBackground, vellariRace } from "./proficiencySheetFixture.ts";

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

const fixtureCompendium = () =>
  inMemoryCompendium({ races: [vellariRace()], backgrounds: [lamplighterBackground()] });

test("race fixed languages and picked race languages appear on the sheet as rule-granted", () => {
  const sheet = proficiencySheet(
    makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Elvish"] } }),
    { compendium: fixtureCompendium() },
  );
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral", "Elvish"]);
  assert.ok(sheet.languages.every((entry) => entry.ruleGranted));
});

test("background tools are normalized, and picked background tools are added after them", () => {
  const sheet = proficiencySheet(
    makeChar({
      background: { name: "Lamplighter", source: "PHB" },
      chosenTools: { background: ["Smith's Tools"] },
    }),
    { compendium: fixtureCompendium() },
  );
  assert.deepEqual(names(sheet.tools), ["Lantern Kit", "Smith's Tools"]);
});

test("a language or tool named by two sources appears once, matched case-insensitively", () => {
  const sheet = proficiencySheet(
    makeChar({
      race: { name: "Vellari", source: "PHB" },
      background: { name: "Lamplighter", source: "PHB" },
      chosenLanguages: { race: ["quoral", "common"] },
      chosenTools: { background: ["LANTERN KIT"] },
    }),
    { compendium: fixtureCompendium() },
  );
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral"]);
  assert.deepEqual(names(sheet.tools), ["Lantern Kit"]);
});

test("background languages are fixed and picked, and join the race languages", () => {
  const compendium = inMemoryCompendium({
    races: [vellariRace()],
    backgrounds: [lamplighterBackground({ languages: ["Lamplighter's Cant"] })],
  });
  const sheet = proficiencySheet(
    makeChar({
      race: { name: "Vellari", source: "PHB" },
      background: { name: "Lamplighter", source: "PHB" },
      chosenLanguages: { background: ["Elvish"] },
    }),
    { compendium },
  );
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral", "Lamplighter's Cant", "Elvish"]);
});

test("class starting tools and multiclass tool proficiencies both appear", () => {
  const sheet = proficiencySheet(
    makeChar({
      classes: [{ className: "Rogue", source: "PHB", level: 1 }],
      multiclassProficiencies: [{ className: "Druid", tools: ["Herbalism Kit"] }],
    }),
    { compendium: inMemoryCompendium() },
  );
  assert.deepEqual(names(sheet.tools), ["Thieves' Tools", "Herbalism Kit"]);
});

test("a character with no source shows Common and no tools", () => {
  const sheet = proficiencySheet(makeChar(), { compendium: inMemoryCompendium() });
  assert.deepEqual(names(sheet.languages), ["Common"]);
  assert.deepEqual(sheet.tools, []);
});

test("without the Integrated Catalog the SRD Baseline supplies race languages", () => {
  const sheet = proficiencySheet(
    makeChar({ race: { name: "Dwarf", source: "PHB", subraceName: "Hill", subraceSource: "PHB" } }),
    { compendium: srdBaselineCompendium() },
  );
  assert.ok(names(sheet.languages).includes("Common"));
  assert.ok(names(sheet.languages).includes("Dwarvish"));
});
