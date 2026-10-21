import test from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { anyLanguageChoice, fixedGrant, lamplighterBackground, vellariRace } from "./proficiencySheetFixture.ts";
import type { Character } from "../src/types/character.ts";

// Every race, background, grant and name in this file is invented.

const RACE_CHOICE = "TST/Race/Vellari@0#1";
const TOOL_CHOICE = "TST/Background/Lamplighter@0#1";

const compendium = inMemoryCompendium({
  races: [
    vellariRace({
      grants: [fixedGrant("TST/Race/Vellari@0#0", "languages", ["Common"]), anyLanguageChoice(RACE_CHOICE, 1)],
    }),
  ],
  backgrounds: [
    lamplighterBackground({
      grants: [
        fixedGrant("TST/Background/Lamplighter@0#0", "tools", ["lantern kit"]),
        { id: TOOL_CHOICE, kind: "choice", category: "tools", count: 1, pool: { kind: "names", names: ["cook's utensils", "mason's tools"] } },
      ],
    }),
  ],
});

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name).sort();
const sheetOf = (character: Character) => {
  const sheet = proficiencySheet(character, { compendium });
  return { tools: names(sheet.tools), languages: names(sheet.languages) };
};

test("a race language saved in the race bucket moves into the race's choice, and the sheet does not change", () => {
  const before = makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Elvish"] } });
  const after = reconcile(before, compendium);
  assert.deepEqual(after.proficiencyPicks?.[RACE_CHOICE], ["Elvish"]);
  assert.equal(after.chosenLanguages?.race, undefined, "the bucket is cleared once its name is recorded as a pick");
  assert.deepEqual(sheetOf(after), sheetOf(before));
});

test("a background tool saved in the background bucket moves into the background's choice, and the sheet does not change", () => {
  const before = makeChar({ background: { name: "Lamplighter", source: "PHB" }, chosenTools: { background: ["Cook's Utensils"] } });
  const after = reconcile(before, compendium);
  assert.deepEqual(after.proficiencyPicks?.[TOOL_CHOICE], ["Cook's Utensils"]);
  assert.equal(after.chosenTools?.background, undefined);
  assert.deepEqual(sheetOf(after), sheetOf(before));
});

test("a saved name that no choice offers stays in its bucket, and the sheet still shows it", () => {
  const before = makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Dragonish"] } });
  const after = reconcile(before, compendium);
  assert.deepEqual(after.chosenLanguages?.race, ["Dragonish"]);
  assert.equal(after.proficiencyPicks?.[RACE_CHOICE], undefined);
  assert.ok(sheetOf(after).languages.includes("Dragonish"));
});

test("a choice takes no more names than its count, and the rest stay in the bucket", () => {
  const before = makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Elvish", "Gnomish"] } });
  const after = reconcile(before, compendium);
  assert.deepEqual(after.proficiencyPicks?.[RACE_CHOICE], ["Elvish"]);
  assert.deepEqual(after.chosenLanguages?.race, ["Gnomish"]);
  assert.deepEqual(sheetOf(after), sheetOf(before));
});

test("reconciling a migrated character again changes nothing", () => {
  const before = makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Elvish"] } });
  const once = reconcile(before, compendium);
  assert.deepEqual(reconcile(once, compendium), once);
});
