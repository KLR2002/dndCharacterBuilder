import test from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS, DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import { migrateSavedPicks } from "../src/rules/savedPicksMigration.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { proficiencySheet } from "../src/rules/proficiencySheet.ts";
import { integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";

// The migration passes that moved saved shapes no current transition writes run in migrateSavedPicks, on load and
// when reconcileForActiveBooks runs (ADR 0026). reconcile alone leaves them alone.

const compendium = () => srdBaselineCompendium();
const ACTIVE = [...DEFAULT_ACTIVE_BOOK_CODES];
const FIGHTER_ID = "PHB/Fighter/Starting Proficiencies@1#skills:choice:from";
const FIGHTER_SKILLS = ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"];

const fighter: CharacterClass = { className: "Fighter", source: "SRD", level: 1 };
const rogue: CharacterClass = { className: "Rogue", source: "SRD", level: 1 };
const bard: CharacterClass = { className: "Bard", source: "SRD", level: 1 };

/** A Fighter and Rogue, a Dwarf, and an Acolyte, each holding a legacy shape. */
function legacyFighter(): Character {
  return makeChar({
    classes: [fighter, rogue],
    race: { name: "Dwarf", source: "PHB" },
    background: { name: "Acolyte", source: "PHB" },
    chosenSkills: ["Athletics", "Perception"],
    skillChoices: [
      { id: "Class: Fighter", origin: "class", choose: 2, from: FIGHTER_SKILLS, picked: ["Athletics", "Perception"] },
      { id: "multiclass_skill_rogue", origin: "class", choose: 1, from: ["Stealth"], picked: [] },
    ],
    chosenTools: { race: ["Mason's Tools"] },
    chosenLanguages: { background: ["Elvish"] },
  });
}

/** A Half-Elf whose race skill pick was saved before it was a Proficiency Choice. */
function legacyHalfElf(): Character {
  return makeChar({
    classes: [fighter],
    race: { name: "Half-Elf", source: "PHB" },
    skillChoices: [{ id: "race__Half-Elf__PHB__skills", origin: "race", choose: 2, from: [], picked: ["Insight", "Stealth"] }],
    chosenSkills: ["Insight", "Stealth"],
  });
}

test("a character holding the legacy shapes comes out of migrateSavedPicks with each moved, and reconcile leaves it unchanged", () => {
  const migrated = migrateSavedPicks(legacyFighter(), compendium(), ALL_BOOKS);

  assert.deepEqual(migrated.proficiencyPicks?.[FIGHTER_ID], ["Athletics", "Perception"], "the class skill pick moves to the grant");
  assert.equal((migrated.skillChoices ?? []).some((entry) => entry.id === "Class: Fighter"), false, "the legacy class entry is gone");
  assert.equal((migrated.skillChoices ?? []).some((entry) => entry.id.startsWith("multiclass_skill_")), false, "the empty multiclass entry is dropped");
  assert.deepEqual(migrated.chosenTools, undefined, "the race tool bucket moves into the Dwarf's tool choice");
  assert.deepEqual(migrated.proficiencyPicks?.["PHB/Race/Dwarf@0#tools:choice:from"], ["Mason's Tools"]);
  assert.deepEqual(migrated.proficiencyPicks?.["PHB/Background/Acolyte@0#languages:choice:any"], ["Elvish"], "the background language moves into its choice");
  const reconciled = reconcile(migrated, compendium(), { activeBooks: ALL_BOOKS });
  const pickFields = (character: Character) => ({
    proficiencyPicks: character.proficiencyPicks,
    skillChoices: character.skillChoices ?? [],
    chosenSkills: character.chosenSkills,
    chosenTools: character.chosenTools,
    chosenLanguages: character.chosenLanguages,
  });
  assert.deepEqual(pickFields(reconciled), pickFields(migrated), "reconcile then moves none of them");
});

test("a fighting style saved under the id of another source moves to the id the class's saved source gives", () => {
  const saved = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    ruleChoices: [{ id: "SRD__Fighter__Fighting Style", trait: "Fighting Style", origin: "class", choose: 1, from: [], picked: ["Defense"] }],
  });
  const migrated = migrateSavedPicks(saved, compendium(), ALL_BOOKS);
  assert.deepEqual(migrated.ruleChoices?.map((entry) => entry.id), ["PHB__Fighter__Fighting Style"]);
  assert.deepEqual(migrated.ruleChoices?.[0].picked, ["Defense"]);
});

test("migrateSavedPicks is idempotent", () => {
  const once = migrateSavedPicks(legacyFighter(), compendium(), ALL_BOOKS);
  assert.equal(migrateSavedPicks(once, compendium(), ALL_BOOKS), once);
});

test("migrateSavedPicks returns the same object when nothing changes", () => {
  const clean = makeChar({ classes: [fighter], proficiencyPicks: { [FIGHTER_ID]: ["Athletics", "Perception"] } });
  assert.equal(migrateSavedPicks(clean, compendium(), ALL_BOOKS), clean);
});

test("a Half-Elf's race skill pick saved as a legacy entry moves to the race's choice", () => {
  const migrated = migrateSavedPicks(legacyHalfElf(), compendium(), ALL_BOOKS);
  assert.deepEqual(migrated.proficiencyPicks?.["PHB/Race/Half-Elf@0#skills:choice:any"], ["Insight", "Stealth"]);
  assert.deepEqual(migrated.skillChoices ?? [], []);
  assert.deepEqual(migrated.chosenSkills, []);
});

test("a background skill copy that only an inactive background granted is dropped", () => {
  const copy = makeChar({
    classes: [fighter],
    background: { name: "Acolyte", source: "PHB" },
    chosenSkills: ["Insight"],
  });
  // The integrated fixture scopes its records to the active books; the SRD Baseline does not, so only this one turns a book off.
  assert.deepEqual(migrateSavedPicks(copy, integratedTestCompendium(), ["NOPE"]).chosenSkills, [], "the copy is dropped once its book is off");
  assert.deepEqual(migrateSavedPicks(copy, integratedTestCompendium(), ACTIVE).chosenSkills, ["Insight"], "a copy of an active background stays");
});

test("a legacy class tool bucket moves on migrateSavedPicks and reconcileForActiveBooks, but reconcile alone leaves it", () => {
  const legacy = makeChar({ classes: [bard], chosenTools: { class: ["Lute"] } });
  const barded = "PHB/Bard/Starting Proficiencies@1#tools:choice:from";

  assert.deepEqual(reconcile(legacy, compendium(), { activeBooks: ALL_BOOKS }).chosenTools, { class: ["Lute"] }, "reconcile leaves the bucket");
  assert.deepEqual(migrateSavedPicks(legacy, compendium(), ALL_BOOKS).proficiencyPicks?.[barded], ["Lute"]);
  assert.deepEqual(reconcileForActiveBooks(legacy, compendium(), ACTIVE).proficiencyPicks?.[barded], ["Lute"], "a character opened on the catalog moves it");
});

test("a pick saved under a grant alias moves when reconcileForActiveBooks runs, and reconcile alone leaves it", () => {
  const saved = makeChar({
    classes: [fighter],
    proficiencyPicks: { "SRD/Fighter/Starting Proficiencies@1#skills:choice:from": ["Athletics", "Perception"] },
  });
  assert.deepEqual(reconcile(saved, compendium(), { activeBooks: ALL_BOOKS }).proficiencyPicks, saved.proficiencyPicks);
  const opened = reconcileForActiveBooks(saved, compendium(), ACTIVE);
  assert.deepEqual(opened.proficiencyPicks, { [FIGHTER_ID]: ["Athletics", "Perception"] });
  assert.ok(proficiencySheet(opened, { compendium: compendium(), activeBooks: ALL_BOOKS }).skills.some((s) => s.name === "Athletics"));
});
