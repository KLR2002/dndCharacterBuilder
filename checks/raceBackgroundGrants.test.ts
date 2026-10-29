import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import type { SubraceData } from "../src/types/dnd5e.ts";
import { anyLanguageChoice, fixedGrant, lamplighterBackground, vellariRace } from "./proficiencySheetFixture.ts";

// Every race, subrace, background and grant name in this file is invented.

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

const tideSubrace: SubraceData = {
  name: "Tidewalker",
  source: "PHB",
  raceName: "Vellari",
  raceSource: "PHB",
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  description: "Placeholder description for the Tidewalker.",
  grants: [fixedGrant("TST/Subrace/Vellari (Tidewalker)@0#0", "languages", ["Tidal"])],
};

const coastalRace = vellariRace({
  languages: [],
  grants: [
    fixedGrant("TST/Race/Vellari@0#0", "tools", ["Lantern Kit"]),
    fixedGrant("TST/Race/Vellari@0#1", "languages", ["Quoral"]),
    fixedGrant("TST/Race/Vellari@0#2", "skills", ["Perception"]),
  ],
  subraces: [tideSubrace],
});

const catalogs = {
  compendium: inMemoryCompendium({
    races: [coastalRace],
    backgrounds: [
      lamplighterBackground({
        grants: [
          fixedGrant("TST/Background/Lamplighter@0#0", "skills", ["Stealth"]),
          anyLanguageChoice("TST/Background/Lamplighter@0#1", 1),
        ],
      }),
    ],
  }), activeBooks: ALL_BOOKS,
};

test("a race's fixed tools and languages appear on the sheet as rule-granted entries", () => {
  const sheet = proficiencySheet(makeChar({ race: { name: "Vellari", source: "PHB" } }), catalogs);
  assert.ok(names(sheet.tools).includes("Lantern Kit"));
  assert.ok(names(sheet.languages).includes("Quoral"));
  assert.ok(sheet.tools.every((entry) => entry.ruleGranted));
});

test("a subrace's fixed languages appear on the sheet with its race's", () => {
  const sheet = proficiencySheet(
    makeChar({ race: { name: "Vellari", source: "PHB", subraceName: "Tidewalker", subraceSource: "PHB" } }),
    catalogs,
  );
  assert.deepEqual(names(sheet.languages), ["Quoral", "Tidal"]);
});

test("a background's choice of a language is held only once picked", () => {
  const unpicked = proficiencySheet(makeChar({ background: { name: "Lamplighter", source: "PHB" } }), catalogs);
  assert.deepEqual(names(unpicked.languages), ["Common"], "a character with no race holds Common and nothing from the background until it picks");

  const picked = proficiencySheet(
    makeChar({
      background: { name: "Lamplighter", source: "PHB" },
      proficiencyPicks: { "TST/Background/Lamplighter@0#1": ["Elvish"] },
    }),
    catalogs,
  );
  assert.deepEqual(names(picked.languages), ["Common", "Elvish"]);
});

test("a background's fixed skill grant appears on the sheet as a rule-granted skill", () => {
  const sheet = proficiencySheet(makeChar({ background: { name: "Lamplighter", source: "PHB" } }), catalogs);
  assert.deepEqual(sheet.skills, [{ name: "Stealth", ruleGranted: true }]);
});

test("a race's fixed skill grant appears on the sheet, and a subrace's with its race's", () => {
  const sheet = proficiencySheet(
    makeChar({ race: { name: "Vellari", source: "PHB", subraceName: "Tidewalker", subraceSource: "PHB" } }),
    catalogs,
  );
  assert.deepEqual(names(sheet.skills), ["Perception"]);
});

test("a record's grants are read only for the record the character holds", () => {
  const sheet = proficiencySheet(makeChar({ race: { name: "Vellari", source: "OTHER" } }), catalogs);
  assert.ok(names(sheet.tools).includes("Lantern Kit"), "a race of the same name from another source falls back to the name");
  const none = proficiencySheet(makeChar({ race: { name: "Unknown Folk", source: "PHB" } }), catalogs);
  assert.deepEqual(names(none.tools), []);
});
