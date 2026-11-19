import test from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS, DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";
import type { ClassData } from "../src/types/dnd5e.ts";
import type { Character, CharacterClass } from "../src/types/character.ts";
import {
  featuresOf,
  proficiencySheet,
  startingSkillGrantOf,
} from "../src/rules/proficiencySheet.ts";
import { proficiencyChoiceOffers } from "../src/rules/proficiencyChoiceOffers.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { classChoicesStepView } from "../src/rules/classChoices.ts";
import { removeClassLevel } from "../src/rules/builderTransitions.ts";
import { catalogListings } from "../src/rules/catalogs.ts";
import { srdBaselineCompendium, makeChar, loadSrdCatalog, integratedTestCompendium } from "./testUtils.ts";

// The starting skill choice is a Proficiency Choice on the first class's Starting Proficiencies feature (ADR 0015).
// The SRD Baseline's classes carry the source "SRD".

const compendium = () => srdBaselineCompendium();
const catalogs = () => ({ compendium: compendium(), activeBooks: ALL_BOOKS });
const srdClass = (name: string): ClassData => loadSrdCatalog<ClassData[]>("classes").find((c) => c.name === name) as ClassData;
const fighterId = "PHB/Fighter/Starting Proficiencies@1#skills:choice:from";
const FIGHTER_SKILLS = ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"];

const fighter: CharacterClass = { className: "Fighter", source: "SRD", level: 1 };
const rogue: CharacterClass = { className: "Rogue", source: "SRD", level: 1 };

const offerOf = (character: Character, id: string) =>
  proficiencyChoiceOffers(character, { compendium: compendium(), activeBooks: ALL_BOOKS }).find((offer) => offer.id === id);

const skillNames = (character: Character) => proficiencySheet(character, catalogs()).skills.map((entry) => entry.name);

test("a class's starting skill grant is a skills choice of its record's count, from the record's pool", () => {
  const grant = startingSkillGrantOf(srdClass("Fighter"));
  assert.equal(grant?.id, fighterId);
  assert.equal(grant?.kind, "choice");
  assert.equal(grant?.category, "skills");
  assert.equal(grant?.count, 2);
  assert.deepEqual(grant?.pool, { kind: "names", names: FIGHTER_SKILLS });
});

test("a starting skill record with no pool is a choice from any skill, with the record's count", () => {
  const anySkills: ClassData = { ...srdClass("Bard"), skillProficiencies: { choose: 3, from: [] } };
  const grant = startingSkillGrantOf(anySkills);
  assert.equal(grant?.id, "PHB/Bard/Starting Proficiencies@1#skills:choice:any");
  assert.equal(grant?.count, 3);
  assert.deepEqual(grant?.pool, { kind: "any" });
});

test("a class record that gives no skill choice gives no starting skill grant", () => {
  assert.equal(startingSkillGrantOf({ ...srdClass("Fighter"), skillProficiencies: { choose: 0, from: [] } }), undefined);
});

test("a level 1 Fighter is offered one starting skill Proficiency Choice of two from the Fighter's eight skills", () => {
  const offer = offerOf(makeChar({ classes: [fighter] }), fighterId);
  assert.ok(offer, "the Fighter's starting skill choice is offered");
  assert.equal(offer.choose, 2);
  assert.equal(offer.level, 1);
  assert.deepEqual(offer.options.map((option) => option.name), FIGHTER_SKILLS);
  assert.equal(proficiencyChoiceOffers(makeChar({ classes: [fighter] }), { compendium: compendium(), activeBooks: ALL_BOOKS }).filter((o) => o.categories?.includes("skills")).length, 1);
});

test("the Fighter's starting skill feature carries the grant even though the Fighter record has no other grants", () => {
  const features = featuresOf(makeChar({ classes: [fighter] }), catalogListings(catalogs()), ALL_BOOKS);
  const starting = features.find((feature) => feature.name === "Starting Proficiencies");
  assert.deepEqual((starting?.grants ?? []).map((grant) => grant.id), [fighterId]);
});

test("the Class Choices step asks for the starting skills: incomplete with one, complete with two", () => {
  let character = makeChar({ classes: [fighter] });
  const offer = offerOf(character, fighterId);
  assert.ok(offer);
  const skillPick = (view: ReturnType<typeof classChoicesStepView>) => view.skillPicks.find((pick) => pick.id === fighterId);
  character = pickRuleChoice(character, offer, "Athletics", compendium(), ALL_BOOKS);
  assert.equal(skillPick(classChoicesStepView(character, catalogs()))?.choose, 2);
  assert.equal(classChoicesStepView(character, catalogs()).skillPicks.every((pick) => (character.proficiencyPicks?.[pick.id] ?? []).length >= pick.choose), false);
  character = pickRuleChoice(character, offer, "Perception", compendium(), ALL_BOOKS);
  assert.equal(classChoicesStepView(character, catalogs()).skillPicks.every((pick) => (character.proficiencyPicks?.[pick.id] ?? []).length >= pick.choose), true);
});

test("picking two starting skills puts both on the sheet, and a third replaces the oldest pick", () => {
  let character = makeChar({ classes: [fighter] });
  const offer = offerOf(character, fighterId);
  assert.ok(offer);
  character = pickRuleChoice(character, offer, "Athletics", compendium(), ALL_BOOKS);
  character = pickRuleChoice(character, offer, "Perception", compendium(), ALL_BOOKS);
  assert.deepEqual(character.proficiencyPicks?.[fighterId], ["Athletics", "Perception"]);
  assert.ok(skillNames(character).includes("Athletics"));
  assert.ok(skillNames(character).includes("Perception"));

  // At the rule level a third pick replaces the oldest; the picker itself refuses it while two are picked.
  character = pickRuleChoice(character, offer, "Survival", compendium(), ALL_BOOKS);
  assert.deepEqual(character.proficiencyPicks?.[fighterId], ["Perception", "Survival"]);
});

test("a legacy first-class skill entry shows on the sheet before reconciling, and is the grant's pick after", () => {
  const legacy = makeChar({
    classes: [fighter],
    chosenSkills: ["Athletics", "Perception"],
    skillChoices: [{ id: "Class: Fighter", origin: "class", choose: 2, from: FIGHTER_SKILLS, picked: ["Athletics", "Perception"] }],
  });
  assert.ok(skillNames(legacy).includes("Athletics"));
  assert.ok(skillNames(legacy).includes("Perception"));

  const moved = reconcile(legacy, compendium(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(moved.proficiencyPicks?.[fighterId], ["Athletics", "Perception"]);
  assert.equal(moved.skillChoices, undefined, "the legacy entry is gone once all its names moved");
  assert.deepEqual(moved.chosenSkills, [], "the moved names leave the skill bucket");
  assert.ok(skillNames(moved).includes("Athletics"));
  assert.ok(skillNames(moved).includes("Perception"));
});

test("a legacy name outside the grant's pool stays in its entry and the skill bucket, where the sheet reads it", () => {
  const legacy = makeChar({
    classes: [fighter],
    chosenSkills: ["Athletics", "Arcana"],
    skillChoices: [{ id: "Class: Fighter", origin: "class", choose: 2, from: FIGHTER_SKILLS, picked: ["Athletics", "Arcana"] }],
  });
  const moved = reconcile(legacy, compendium(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(moved.proficiencyPicks?.[fighterId], ["Athletics"]);
  assert.deepEqual(moved.skillChoices, [{ id: "Class: Fighter", origin: "class", choose: 2, from: FIGHTER_SKILLS, picked: ["Arcana"] }]);
  assert.deepEqual(moved.chosenSkills, ["Arcana"]);
  assert.ok(skillNames(moved).includes("Arcana"), "the sheet keeps reading the name it could not place");
});

test("a migrateCharacter-shaped first-class skill entry moves the same way", () => {
  const legacy = makeChar({
    classes: [fighter],
    chosenSkills: ["Athletics", "Perception"],
    skillChoices: [{ id: "class__Fighter__SRD__skills", origin: "class", choose: 2, from: [], picked: ["Athletics", "Perception"] }],
  });
  const moved = reconcile(legacy, compendium(), { activeBooks: ALL_BOOKS });
  assert.deepEqual(moved.proficiencyPicks?.[fighterId], ["Athletics", "Perception"]);
  assert.equal(moved.skillChoices, undefined);
  assert.deepEqual(moved.chosenSkills, []);
});

test("removing the only Fighter level releases the starting skill pick", () => {
  const picked = makeChar({ classes: [fighter], proficiencyPicks: { [fighterId]: ["Athletics", "Perception"] } });
  const removed = removeClassLevel(picked, "Fighter", compendium(), ALL_BOOKS);
  assert.equal(removed.proficiencyPicks?.[fighterId], undefined);
  assert.equal(removed.classes.length, 0);
});

test("a Rogue 1 / Fighter 1 offers the Rogue's starting skill choice, and the Fighter's record adds no skill choice", () => {
  const character = makeChar({ classes: [rogue, { className: "Fighter", source: "SRD", level: 1 }] });
  const skillOffers = proficiencyChoiceOffers(character, { compendium: compendium(), activeBooks: ALL_BOOKS }).filter((o) => o.categories?.includes("skills"));
  assert.deepEqual(skillOffers.map((o) => [o.id, o.choose]), [["PHB/Rogue/Starting Proficiencies@1#skills:choice:from", 4]]);
});

test("a starting skill pick made on the SRD Baseline holds once the Integrated Catalog is synced, and back", () => {
  const fighter = makeChar({ classes: [{ className: "Fighter", source: "SRD", level: 1 }], proficiencyPicks: { [fighterId]: ["Athletics", "Perception"] } });
  const skillsWith = (character: Character, compendium: ReturnType<typeof srdBaselineCompendium>) =>
    proficiencySheet(character, { compendium, activeBooks: DEFAULT_ACTIVE_BOOK_CODES }).skills.map((s) => s.name);
  const integrated = integratedTestCompendium();
  const synced = reconcileForActiveBooks(fighter, integrated, [...DEFAULT_ACTIVE_BOOK_CODES]);
  assert.ok(["Athletics", "Perception"].every((name) => skillsWith(synced, integrated).includes(name)));
  const reverted = reconcileForActiveBooks(synced, srdBaselineCompendium(), [...DEFAULT_ACTIVE_BOOK_CODES]);
  assert.ok(["Athletics", "Perception"].every((name) => skillsWith(reverted, srdBaselineCompendium()).includes(name)));
});

test("a starting or multiclass skill pick saved under its SRD-named id moves to the PHB-named id", () => {
  const saved = makeChar({
    classes: [{ className: "Fighter", source: "SRD", level: 1 }, { className: "Rogue", source: "SRD", level: 1 }],
    proficiencyPicks: {
      "SRD/Fighter/Starting Proficiencies@1#skills:choice:from": ["Athletics", "Perception"],
      "SRD/Rogue/Multiclass Proficiencies@1#skills:choice:from": ["Stealth"],
    },
  });
  const moved = reconcile(saved, srdBaselineCompendium(), { activeBooks: DEFAULT_ACTIVE_BOOK_CODES });
  assert.deepEqual(moved.proficiencyPicks, {
    [fighterId]: ["Athletics", "Perception"],
    "PHB/Rogue/Multiclass Proficiencies@1#skills:choice:from": ["Stealth"],
  });
});
