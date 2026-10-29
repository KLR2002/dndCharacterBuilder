import { ALL_BOOKS } from "../src/constants/books.ts";
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
  const sheet = proficiencySheet(character, { compendium, activeBooks: ALL_BOOKS });
  return { tools: names(sheet.tools), languages: names(sheet.languages) };
};

test("a race language saved in the race bucket moves into the race's choice, and the sheet does not change", () => {
  const before = makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Elvish"] } });
  const after = reconcile(before, compendium, { activeBooks: ALL_BOOKS });
  assert.deepEqual(after.proficiencyPicks?.[RACE_CHOICE], ["Elvish"]);
  assert.equal(after.chosenLanguages?.race, undefined, "the bucket is cleared once its name is recorded as a pick");
  assert.deepEqual(sheetOf(after), sheetOf(before));
});

test("a background tool saved in the background bucket moves into the background's choice, and the sheet does not change", () => {
  const before = makeChar({ background: { name: "Lamplighter", source: "PHB" }, chosenTools: { background: ["Cook's Utensils"] } });
  const after = reconcile(before, compendium, { activeBooks: ALL_BOOKS });
  assert.deepEqual(after.proficiencyPicks?.[TOOL_CHOICE], ["Cook's Utensils"]);
  assert.equal(after.chosenTools?.background, undefined);
  assert.deepEqual(sheetOf(after), sheetOf(before));
});

test("a saved name that no choice offers stays in its bucket, and the sheet still shows it", () => {
  const before = makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Dragonish"] } });
  const after = reconcile(before, compendium, { activeBooks: ALL_BOOKS });
  assert.deepEqual(after.chosenLanguages?.race, ["Dragonish"]);
  assert.equal(after.proficiencyPicks?.[RACE_CHOICE], undefined);
  assert.ok(sheetOf(after).languages.includes("Dragonish"));
});

test("a choice takes no more names than its count, and the rest stay in the bucket", () => {
  const before = makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Elvish", "Gnomish"] } });
  const after = reconcile(before, compendium, { activeBooks: ALL_BOOKS });
  assert.deepEqual(after.proficiencyPicks?.[RACE_CHOICE], ["Elvish"]);
  assert.deepEqual(after.chosenLanguages?.race, ["Gnomish"]);
  assert.deepEqual(sheetOf(after), sheetOf(before));
});

test("reconciling a migrated character again changes nothing", () => {
  const before = makeChar({ race: { name: "Vellari", source: "PHB" }, chosenLanguages: { race: ["Elvish"] } });
  const once = reconcile(before, compendium, { activeBooks: ALL_BOOKS });
  assert.deepEqual(reconcile(once, compendium, { activeBooks: ALL_BOOKS }), once);
});

test("changing race releases the pick stored on the old race's choice, with a review notice", () => {
  const before = makeChar({
    race: { name: "Vellari", source: "PHB" },
    proficiencyPicks: { [RACE_CHOICE]: ["Elvish"] },
  });
  const after = reconcile({ ...before, race: { name: "Lamp Folk", source: "PHB" } }, compendium, { activeBooks: ALL_BOOKS });
  assert.equal(after.proficiencyPicks?.[RACE_CHOICE], undefined);
  assert.ok(after.needsReview?.some((notice) => notice.includes("Elvish") && notice.includes("Vellari")));
  assert.ok(!sheetOf(after).languages.includes("Elvish"));
});

test("changing background releases the pick stored on the old background's choice", () => {
  const before = makeChar({
    background: { name: "Lamplighter", source: "PHB" },
    proficiencyPicks: { [TOOL_CHOICE]: ["Cook's Utensils"] },
  });
  const after = reconcile({ ...before, background: { name: "Acolyte", source: "PHB" } }, compendium, { activeBooks: ALL_BOOKS });
  assert.equal(after.proficiencyPicks?.[TOOL_CHOICE], undefined);
  assert.ok(after.needsReview?.some((notice) => notice.includes("Cook's Utensils")));
});

test("a race and background still held keep their picks through reconciling", () => {
  const before = makeChar({
    race: { name: "Vellari", source: "PHB" },
    background: { name: "Lamplighter", source: "PHB" },
    proficiencyPicks: { [RACE_CHOICE]: ["Elvish"], [TOOL_CHOICE]: ["Cook's Utensils"] },
  });
  assert.deepEqual(reconcile(before, compendium, { activeBooks: ALL_BOOKS }).proficiencyPicks, before.proficiencyPicks);
});

const SUBRACE_CHOICE = "TST/Subrace/Vellari (Tidewalker)@0#0";
const withSubrace = inMemoryCompendium({
  races: [
    vellariRace({
      grants: [fixedGrant("TST/Race/Vellari@0#0", "languages", ["Common"])],
      subraces: [
        {
          name: "Tidewalker",
          source: "PHB",
          raceName: "Vellari",
          raceSource: "PHB",
          abilityScoreIncrease: [],
          darkvision: null,
          traits: [],
          description: "Placeholder description for the Tidewalker.",
          grants: [anyLanguageChoice(SUBRACE_CHOICE, 1)],
        },
      ],
    }),
  ],
});

test("a subrace's pick is kept while the subrace is held, and released when the subrace is dropped", () => {
  const held = makeChar({
    race: { name: "Vellari", source: "PHB", subraceName: "Tidewalker", subraceSource: "PHB" },
    proficiencyPicks: { [SUBRACE_CHOICE]: ["Elvish"] },
  });
  assert.deepEqual(reconcile(held, withSubrace, { activeBooks: ALL_BOOKS }).proficiencyPicks, held.proficiencyPicks);
  const dropped = reconcile({ ...held, race: { name: "Vellari", source: "PHB" } }, withSubrace, { activeBooks: ALL_BOOKS });
  assert.equal(dropped.proficiencyPicks?.[SUBRACE_CHOICE], undefined);
  assert.ok(dropped.needsReview?.some((notice) => notice.includes("Elvish")));
});
