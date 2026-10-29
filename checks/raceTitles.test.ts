import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { changeRace } from "../src/rules/builderTransitions.ts";
import { raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import type { CharacterClass } from "../src/types/character.ts";
import type { RaceData, SpellData, SubraceData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, loadSrdCatalog, makeChar } from "./testUtils.ts";
import { backgroundSpellSpells } from "./backgroundSpellsFixture.ts";
import { grantedSpellClasses, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// The name a race or subrace is shown by: its title on the spell cards, in the class list badge and in the release notices (ADR
// 0017). A subrace reads with the character's race ("Brook Sample Folk") unless its own name already reads as a name. Every race
// name here is invented, except the SRD Baseline cases, which read the shipped SRD records.

const race = (name: string, extra: Partial<RaceData>): RaceData => ({
  name,
  source: "TST",
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
  ...extra,
});

const subrace = (name: string, raceName: string, extra: Partial<SubraceData>): SubraceData => ({
  name,
  source: "TST",
  raceName,
  raceSource: "TST",
  isVariant: false,
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
  ...extra,
});

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

/** A subrace that gives one at-will cantrip with the Intelligence ability. */
const glimmerGrant = [{ ability: "int" as const, innate: { _: ["Sample Glimmer"] } }];

const races = (): RaceData[] => [
  race("Sample Folk", { subraces: [subrace("Brook", "Sample Folk", { additionalSpells: glimmerGrant })] }),
  // Sample Ork lists a subrace of the same name as Sample Human's, so a guess from the catalog would name the wrong race.
  race("Sample Ork", { subraces: [subrace("Sample Mark of Glimmer", "Sample Ork", {})] }),
  race("Sample Human", { subraces: [subrace("Sample Mark of Glimmer", "Sample Human", { additionalSpells: glimmerGrant })] }),
  // Sample Delver is a race of its own; Sample Dwarf lists a subrace of the same name.
  race("Sample Delver", { additionalSpells: glimmerGrant }),
  race("Sample Dwarf", { subraces: [subrace("Sample Delver", "Sample Dwarf", {})] }),
  race("Sample Blooded", {
    subraces: [subrace("Ember Descent", "Sample Blooded", { additionalSpells: glimmerGrant })],
  }),
];

const compendium = inMemoryCompendium({
  classes: grantedSpellClasses(),
  races: races(),
  spells: grantedSpellSpells(),
});

const titlesOf = (character: ReturnType<typeof makeChar>, catalogs = { compendium, activeBooks: ALL_BOOKS }): string[] =>
  evaluateCharacter(character, catalogs).grantedSpellSources.map((source) => source.title);

test("a subrace of one word reads with its race", () => {
  const folk = makeChar({
    classes: [mage(3)],
    race: { name: "Sample Folk", source: "TST", subraceName: "Brook", subraceSource: "TST" },
  });
  assert.deepEqual(titlesOf(folk), ["Brook Sample Folk"]);
});

test("a subrace of several words reads alone, though another race lists a subrace of that name", () => {
  const human = makeChar({
    classes: [mage(3)],
    race: { name: "Sample Human", source: "TST", subraceName: "Sample Mark of Glimmer", subraceSource: "TST" },
  });
  assert.deepEqual(titlesOf(human), ["Sample Mark of Glimmer"]);
});

test("a race of its own reads by its own name, though another race lists a subrace of that name", () => {
  const delver = makeChar({ classes: [mage(3)], race: { name: "Sample Delver", source: "TST" } });
  assert.deepEqual(titlesOf(delver), ["Sample Delver"]);
});

test("a descent subrace of several words reads alone, as a Half-Elf's does", () => {
  const blooded = makeChar({
    classes: [mage(3)],
    race: { name: "Sample Blooded", source: "TST", subraceName: "Ember Descent", subraceSource: "TST" },
  });
  assert.deepEqual(titlesOf(blooded), ["Ember Descent"]);
});

test("the class list badge of a prepared race spell names the race as its card does", () => {
  const prepared = races().map((record) =>
    record.name === "Sample Folk"
      ? { ...record, subraces: [subrace("Brook", "Sample Folk", { additionalSpells: [{ prepared: { _: ["Sample Glimmer"] } }] })] }
      : record,
  );
  const folk = makeChar({
    classes: [mage(3)],
    race: { name: "Sample Folk", source: "TST", subraceName: "Brook", subraceSource: "TST" },
  });
  const evaluated = evaluateCharacter(folk, { compendium: inMemoryCompendium({ classes: grantedSpellClasses(), races: prepared, spells: grantedSpellSpells() }), activeBooks: ALL_BOOKS });
  const badge = evaluated.spellProfiles[0]?.grantedPreparedSources?.["sample glimmer"];
  assert.equal(badge, "Brook Sample Folk");
});

test("a release notice names a race by the title its card shows", () => {
  const sampleWard = backgroundSpellSpells().find((spell) => spell.name === "Sample Ward");
  assert.ok(sampleWard, "the invented spell exists");
  const expandedFolk = races().map((record) =>
    record.name === "Sample Folk"
      ? { ...record, subraces: [subrace("Brook", "Sample Folk", { additionalSpells: [{ expanded: { s1: ["sample ward"] } }] })] }
      : record,
  );
  const folk = makeChar({
    classes: [mage(5)],
    race: { name: "Sample Folk", source: "TST", subraceName: "Brook", subraceSource: "TST" },
    knownSpells: [{ name: "Sample Ward", source: "TST", ownerKey: "Sample Mage__TST", className: "Sample Mage" }],
  });
  const changed = changeRace(folk, inMemoryCompendium({ classes: grantedSpellClasses(), races: expandedFolk, spells: [...grantedSpellSpells(), sampleWard] }), ALL_BOOKS);
  assert.ok(
    changed.needsReview?.includes("Sample Ward removed: only on the Brook Sample Folk race's spell list"),
    `got ${JSON.stringify(changed.needsReview)}`,
  );
});

test("the SRD Baseline's High Elf and Tiefling read as High Elf and Tiefling", () => {
  const srd = inMemoryCompendium({
    classes: loadSrdCatalog("classes"),
    races: loadSrdCatalog("races"),
    spells: loadSrdCatalog("spells"),
  });
  const elf = makeChar({ classes: [mage(1)], race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" } });
  const tiefling = makeChar({ classes: [mage(1)], race: { name: "Tiefling", source: "SRD" } });
  assert.ok(titlesOf(elf, { compendium: srd, activeBooks: ALL_BOOKS }).includes("High Elf"), "the High Elf card is titled High Elf");
  assert.ok(titlesOf(tiefling, { compendium: srd, activeBooks: ALL_BOOKS }).includes("Tiefling"), "the Tiefling card is titled Tiefling");
});

const srdCatalog = () => inMemoryCompendium({ classes: loadSrdCatalog("classes"), races: loadSrdCatalog("races"), spells: loadSrdCatalog("spells") });

test("a High Elf's cantrip pick is titled High Elf Cantrip", () => {
  const elf = makeChar({ classes: [mage(1)], race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" } });
  const pick = raceSpellRuleChoices(elf, srdCatalog(), ALL_BOOKS).find((choice) => choice.options.some((option) => option.name === "Fire Bolt"));
  assert.ok(pick, "the High Elf offers its cantrip pick");
  assert.equal(pick.traitName, "High Elf Cantrip");
  assert.equal(pick.choose, 1);
});

test("a High Elf's cantrip pick keeps the id it was saved under, which names the subrace alone", () => {
  const elf = makeChar({ classes: [mage(1)], race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" } });
  const pick = raceSpellRuleChoices(elf, srdCatalog(), ALL_BOOKS).find((choice) => choice.options.some((option) => option.name === "Fire Bolt"));
  assert.equal(pick?.id, "-__Race Spells__High__-__0");
});

// A Sample Folk subrace of one word picks a cantrip and a casting ability; a Sample Blooded descent of two words picks a cantrip.
const pickingRaces = (): RaceData[] => [
  race("Sample Folk", {
    subraces: [subrace("Brook", "Sample Folk", { additionalSpells: [{ ability: { choose: ["int", "wis"] }, known: { _: [{ choose: "level=0|class=Sample Mage", count: 1 }] } }] })],
  }),
  race("Sample Blooded", {
    subraces: [subrace("Ember Descent", "Sample Blooded", { additionalSpells: [{ known: { _: [{ choose: "level=0|class=Sample Mage", count: 1 }] } }] })],
  }),
];

const pickingCompendium = () => inMemoryCompendium({ classes: grantedSpellClasses(), races: pickingRaces(), spells: grantedSpellSpells() });

test("a one-word subrace's cantrip pick and casting ability read with its race", () => {
  const folk = makeChar({ classes: [mage(3)], race: { name: "Sample Folk", source: "TST", subraceName: "Brook", subraceSource: "TST" } });
  const choices = raceSpellRuleChoices(folk, pickingCompendium(), ALL_BOOKS);
  const cantrip = choices.find((choice) => choice.options.some((option) => option.name === "Sample Shot"));
  const ability = choices.find((choice) => choice.id.endsWith("__Casting Ability"));
  assert.equal(cantrip?.traitName, "Brook Sample Folk Cantrip");
  assert.equal(ability?.traitName, "Brook Sample Folk Casting Ability");
});

test("a descent subrace of several words reads by its own name in its cantrip pick", () => {
  const blooded = makeChar({ classes: [mage(3)], race: { name: "Sample Blooded", source: "TST", subraceName: "Ember Descent", subraceSource: "TST" } });
  const cantrip = raceSpellRuleChoices(blooded, pickingCompendium(), ALL_BOOKS).find((choice) => choice.options.some((option) => option.name === "Sample Shot"));
  assert.equal(cantrip?.traitName, "Ember Descent Cantrip");
});

test("the prepared spell badge of a High Elf reads High Elf", () => {
  const races = loadSrdCatalog("races").map((record: RaceData) =>
    record.name === "Elf"
      ? { ...record, subraces: record.subraces?.map((sub) => ({ ...sub, additionalSpells: [...(sub.additionalSpells ?? []), { prepared: { _: ["Fire Bolt"] } }] })) }
      : record,
  );
  const wizard = makeChar({
    classes: [{ className: "Wizard", source: "SRD", level: 3 }],
    race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" },
  });
  const evaluated = evaluateCharacter(wizard, { compendium: inMemoryCompendium({ classes: loadSrdCatalog("classes"), races, spells: loadSrdCatalog("spells") }), activeBooks: ALL_BOOKS });
  assert.equal(evaluated.spellProfiles[0]?.grantedPreparedSources?.["fire bolt"], "High Elf");
});

test("the prepared spell badge of a descent subrace of several words reads by its own name", () => {
  const prepared = races().map((record) =>
    record.name === "Sample Blooded"
      ? { ...record, subraces: [subrace("Ember Descent", "Sample Blooded", { additionalSpells: [{ prepared: { _: ["Sample Glimmer"] } }] })] }
      : record,
  );
  const blooded = makeChar({ classes: [mage(3)], race: { name: "Sample Blooded", source: "TST", subraceName: "Ember Descent", subraceSource: "TST" } });
  const evaluated = evaluateCharacter(blooded, { compendium: inMemoryCompendium({ classes: grantedSpellClasses(), races: prepared, spells: grantedSpellSpells() }), activeBooks: ALL_BOOKS });
  assert.equal(evaluated.spellProfiles[0]?.grantedPreparedSources?.["sample glimmer"], "Ember Descent");
});
