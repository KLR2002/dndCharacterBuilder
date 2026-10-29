import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import type { ProficiencyGrant } from "../src/types/dnd5e.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar } from "./testUtils.ts";
import { vellariRace, wardenClass } from "./proficiencySheetFixture.ts";

// Every class, feature, race, grant and name in this file is invented.
//
// A grant's id is derived from what it is, and the grant carries the position-based id it had before as an
// alias. A saved pick under that former id moves to the grant's id when the character is reconciled.

const FORMER = "FIX/Warden/Lantern Lore@3#0";
const NEW = "FIX/Warden/Lantern Lore@3#languages:choice:any";
const RACE_FORMER = "FIX/Race/Vellari@0#1";
const RACE_NEW = "FIX/Race/Vellari@0#languages:choice:any";

const loreGrant: ProficiencyGrant = {
  id: NEW,
  aliases: [FORMER],
  kind: "choice",
  category: "languages",
  count: 1,
  pool: { kind: "any" },
};

function featureWith(grant: ProficiencyGrant, overrides: { isOptional?: boolean } = {}) {
  return { name: "Lantern Lore", level: 3, description: "Placeholder description.", grants: [grant], ...overrides };
}

const compendium = () => inMemoryCompendium({ classes: [wardenClass({ features: [featureWith(loreGrant)] })] });
const held = (extra: Partial<Character> = {}) =>
  makeChar({ classes: [{ className: "Warden", source: "PHB", level: 3 }], ...extra });

const languageNames = (entries: SheetEntry[]) => entries.map((entry) => entry.name).sort();

test("a pick saved under a grant's former id moves to the grant's id on reconcile, and the sheet shows it", () => {
  const saved = held({ proficiencyPicks: { [FORMER]: ["Elvish"] } });
  const migrated = reconcile(saved, compendium(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(migrated.proficiencyPicks, { [NEW]: ["Elvish"] });
  assert.ok(languageNames(proficiencySheet(migrated, { compendium: compendium(), activeBooks: ALL_BOOKS }).languages).includes("Elvish"), "the sheet shows the pick");
});

test("reconciling a migrated character again changes nothing, and the same object comes back", () => {
  const migrated = reconcile(held({ proficiencyPicks: { [FORMER]: ["Elvish"] } }), compendium(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(reconcile(migrated, compendium(), { activeBooks: ALL_BOOKS }), migrated);
  assert.equal(reconcileForActiveBooks(migrated, compendium(), []), migrated);
});

test("a former id and the grant's id holding the same pick merge into one pick under the grant's id", () => {
  const both = held({ proficiencyPicks: { [FORMER]: ["Elvish"], [NEW]: ["Elvish"] } });
  assert.deepEqual(reconcile(both, compendium(), { activeBooks: ALL_BOOKS }).proficiencyPicks, { [NEW]: ["Elvish"] });
});

test("an old Integrated Catalog with only position ids still resolves a pick saved under them", () => {
  const oldCatalog = inMemoryCompendium({
    classes: [wardenClass({ features: [featureWith({ ...loreGrant, id: FORMER, aliases: undefined })] })],
  });
  const saved = held({ proficiencyPicks: { [FORMER]: ["Elvish"] } });
  const reconciled = reconcile(saved, oldCatalog, { activeBooks: ALL_BOOKS });
  assert.deepEqual(reconciled.proficiencyPicks, { [FORMER]: ["Elvish"] }, "the old id stays valid");
  assert.ok(languageNames(proficiencySheet(reconciled, { compendium: oldCatalog, activeBooks: ALL_BOOKS }).languages).includes("Elvish"), "the sheet shows the pick");
});

test("a pick saved under a new id is kept by a catalog that still has position ids, and counts again with the new catalog", () => {
  const oldCatalog = inMemoryCompendium({
    classes: [wardenClass({ features: [featureWith({ ...loreGrant, id: FORMER, aliases: undefined })] })],
  });
  const saved = held({ proficiencyPicks: { [NEW]: ["Elvish"] } });
  const kept = reconcile(saved, oldCatalog, { activeBooks: ALL_BOOKS });
  assert.deepEqual(kept.proficiencyPicks, { [NEW]: ["Elvish"] }, "the old catalog does not hold the new id, so the pick is kept");
  assert.deepEqual(reconcile(kept, compendium(), { activeBooks: ALL_BOOKS }).proficiencyPicks, { [NEW]: ["Elvish"] }, "the new catalog holds it again");
});

test("a former id that no grant in the Compendium carries is kept as saved, not released", () => {
  const saved = held({ proficiencyPicks: { "FIX/Warden/Gone Lore@3#0": ["Elvish"] } });
  assert.deepEqual(reconcile(saved, compendium(), { activeBooks: ALL_BOOKS }).proficiencyPicks, { "FIX/Warden/Gone Lore@3#0": ["Elvish"] });
});

test("a former id on a race's grant moves to the race grant's id too", () => {
  const raceCompendium = inMemoryCompendium({
    races: [
      vellariRace({
        grants: [
          {
            id: RACE_NEW,
            aliases: [RACE_FORMER],
            kind: "choice",
            category: "languages",
            count: 1,
            pool: { kind: "any" },
          },
        ],
      }),
    ],
  });
  const saved = makeChar({ race: { name: "Vellari", source: "PHB" }, proficiencyPicks: { [RACE_FORMER]: ["Elvish"] } });
  assert.deepEqual(reconcile(saved, raceCompendium, { activeBooks: ALL_BOOKS }).proficiencyPicks, { [RACE_NEW]: ["Elvish"] });
});

test("a former id of an optional feature that is turned off moves first, then its pick is released with a notice", () => {
  const optionalCompendium = inMemoryCompendium({
    classes: [wardenClass({ features: [featureWith(loreGrant, { isOptional: true })] })],
  });
  const saved = held({ proficiencyPicks: { [FORMER]: ["Elvish"] } });
  const released = reconcile(saved, optionalCompendium, { activeBooks: ALL_BOOKS });
  assert.equal(released.proficiencyPicks, undefined, "the pick is released, not left under the former id");
  assert.deepEqual(released.needsReview, ["Elvish removed from Lantern Lore: feature is turned off"]);
});

// A choice's id names its kind, not its pool. The first release named the pool in the id, so a re-scrape that
// changed the options moved the id with no alias and stranded the pick.

const SCRIPT_ID = "FIX/Warden/Lantern Script@3#languages:choice:from";
const SCRIPT_FIRST_RELEASE = "FIX/Warden/Lantern Script@3#languages:choice:from=Tidal,Vellari";
const SCRIPT_FORMER = "FIX/Warden/Lantern Script@3#0";

/** A Lantern Script grant, from a pool of names. Its aliases are its former position id and its first-release id. */
const scriptGrant = (names: string[]): ProficiencyGrant => ({
  id: SCRIPT_ID,
  aliases: [SCRIPT_FORMER, SCRIPT_FIRST_RELEASE],
  kind: "choice",
  category: "languages",
  count: 1,
  pool: { kind: "names", names },
});

const scriptCompendium = (names: string[]) =>
  inMemoryCompendium({
    classes: [
      wardenClass({
        features: [{ name: "Lantern Script", level: 3, description: "Placeholder description for Lantern Script.", grants: [scriptGrant(names)] }],
      }),
    ],
  });

test("a choice's pool changes, an option added or removed, and a saved pick still resolves under the same id", () => {
  for (const pool of [["Tidal", "Vellari"], ["Tidal", "Vellari", "Ember Tongue"], ["Tidal"]]) {
    const catalog = scriptCompendium(pool);
    const reconciled = reconcile(held({ proficiencyPicks: { [SCRIPT_ID]: ["Tidal"] } }), catalog, { activeBooks: ALL_BOOKS });
    assert.deepEqual(reconciled.proficiencyPicks, { [SCRIPT_ID]: ["Tidal"] }, `pool of ${pool.join(", ")} keeps the pick`);
    assert.ok(
      languageNames(proficiencySheet(reconciled, { compendium: catalog, activeBooks: ALL_BOOKS }).languages).includes("Tidal"),
      `pool of ${pool.join(", ")} shows the pick`,
    );
  }
});

test("a pick saved under the choice's first-release id loads under the choice's id", () => {
  const catalog = scriptCompendium(["Tidal", "Vellari"]);
  const migrated = reconcile(held({ proficiencyPicks: { [SCRIPT_FIRST_RELEASE]: ["Vellari"] } }), catalog, { activeBooks: ALL_BOOKS });
  assert.deepEqual(migrated.proficiencyPicks, { [SCRIPT_ID]: ["Vellari"] });
  assert.ok(languageNames(proficiencySheet(migrated, { compendium: catalog, activeBooks: ALL_BOOKS }).languages).includes("Vellari"), "the sheet shows the pick");
  assert.deepEqual(reconcile(migrated, catalog, { activeBooks: ALL_BOOKS }), migrated, "migrating again changes nothing");
});

const KENSEI_FIRST_RELEASE = "XGE/Monk/Way of the Kensei/Path of the Kensei@3#tools:choice:from=calligrapher's supplies,painter's supplies";
const KENSEI_ID = "XGE/Monk/Way of the Kensei/Path of the Kensei@3#tools:choice:from";

test("on the integrated catalog, a Kensei pick saved under its first-release id loads under the choice's id", () => {
  const catalog = integratedTestCompendium();
  const saved = makeChar({
    classes: [{ className: "Monk", source: "PHB", level: 3, subclassName: "Way of the Kensei", subclassSource: "XGE" }],
    proficiencyPicks: { [KENSEI_FIRST_RELEASE]: ["Calligrapher's Supplies"] },
  });
  const migrated = reconcile(saved, catalog, { activeBooks: ALL_BOOKS });
  assert.deepEqual(migrated.proficiencyPicks, { [KENSEI_ID]: ["Calligrapher's Supplies"] });
  assert.ok(
    proficiencySheet(migrated, { compendium: catalog, activeBooks: ALL_BOOKS }).tools.some((entry) => entry.name === "Calligrapher's Supplies"),
    "the sheet shows the pick",
  );
});
