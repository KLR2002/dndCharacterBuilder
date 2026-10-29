import { ORIGIN_CUSTOMIZATION_BOOK } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { changeRace, resetOriginSwaps, setLanguageSwap, setOriginAbilitySwap } from "../src/rules/builderTransitions.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { originCustomizationView } from "../src/rules/originCustomization.ts";
import { languageSwapViews, proficiencySheet , sourceGrants } from "../src/rules/proficiencySheet.ts";
import type { Character } from "../src/types/character.ts";
import type { BackgroundData, OriginRuleRecord, ProficiencyGrant, RaceData } from "../src/types/dnd5e.ts";

// Language swaps: a Race or Subrace fixed language is replaced by another SRD language under Origin Customization.
// Every race, background and grant id here is invented; the language names are the app's own SRD list.

const SOURCE = "TST";
const ACTIVE = [SOURCE, ORIGIN_CUSTOMIZATION_BOOK];
const WITHOUT_TCE = [SOURCE];

const FOLK = "Sample Folk";
const HUMANLIKE = "Sample Humanlike";
const PLAIN = "Sample Plain";
const SCHOLAR = "Sample Scholar";
const FORGE = "Sample Forge";

const fixed = (grantId: string, names: string[]): ProficiencyGrant => ({
  id: grantId,
  kind: "fixed",
  category: "languages",
  names,
});

const FOLK_GRANT = `${SOURCE}/Race/${FOLK}@0#languages:fixed:Common,Elvish`;
const HUMAN_GRANT = `${SOURCE}/Race/${HUMANLIKE}@0#languages:fixed:Common`;
const SCHOLAR_GRANT = `${SOURCE}/Background/${SCHOLAR}@0#languages:fixed:Elvish`;
const FORGE_GRANT = `${SOURCE}/Background/${FORGE}@0#languages:fixed:Dwarvish`;

const ALL_SIX: Record<string, number>[] = [{ str: 1 }, { dex: 1 }, { con: 1 }, { int: 1 }, { wis: 1 }, { cha: 1 }];

const race = (name: string, abilityScoreIncrease: Record<string, number>[], grants: ProficiencyGrant[]): RaceData => ({
  name,
  source: SOURCE,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease,
  darkvision: null,
  traits: [],
  languages: [],
  subraces: [],
  grants,
  description: "Placeholder description for the race.",
});

const background = (name: string, grants: ProficiencyGrant[]): BackgroundData =>
  ({
    name,
    source: SOURCE,
    skillProficiencies: [],
    languageProficiencies: [],
    toolProficiencies: [],
    grants,
    description: "Placeholder description for the background.",
  }) as unknown as BackgroundData;

const records: RaceData[] = [
  race(FOLK, [{ con: 2 }], [fixed(FOLK_GRANT, ["Common", "Elvish"])]),
  race(HUMANLIKE, ALL_SIX, [fixed(HUMAN_GRANT, ["Common"]), { id: `${SOURCE}/Race/${HUMANLIKE}@0#languages:choice:any`, kind: "choice", category: "languages", count: 1, pool: { kind: "any" } }]),
  race(PLAIN, [], [fixed(`${SOURCE}/Race/${PLAIN}@0#languages:fixed:Common`, ["Common"])]),
];
const backgrounds: BackgroundData[] = [
  background(SCHOLAR, [fixed(SCHOLAR_GRANT, ["Elvish"])]),
  background(FORGE, [fixed(FORGE_GRANT, ["Dwarvish"])]),
];

const rule: OriginRuleRecord = {
  name: "Sample Origin Customization",
  source: ORIGIN_CUSTOMIZATION_BOOK,
  proficiencySwaps: [{ from: "skill", to: ["skill"] }],
};

const compendium = inMemoryCompendium({ races: records, backgrounds, originRules: [rule] }, { integrated: true });
const catalogs = { compendium, activeBooks: ACTIVE };

/** A character holding the named race, with its ability increases applied by the ancestry transition. */
function holding(name: string, overrides: Partial<Character> = {}): Character {
  const raceRecord = records.find((r) => r.name === name)!;
  return applyAncestrySelection(makeChar(overrides), raceRecord, undefined, catalogs);
}

/** The swap row of the held race whose original is the given language. */
function rowOf(character: Character, original: string) {
  const row = languageSwapViews(character, catalogs).find((view) => view.original === original);
  assert.ok(row, `a swap row for ${original}`);
  return row;
}

test("a replacement lands on the sheet and the original leaves it", () => {
  const folk = holding(FOLK);
  const swapped = setLanguageSwap(folk, rowOf(folk, "Elvish").id, "Dwarvish", catalogs);

  const languages = proficiencySheet(swapped, catalogs).languages.map((entry) => entry.name);
  assert.ok(languages.includes("Dwarvish"));
  assert.ok(!languages.includes("Elvish"));
  assert.ok(languages.includes("Common"));
});

test("a Standard-Human-like race swaps its only language, and no Common fallback comes back", () => {
  const human = holding(HUMANLIKE);
  const swapped = setLanguageSwap(human, rowOf(human, "Common").id, "Dwarvish", catalogs);

  assert.deepEqual(proficiencySheet(swapped, catalogs).languages.map((entry) => entry.name), ["Dwarvish"]);
});

test("the pool excludes languages the character holds and the replacements of other swaps", () => {
  const folk = holding(FOLK);
  const commonSwapped = setLanguageSwap(folk, rowOf(folk, "Common").id, "Dwarvish", catalogs);

  const elvish = rowOf(commonSwapped, "Elvish");
  assert.ok(!elvish.options.includes("Dwarvish"), "another swap's replacement is excluded");
  assert.ok(!elvish.options.includes("Common"), "a language the race grants is excluded");
  assert.ok(!elvish.options.includes("Elvish"), "the original is excluded");
  assert.ok(elvish.options.includes("Gnomish"));

  assert.equal(setLanguageSwap(commonSwapped, elvish.id, "Dwarvish", catalogs), commonSwapped);
});

test("an 'any' language choice offers no swap", () => {
  const human = holding(HUMANLIKE);
  assert.deepEqual(languageSwapViews(human, catalogs).map((row) => row.original), ["Common"]);
});

test("a background that grants the same language is untouched, and no swap is offered on it", () => {
  const folk = holding(FOLK, { background: { name: SCHOLAR, source: SOURCE } });
  const swapped = setLanguageSwap(folk, rowOf(folk, "Elvish").id, "Dwarvish", catalogs);

  const languages = proficiencySheet(swapped, catalogs).languages.map((entry) => entry.name);
  assert.ok(languages.includes("Elvish"), "the background still grants Elvish");

  assert.deepEqual(languageSwapViews(folk, catalogs).map((row) => row.original), ["Common", "Elvish"]);
  const scholarRow = `${SCHOLAR_GRANT}#swap:Elvish`;
  assert.equal(setLanguageSwap(folk, scholarRow, "Dwarvish", catalogs), folk);
});

test("with TCE off the saved swap is kept, and the sheet shows the original", () => {
  const folk = holding(FOLK);
  const swapped = setLanguageSwap(folk, rowOf(folk, "Elvish").id, "Dwarvish", catalogs);

  const off = reconcileForActiveBooks(swapped, compendium, WITHOUT_TCE);
  assert.deepEqual(off.proficiencyPicks, swapped.proficiencyPicks);
  const offLanguages = proficiencySheet(off, { compendium, activeBooks: WITHOUT_TCE }).languages.map((entry) => entry.name);
  assert.ok(offLanguages.includes("Elvish"));
  assert.ok(!offLanguages.includes("Dwarvish"));

  const back = reconcileForActiveBooks(off, compendium, ACTIVE);
  assert.deepEqual(back.proficiencyPicks, swapped.proficiencyPicks);
});

test("a race change releases the swap with a notice", () => {
  const folk = holding(FOLK);
  const swapped = setLanguageSwap(folk, rowOf(folk, "Common").id, "Dwarvish", catalogs);

  const changed = changeRace(swapped, compendium, ACTIVE);
  assert.equal(changed.proficiencyPicks, undefined);
  assert.deepEqual(changed.needsReview, ["Language swap to Dwarvish removed: ancestry no longer grants Common"]);
});

test("a replacement another source now grants is dropped with a notice", () => {
  const folk = holding(FOLK);
  const swapped = setLanguageSwap(folk, rowOf(folk, "Common").id, "Dwarvish", catalogs);

  const forged = reconcile({ ...swapped, background: { name: FORGE, source: SOURCE } }, compendium, { activeBooks: ACTIVE });
  assert.equal(forged.proficiencyPicks, undefined);
  assert.deepEqual(forged.needsReview, ["Language swap to Dwarvish removed: Dwarvish is no longer available"]);
  assert.ok(proficiencySheet(forged, catalogs).languages.map((entry) => entry.name).includes("Common"));
});

test("a swap equal to its default is not stored, and tapping the selected replacement returns the default", () => {
  const folk = holding(FOLK);
  const elvish = rowOf(folk, "Elvish");
  assert.equal(setLanguageSwap(folk, elvish.id, "Elvish", catalogs).proficiencyPicks, undefined);

  const swapped = setLanguageSwap(folk, elvish.id, "Dwarvish", catalogs);
  assert.deepEqual(swapped.proficiencyPicks, { [elvish.id]: ["Dwarvish"] });
  assert.equal(setLanguageSwap(swapped, elvish.id, "Dwarvish", catalogs).proficiencyPicks, undefined);
  assert.equal(setLanguageSwap(swapped, elvish.id, "Elvish", catalogs).proficiencyPicks, undefined);
});

test("reconciling a swapped character again changes nothing", () => {
  const folk = holding(FOLK);
  const once = reconcile(setLanguageSwap(folk, rowOf(folk, "Elvish").id, "Dwarvish", catalogs), compendium, { activeBooks: ACTIVE });
  assert.deepEqual(reconcile(once, compendium, { activeBooks: ACTIVE }), once);
});

test("the Proficiency Choice offers never list a swap", () => {
  const folk = holding(FOLK);
  const swapped = setLanguageSwap(folk, rowOf(folk, "Elvish").id, "Dwarvish", catalogs);
  const offers = proficiencyChoiceOffers(swapped, { compendium, activeBooks: ACTIVE });
  assert.ok(offers.every((offer) => !offer.id.includes("#swap:")));
});

test("Granted Languages lists the replacement in place of the original", () => {
  const folk = holding(FOLK);
  const swapped = setLanguageSwap(folk, rowOf(folk, "Elvish").id, "Dwarvish", catalogs);
  const granted = sourceGrants(swapped, catalogs).race.languages;
  assert.ok(granted.includes("Dwarvish"));
  assert.ok(!granted.includes("Elvish"));
});

test("with TCE off no swap is applied, and the transition leaves the character as it is", () => {
  const folk = holding(FOLK);
  assert.equal(setLanguageSwap(folk, rowOf(folk, "Elvish").id, "Dwarvish", { compendium, activeBooks: WITHOUT_TCE }), folk);
});

// A subrace that repeats its race's fixed languages (High-Elf-like), and one that repeats some and adds one (Duergar-like).
const ELF = "Sample Elf";
const HIGH = "Sample High";
const STOUT = "Sample Stout";
const DEEP = "Sample Deep";

const subrace = (name: string, raceName: string, grants: ProficiencyGrant[]) => ({
  name,
  source: SOURCE,
  raceName,
  raceSource: SOURCE,
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  grants,
  description: "Placeholder description for the subrace.",
});

const ELF_GRANT = `${SOURCE}/Race/${ELF}@0#languages:fixed:Common,Elvish`;
const HIGH_GRANT = `${SOURCE}/Subrace/${HIGH}@0#languages:fixed:Common,Elvish`;
const STOUT_GRANT = `${SOURCE}/Race/${STOUT}@0#languages:fixed:Common,Dwarvish`;
const DEEP_GRANT = `${SOURCE}/Subrace/${DEEP}@0#languages:fixed:Common,Dwarvish,Undercommon`;

const repeatedRecords: RaceData[] = [
  { ...race(ELF, [{ dex: 2 }], [fixed(ELF_GRANT, ["Common", "Elvish"])]), subraces: [subrace(HIGH, ELF, [fixed(HIGH_GRANT, ["Common", "Elvish"])])] },
  { ...race(STOUT, [{ con: 2 }], [fixed(STOUT_GRANT, ["Common", "Dwarvish"])]), subraces: [subrace(DEEP, STOUT, [fixed(DEEP_GRANT, ["Common", "Dwarvish", "Undercommon"])])] },
];
const repeatedCompendium = inMemoryCompendium({ races: repeatedRecords, backgrounds: [], originRules: [rule] }, { integrated: true });
const repeatedCatalogs = { compendium: repeatedCompendium, activeBooks: ACTIVE };

/** A character holding a race and one of its subraces, with the ancestry transition applied. */
function holdingSubrace(raceName: string, subraceName: string): Character {
  const raceRecord = repeatedRecords.find((r) => r.name === raceName)!;
  const subraceRecord = raceRecord.subraces.find((s) => s.name === subraceName)!;
  return applyAncestrySelection(makeChar(), raceRecord, subraceRecord, repeatedCatalogs);
}

/** The swap rows of a character on the repeated-language catalog. */
function repeatedRows(character: Character) {
  return languageSwapViews(character, repeatedCatalogs);
}

test("a subrace that repeats its race's languages gives one row per distinct language", () => {
  const high = holdingSubrace(ELF, HIGH);
  const rows = repeatedRows(high);
  assert.deepEqual(rows.map((row) => row.original), ["Common", "Elvish"]);
  assert.equal(rows.find((row) => row.original === "Common")!.id, `${ELF_GRANT}#swap:Common`, "the first grant names the swap");
});

test("swapping a repeated language removes it from the sheet entirely, and sourceGrants shows the replacement once", () => {
  const high = holdingSubrace(ELF, HIGH);
  const swapped = setLanguageSwap(high, repeatedRows(high).find((row) => row.original === "Common")!.id, "Dwarvish", repeatedCatalogs);

  const names = proficiencySheet(swapped, repeatedCatalogs).languages.map((entry) => entry.name);
  assert.equal(names.filter((name) => name === "Common").length, 0, "Common leaves the sheet");
  assert.equal(names.filter((name) => name === "Dwarvish").length, 1, "Dwarvish is on the sheet once");
  assert.ok(names.includes("Elvish"));

  const granted = sourceGrants(swapped, repeatedCatalogs).race.languages;
  assert.equal(granted.filter((name) => name === "Dwarvish").length, 1);
  assert.ok(!granted.includes("Common"));
});

test("swapping back to the original restores the language, and reconciling again changes nothing", () => {
  const high = holdingSubrace(ELF, HIGH);
  const common = repeatedRows(high).find((row) => row.original === "Common")!.id;
  const swapped = setLanguageSwap(high, common, "Dwarvish", repeatedCatalogs);
  const restored = setLanguageSwap(swapped, common, "Common", repeatedCatalogs);

  assert.equal(restored.proficiencyPicks, undefined);
  assert.ok(proficiencySheet(restored, repeatedCatalogs).languages.map((entry) => entry.name).includes("Common"));
  const once = reconcile(swapped, repeatedCompendium, { activeBooks: ACTIVE });
  assert.deepEqual(reconcile(once, repeatedCompendium, { activeBooks: ACTIVE }), once);
});

test("a Duergar-like subrace that repeats and adds one gives one row per distinct language, and swapping the added one leaves the others", () => {
  const deep = holdingSubrace(STOUT, DEEP);
  assert.deepEqual(repeatedRows(deep).map((row) => row.original), ["Common", "Dwarvish", "Undercommon"]);

  const undercommon = repeatedRows(deep).find((row) => row.original === "Undercommon")!.id;
  const swapped = setLanguageSwap(deep, undercommon, "Elvish", repeatedCatalogs);
  const names = proficiencySheet(swapped, repeatedCatalogs).languages.map((entry) => entry.name);
  assert.ok(!names.includes("Undercommon"));
  assert.ok(names.includes("Common") && names.includes("Dwarvish") && names.includes("Elvish"));
});

test("a saved swap on a subrace-only language is released with a notice when the subrace changes", () => {
  const deep = holdingSubrace(STOUT, DEEP);
  const undercommon = repeatedRows(deep).find((row) => row.original === "Undercommon")!.id;
  const swapped = setLanguageSwap(deep, undercommon, "Elvish", repeatedCatalogs);

  const withoutSubrace = applyAncestrySelection(swapped, repeatedRecords.find((r) => r.name === STOUT)!, undefined, repeatedCatalogs);
  assert.equal(withoutSubrace.proficiencyPicks, undefined);
  assert.deepEqual(withoutSubrace.needsReview, ["Language swap to Elvish removed: ancestry no longer grants Undercommon"]);
});

test("Reset returns the ability and the language swaps to their defaults together", () => {
  const folk = holding(FOLK);
  const increase = originCustomizationView(folk, catalogs)!.abilitySlots[0];
  const moved = setOriginAbilitySwap(folk, increase.id, "dex", catalogs);
  const swapped = setLanguageSwap(moved, rowOf(moved, "Elvish").id, "Dwarvish", catalogs);
  assert.ok(swapped.originAbilitySwaps && swapped.proficiencyPicks, "both swaps are saved before Reset");

  const reset = resetOriginSwaps(swapped, catalogs);
  assert.equal(reset.originAbilitySwaps, undefined);
  assert.equal(reset.proficiencyPicks, undefined);
  assert.deepEqual(reset.racialAbilityBonuses, { con: 2 });
  assert.deepEqual(reconcile(reset, compendium, { activeBooks: ACTIVE }), reset);
});

test("a held race missing from the catalog keeps its saved language swap until the race is found again", () => {
  const folk = holding(FOLK);
  const swapped = setLanguageSwap(folk, rowOf(folk, "Elvish").id, "Dwarvish", catalogs);
  const withoutFolk = inMemoryCompendium({ races: records.filter((r) => r.name !== FOLK), backgrounds, originRules: [rule] }, { integrated: true });

  const absent = reconcile(swapped, withoutFolk, { activeBooks: ACTIVE });
  assert.deepEqual(absent.proficiencyPicks, swapped.proficiencyPicks);
  assert.deepEqual(absent.needsReview, undefined);

  const back = reconcile(absent, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(back.proficiencyPicks, swapped.proficiencyPicks);
});
