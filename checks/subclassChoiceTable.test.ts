import { test } from "node:test";
import assert from "node:assert/strict";
import * as subclassChoiceTable from "../src/rules/subclassChoiceTable.ts";
import { SUBCLASS_CHOICE_ROWS, isPointerRow } from "../src/rules/subclassChoiceTable.ts";

/**
 * Row ids are persisted in saved characters. Renaming one orphans its picks, so this list is
 * the frozen contract: a change to it must be deliberate and come with a migration.
 */
test("every shipped subclass and class Rule Choice row keeps its persisted id", () => {
  assert.deepEqual(
    SUBCLASS_CHOICE_ROWS.map((row) => row.id),
    [
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
    ]
  );
});

test("the Land biome, Divine Affinity, Genie Kind and Giant Power rows read their options from the catalog", () => {
  const spellDriven = SUBCLASS_CHOICE_ROWS.filter((row) => isPointerRow(row) && "spellChoice" in row.locator).map((row) => row.id);
  assert.deepEqual(spellDriven, [
    "PHB__Druid__Circle of the Land__Biome",
    "XGE__Sorcerer__Divine Soul__Affinity",
    "TCE__Warlock__The Genie__Kind",
    "BGG__Barbarian__Path of the Giant__Giant Power",
  ]);
});

test("the hand-written option lists for the spell-driven and discipline rows are gone from the table", () => {
  for (const name of [
    "CIRCLE_OF_THE_LAND_BIOMES",
    "DIVINE_SOUL_AFFINITIES",
    "GENIE_KINDS",
    "ELEMENTAL_DISCIPLINES_LVL3",
    "ELEMENTAL_DISCIPLINES_LVL6",
    "ELEMENTAL_DISCIPLINES_LVL11",
    "ELEMENTAL_DISCIPLINES_LVL17",
  ]) {
    assert.equal(name in subclassChoiceTable, false, `${name} is no longer written in the table`);
  }
});
