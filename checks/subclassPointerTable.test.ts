import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Character } from "../src/types/character.ts";
import { subclassRuleChoices } from "../src/rules/ruleChoices.ts";
import { SUBCLASS_CHOICE_ROWS, type SubclassChoiceRow } from "../src/rules/subclassChoiceTable.ts";
import { resolveOptionName } from "../src/rules/choices/types.ts";
import { createCompendium, type Compendium } from "../src/services/compendium.ts";
import { choiceCatalogBundle } from "./choiceCatalogFixture.ts";
import { makeChar } from "./testUtils.ts";

/**
 * Guards for the pointer table. The table holds identity and locators only, so its options come
 * from the catalog. These tests run the table against the fixture catalog (invented text, real
 * names and structure) and the recorded characterization baseline, which is never re-recorded here.
 */

/** The sixteen ids the table held before the pointer conversion. Persisted, so frozen. */
const FROZEN_IDS = [
  "PHB__Druid__Circle of the Land__Biome",
  "XGE__Sorcerer__Divine Soul__Affinity",
  "TCE__Warlock__The Genie__Kind",
  "PHB__Cleric__Nature Domain__Acolyte of Nature",
  "DMG__Cleric__Death Domain__Reaper",
  "SCAG__Cleric__Arcana Domain__Arcane Initiate",
  "PHB__Monk__Way of the Four Elements__Discipline 3",
  "PHB__Monk__Way of the Four Elements__Discipline 6",
  "PHB__Monk__Way of the Four Elements__Discipline 11",
  "PHB__Monk__Way of the Four Elements__Discipline 17",
  "TCE__Barbarian__Primal Knowledge 3",
  "TCE__Barbarian__Primal Knowledge 10",
  "BGG__Barbarian__Path of the Giant__Giant Power",
  "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3",
  "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6",
  "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14",
] as const;

const BASELINE_PATH = new URL("./fixtures/subclassChoiceBaseline.json", import.meta.url);

interface BaselineEntry {
  id: string;
  choose: number;
  options: string[];
}

const recordedEntries = (id: string): BaselineEntry[] => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as { choices: Record<string, BaselineEntry> };
  return Object.values(baseline.choices).filter((entry) => entry.id === id);
};

const fixtureCompendium = (): Compendium => createCompendium(choiceCatalogBundle());

const rowFor = (id: string): SubclassChoiceRow => {
  const row = SUBCLASS_CHOICE_ROWS.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`${id} is a row of the table`);
  return row;
};

/**
 * A character that owns the row: its class at the row's level, the owner's subclass as the fixture
 * names it (or the row's fragment, when the fixture holds no such class), and the optional feature
 * the row needs. A row with no subclass owner is a class row.
 */
function ownerOf(row: SubclassChoiceRow, compendium: Compendium): Character {
  const fragment = row.owner.subclass?.replace(/\s+/g, "").toLowerCase();
  const cls = compendium.for().classes().find((c) => c.name === row.owner.className);
  const subclassName = fragment
    ? (cls?.subclasses.find((sc) => sc.name.replace(/\s+/g, "").toLowerCase().includes(fragment))?.name ?? row.owner.subclass)
    : undefined;
  return makeChar({
    classes: [{ className: row.owner.className, source: "PHB", level: row.level, ...(subclassName ? { subclassName } : {}) }],
    ...(row.requiresOptionalFeature ? { optionalFeatureReplacements: { [row.requiresOptionalFeature]: true } } : {}),
  });
}

/** The offer the fixture catalog makes the row's owner at the row's level, or undefined when none. */
function offerFor(id: string) {
  const compendium = fixtureCompendium();
  const row = rowFor(id);
  return subclassRuleChoices(ownerOf(row, compendium), undefined, compendium).find((choice) => choice.id === id);
}

/** The fixture offer for a frozen id, which the test fails on when absent. */
function requiredOffer(id: string) {
  const offer = offerFor(id);
  if (!offer) throw new Error(`${id} is offered by the fixture catalog`);
  return offer;
}

test("every frozen id is a row of the table, and the table holds no other row", () => {
  const ids = SUBCLASS_CHOICE_ROWS.map((row) => row.id);
  assert.deepEqual([...ids].sort(), [...FROZEN_IDS].sort());
});

test("every frozen id is offered by the fixture catalog to a character that owns it", () => {
  for (const id of FROZEN_IDS) {
    assert.ok(offerFor(id), `${id} is offered by the fixture catalog`);
  }
});

test("every option name the characterization baseline records for a frozen id resolves against the offered options", () => {
  for (const id of FROZEN_IDS) {
    const offered = requiredOffer(id).options.map((o) => o.name);
    for (const entry of recordedEntries(id)) {
      for (const name of entry.options) {
        assert.notEqual(
          resolveOptionName(name, offered),
          undefined,
          `${id}: the recorded option "${name}" resolves to an offered option, directly or by alias`,
        );
      }
    }
  }
});

test("every frozen id offers the pick count the characterization baseline records", () => {
  for (const id of FROZEN_IDS) {
    const offer = requiredOffer(id);
    for (const entry of recordedEntries(id)) {
      assert.equal(offer.choose, entry.choose, `${id} picks ${entry.choose}`);
    }
  }
});

test("no row carries description text: a row has no options or description field", () => {
  for (const row of SUBCLASS_CHOICE_ROWS) {
    assert.equal("options" in row, false, `${row.id} has no options field`);
    assert.equal("description" in row, false, `${row.id} has no description field`);
  }
});

// Compile-time half of the same contract. Every member of the row union must lack an option or
// description key. `keyof` alone would give only the keys the members share, so it is distributed.
// `tsc` does not check `checks/`, so this is verified by a one-off compile of this file.
type Expect<T extends true> = T;
type KeysOf<T> = T extends unknown ? keyof T : never;
type RowHasNoTextKey = [Extract<KeysOf<SubclassChoiceRow>, "options" | "description">] extends [never] ? true : false;
export type RowTypeHasNoTextKey = Expect<RowHasNoTextKey>;
