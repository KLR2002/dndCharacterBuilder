import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import {
  addAddedProficiency,
  addedProficiencyOptions,
  removeAddedProficiency,
} from "../src/rules/addedProficiencies.ts";
import { ALL_LANGUAGE_NAMES, ALL_TOOLS } from "../src/rules/proficienciesAndLanguages.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { lamplighterBackground, vellariRace } from "./proficiencySheetFixture.ts";

const names = (entries: SheetEntry[]) => entries.map((entry) => entry.name);

const fixtureCatalogs = () => ({
  compendium: inMemoryCompendium({ races: [vellariRace()], backgrounds: [lamplighterBackground()] }), activeBooks: ALL_BOOKS,
});

// Race Vellari gives Common and Quoral; background Lamplighter gives a Lantern Kit.
const heldCharacter = (overrides = {}) =>
  makeChar({
    race: { name: "Vellari", source: "PHB" },
    background: { name: "Lamplighter", source: "PHB" },
    ...overrides,
  });

// --- The Proficiency Sheet shows added entries ---

test("an added tool and an added language appear on the sheet, not rule-granted, after the rule entries", () => {
  const sheet = proficiencySheet(
    heldCharacter({ addedTools: ["Smith's Tools"], addedLanguages: ["Elvish"] }),
    fixtureCatalogs(),
  );
  assert.deepEqual(names(sheet.tools), ["Lantern Kit", "Smith's Tools"]);
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral", "Elvish"]);
  assert.deepEqual(
    sheet.tools.map((entry) => entry.ruleGranted),
    [true, false],
  );
  assert.deepEqual(
    sheet.languages.map((entry) => entry.ruleGranted),
    [true, true, false],
  );
});

test("known added names take their known spelling, custom names are kept as typed and trimmed", () => {
  const sheet = proficiencySheet(
    makeChar({ addedTools: ["  smith's tools "], addedLanguages: ["  Ancient Vellari Script "] }),
    { compendium: inMemoryCompendium(), activeBooks: ALL_BOOKS },
  );
  assert.deepEqual(names(sheet.tools), ["Smith's Tools"]);
  assert.deepEqual(names(sheet.languages), ["Common", "Ancient Vellari Script"]);
});

test("an added name that a rule also grants shows once, as rule-granted", () => {
  const sheet = proficiencySheet(
    heldCharacter({ addedTools: ["LANTERN KIT"], addedLanguages: ["quoral"] }),
    fixtureCatalogs(),
  );
  assert.deepEqual(names(sheet.tools), ["Lantern Kit"]);
  assert.deepEqual(names(sheet.languages), ["Common", "Quoral"]);
  assert.ok(sheet.tools[0].ruleGranted);
  assert.ok(sheet.languages.every((entry) => entry.ruleGranted));
});

test("the added entry returns, not rule-granted, when the rule that also grants it goes away", () => {
  const character = heldCharacter({ addedTools: ["Lantern Kit"], addedLanguages: ["Quoral"] });
  const withRule = proficiencySheet(character, fixtureCatalogs());
  assert.ok(withRule.tools[0].ruleGranted);

  const ruleGone = proficiencySheet({ ...character, background: null }, fixtureCatalogs());
  assert.deepEqual(ruleGone.tools, [{ name: "Lantern Kit", ruleGranted: false }]);
  assert.deepEqual(names(ruleGone.languages), ["Common", "Quoral"]);
  assert.equal(ruleGone.languages[1].ruleGranted, true, "race still grants Quoral");

  const raceGone = proficiencySheet({ ...character, race: null }, fixtureCatalogs());
  assert.deepEqual(raceGone.languages, [
    { name: "Common", ruleGranted: true },
    { name: "Quoral", ruleGranted: false },
  ]);
});

test("a character with no added lists shows the same sheet as before", () => {
  const plain = proficiencySheet(heldCharacter(), fixtureCatalogs());
  const empty = proficiencySheet(heldCharacter({ addedTools: [], addedLanguages: [] }), fixtureCatalogs());
  assert.deepEqual(empty, plain);
});

// --- Adding by hand ---

test("adding a known tool stores its known spelling and the sheet lists it", () => {
  const result = addAddedProficiency(heldCharacter(), fixtureCatalogs(), "tools", "  smith's tools ");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.character.addedTools, ["Smith's Tools"]);
  assert.ok(names(proficiencySheet(result.character, fixtureCatalogs()).tools).includes("Smith's Tools"));
});

test("adding a custom language stores the name as typed, trimmed", () => {
  const result = addAddedProficiency(heldCharacter(), fixtureCatalogs(), "languages", "  Vellari Runes ");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.character.addedLanguages, ["Vellari Runes"]);
});

test("adding an empty or blank name is rejected", () => {
  for (const raw of ["", "   "]) {
    const result = addAddedProficiency(heldCharacter(), fixtureCatalogs(), "languages", raw);
    assert.deepEqual(result, { ok: false, reason: "empty" });
  }
});

test("adding something already held is rejected, whether rule-granted or added", () => {
  const character = heldCharacter({ addedTools: ["Smith's Tools"] });
  assert.deepEqual(addAddedProficiency(character, fixtureCatalogs(), "tools", "lantern kit"), {
    ok: false,
    reason: "held",
  });
  assert.deepEqual(addAddedProficiency(character, fixtureCatalogs(), "tools", "SMITH'S TOOLS"), {
    ok: false,
    reason: "held",
  });
  assert.deepEqual(addAddedProficiency(character, fixtureCatalogs(), "languages", "common"), {
    ok: false,
    reason: "held",
  });
});

test("a rejected add leaves the stored lists as they were", () => {
  const character = heldCharacter({ addedLanguages: ["Vellari Runes"] });
  const result = addAddedProficiency(character, fixtureCatalogs(), "languages", "Quoral");
  assert.equal(result.ok, false);
});

// --- Removing by hand ---

test("removing an added entry drops it from the stored list, matched case-insensitively", () => {
  const character = heldCharacter({ addedTools: ["Smith's Tools", "Dice Set"] });
  const after = removeAddedProficiency(character, "tools", "SMITH'S TOOLS");
  assert.deepEqual(after.addedTools, ["Dice Set"]);
});

test("removing a rule-granted name changes nothing: rule-granted entries cannot be removed", () => {
  const character = heldCharacter({ addedTools: ["Smith's Tools"] });
  const after = removeAddedProficiency(character, "tools", "Lantern Kit");
  assert.deepEqual(after.addedTools, ["Smith's Tools"]);
  assert.ok(names(proficiencySheet(after, fixtureCatalogs()).tools).includes("Lantern Kit"));
});

// --- Picker options ---

test("tool options are every known tool minus what the sheet already holds", () => {
  const options = addedProficiencyOptions(
    heldCharacter({ addedTools: ["Smith's Tools"] }),
    fixtureCatalogs(),
    "tools",
  );
  assert.ok(!options.includes("Smith's Tools"));
  assert.ok(options.includes("Dice Set"));
  assert.equal(options.length, ALL_TOOLS.length - 1);
});

test("language options are every known language minus what the sheet already holds", () => {
  const options = addedProficiencyOptions(heldCharacter(), fixtureCatalogs(), "languages");
  assert.ok(!options.includes("Common"));
  assert.ok(!options.includes("Quoral"), "Quoral is not a known language, so nothing to subtract");
  assert.equal(options.length, ALL_LANGUAGE_NAMES.length - 1);
});
