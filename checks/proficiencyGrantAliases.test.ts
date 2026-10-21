import test from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import type { ProficiencyGrant } from "../src/types/dnd5e.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { proficiencySheet, type SheetEntry } from "../src/rules/proficiencySheet.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
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
  const migrated = reconcile(saved, compendium());
  assert.deepEqual(migrated.proficiencyPicks, { [NEW]: ["Elvish"] });
  assert.ok(languageNames(proficiencySheet(migrated, { compendium: compendium() }).languages).includes("Elvish"), "the sheet shows the pick");
});

test("reconciling a migrated character again changes nothing, and the same object comes back", () => {
  const migrated = reconcile(held({ proficiencyPicks: { [FORMER]: ["Elvish"] } }), compendium());
  assert.deepEqual(reconcile(migrated, compendium()), migrated);
  assert.equal(reconcileForActiveBooks(migrated, compendium(), []), migrated);
});

test("a former id and the grant's id holding the same pick merge into one pick under the grant's id", () => {
  const both = held({ proficiencyPicks: { [FORMER]: ["Elvish"], [NEW]: ["Elvish"] } });
  assert.deepEqual(reconcile(both, compendium()).proficiencyPicks, { [NEW]: ["Elvish"] });
});

test("an old Integrated Catalog with only position ids still resolves a pick saved under them", () => {
  const oldCatalog = inMemoryCompendium({
    classes: [wardenClass({ features: [featureWith({ ...loreGrant, id: FORMER, aliases: undefined })] })],
  });
  const saved = held({ proficiencyPicks: { [FORMER]: ["Elvish"] } });
  const reconciled = reconcile(saved, oldCatalog);
  assert.deepEqual(reconciled.proficiencyPicks, { [FORMER]: ["Elvish"] }, "the old id stays valid");
  assert.ok(languageNames(proficiencySheet(reconciled, { compendium: oldCatalog }).languages).includes("Elvish"), "the sheet shows the pick");
});

test("a former id that no grant in the Compendium carries is kept as saved, not released", () => {
  const saved = held({ proficiencyPicks: { "FIX/Warden/Gone Lore@3#0": ["Elvish"] } });
  assert.deepEqual(reconcile(saved, compendium()).proficiencyPicks, { "FIX/Warden/Gone Lore@3#0": ["Elvish"] });
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
  assert.deepEqual(reconcile(saved, raceCompendium).proficiencyPicks, { [RACE_NEW]: ["Elvish"] });
});

test("a former id of an optional feature that is turned off moves first, then its pick is released with a notice", () => {
  const optionalCompendium = inMemoryCompendium({
    classes: [wardenClass({ features: [featureWith(loreGrant, { isOptional: true })] })],
  });
  const saved = held({ proficiencyPicks: { [FORMER]: ["Elvish"] } });
  const released = reconcile(saved, optionalCompendium);
  assert.equal(released.proficiencyPicks, undefined, "the pick is released, not left under the former id");
  assert.deepEqual(released.needsReview, ["Elvish removed from Lantern Lore: feature is turned off"]);
});
