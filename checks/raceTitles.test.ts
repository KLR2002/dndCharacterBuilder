import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { changeRace } from "../src/rules/builderTransitions.ts";
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

const titlesOf = (character: ReturnType<typeof makeChar>, catalogs = { compendium }): string[] =>
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
  const evaluated = evaluateCharacter(folk, { compendium: inMemoryCompendium({ classes: grantedSpellClasses(), races: prepared, spells: grantedSpellSpells() }) });
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
  const changed = changeRace(folk, inMemoryCompendium({ classes: grantedSpellClasses(), races: expandedFolk, spells: [...grantedSpellSpells(), sampleWard] }));
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
  assert.ok(titlesOf(elf, { compendium: srd }).includes("High Elf"), "the High Elf card is titled High Elf");
  assert.ok(titlesOf(tiefling, { compendium: srd }).includes("Tiefling"), "the Tiefling card is titled Tiefling");
});
