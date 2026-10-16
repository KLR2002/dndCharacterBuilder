import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";
import {
  clearCompendiumStore,
  isCompendiumIntegrated,
  getRaces,
  getClasses,
  getBackgrounds,
  getFeats,
  getSpells,
  getItems,
  getBeasts,
  getOptionsAndFeatures,
} from "../src/services/dataService.ts";
import { isSpellAvailableForClass } from "../src/rules/spellcasting.ts";
import { resolveAncestryState, applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { maxHp } from "../src/rules/hp.ts";
import { resetTestCompendium, inMemoryCompendium, makeChar } from "./testUtils.ts";

test("srdBaseline: default SRD catalogs are accessible even when activeBooks does not include SRD", async () => {
  clearCompendiumStore();
  assert.equal(isCompendiumIntegrated(), false, "App must be in SRD mode");

  // activeBooks default to expansion books which do not contain 'SRD'
  const activeBooks = [...DEFAULT_ACTIVE_BOOK_CODES];
  assert.equal(activeBooks.includes("SRD"), false);

  const races = getRaces(activeBooks);
  assert.ok(races.length > 0, "Races must not be empty in SRD mode");
  assert.ok(races.some((r) => r.name === "Elf"));

  const classes = getClasses(activeBooks);
  assert.equal(classes.length, 12, "Must return 12 SRD classes");

  const backgrounds = getBackgrounds(activeBooks);
  assert.ok(backgrounds.length > 0, "Backgrounds must not be empty in SRD mode");

  const feats = getFeats(activeBooks);
  assert.ok(feats.length > 0, "Feats must not be empty in SRD mode");

  const spells = getSpells(activeBooks);
  assert.ok(spells.length > 0, "Spells must not be empty in SRD mode");

  const items = getItems(activeBooks);
  assert.ok(items.length > 0, "Items must not be empty in SRD mode");

  const beasts = getBeasts(activeBooks);
  assert.ok(beasts.length > 0, "Beasts must not be empty in SRD mode");

  const options = getOptionsAndFeatures(activeBooks);
  assert.ok(options.length > 0, "Options must not be empty in SRD mode");

  // Check spell availability for class in SRD mode
  const fireball = spells.find((s) => s.name === "Fireball");
  if (fireball) {
    assert.equal(
      isSpellAvailableForClass(fireball, "Wizard", activeBooks),
      true,
      "Fireball must be available for Wizard in SRD mode"
    );
  }

  // Restore test compendium fixture for subsequent tests in process
  resetTestCompendium();
});

test("srdBaseline: Human has +1 to all ability scores and no flexible ASI choice", () => {
  clearCompendiumStore();
  const races = getRaces();
  const human = races.find((r) => r.name === "Human");
  assert.ok(human, "Human race must exist in SRD");
  assert.deepEqual(
    human.abilityScoreIncrease,
    [{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }],
    "Human in SRD must have +1 to all six ability scores"
  );

  const humanChar = makeChar({
    race: { name: "Human", source: "SRD" },
  });
  const state = resolveAncestryState(humanChar, { compendium: inMemoryCompendium({ races }) });
  assert.equal(state.hasFixedASI, true);
  assert.deepEqual(state.fixedBonuses, { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
  assert.equal(state.isChoiceASIRace, false, "Standard Human must not be a choice ASI race");
  assert.equal(state.isFlexibleMPMM, false, "Standard Human must not have flexible MPMM ASI");

  const applied = applyAncestrySelection(makeChar(), human, undefined, { compendium: inMemoryCompendium({ races }) });
  assert.deepEqual(
    applied.racialAbilityBonuses,
    { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    "Applying Human must award +1 to all six ability scores"
  );

  resetTestCompendium();
});

test("srdBaseline: does not contain expansion Lineage races or Custom Lineage", () => {
  clearCompendiumStore();
  const races = getRaces();
  const raceNames = new Set(races.map((r) => r.name));
  assert.equal(raceNames.has("Dhampir"), false);
  assert.equal(raceNames.has("Hexblood"), false);
  assert.equal(raceNames.has("Reborn"), false);
  assert.equal(raceNames.has("Custom Lineage"), false);
  resetTestCompendium();
});

test("srdBaseline: Dwarf, Elf, Gnome, and Halfling have their single SRD subrace with complete ASI and features", () => {
  clearCompendiumStore();
  const races = getRaces();

  // 1. Dwarf -> Hill Dwarf
  const dwarf = races.find((r) => r.name === "Dwarf");
  assert.ok(dwarf, "Dwarf must exist in SRD");
  assert.equal(dwarf.subraces?.length, 1, "Dwarf in SRD must have exactly 1 subrace");
  assert.equal(dwarf.subraces?.[0].name, "Hill", "Dwarf SRD subrace must be Hill Dwarf");
  assert.deepEqual(dwarf.subraces?.[0].abilityScoreIncrease, [{ wis: 1 }]);
  assert.ok(dwarf.subraces?.[0].traits?.some((t) => t.name === "Dwarven Toughness"));

  const appliedDwarf = applyAncestrySelection(makeChar(), dwarf, dwarf.subraces?.[0], { compendium: inMemoryCompendium({ races }) });
  assert.deepEqual(
    appliedDwarf.racialAbilityBonuses,
    { con: 2, wis: 1 },
    "Hill Dwarf in SRD must have +2 CON and +1 WIS"
  );
  assert.equal(appliedDwarf.race?.subraceName, "Hill");
  const dwarfFighter = makeChar({
    race: appliedDwarf.race,
    baseAbilityScores: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", level: 1, source: "SRD" }],
  });
  // Fighter hitDie = 10, CON 14 (+2), Dwarven Toughness (+1) -> maxHp = 13
  assert.equal(maxHp(dwarfFighter), 13, "Hill Dwarf must receive +1 HP per level from Dwarven Toughness");

  // 2. Elf -> High Elf
  const elf = races.find((r) => r.name === "Elf");
  assert.ok(elf, "Elf must exist in SRD");
  assert.equal(elf.subraces?.length, 1, "Elf in SRD must have exactly 1 subrace");
  assert.equal(elf.subraces?.[0].name, "High", "Elf SRD subrace must be High Elf");
  assert.deepEqual(elf.subraces?.[0].abilityScoreIncrease, [{ int: 1 }]);
  assert.ok(elf.subraces?.[0].traits?.some((t) => t.name === "Elf Weapon Training"));
  assert.ok(elf.subraces?.[0].traits?.some((t) => t.name === "Cantrip"));

  const appliedElf = applyAncestrySelection(makeChar(), elf, elf.subraces?.[0], { compendium: inMemoryCompendium({ races }) });
  assert.deepEqual(
    appliedElf.racialAbilityBonuses,
    { dex: 2, int: 1 },
    "High Elf in SRD must have +2 DEX and +1 INT"
  );
  assert.equal(appliedElf.race?.subraceName, "High");
  const elfState = resolveAncestryState(appliedElf, { compendium: inMemoryCompendium({ races }) });
  assert.equal(elfState.hasRacialCantrip, true, "High Elf must have racial wizard cantrip choice");
  assert.equal(elfState.racialCantripTitle, "High Elf Cantrip");

  // 3. Gnome -> Rock Gnome
  const gnome = races.find((r) => r.name === "Gnome");
  assert.ok(gnome, "Gnome must exist in SRD");
  assert.equal(gnome.subraces?.length, 1, "Gnome in SRD must have exactly 1 subrace");
  assert.equal(gnome.subraces?.[0].name, "Rock", "Gnome SRD subrace must be Rock Gnome");
  assert.deepEqual(gnome.subraces?.[0].abilityScoreIncrease, [{ con: 1 }]);
  assert.ok(gnome.subraces?.[0].traits?.some((t) => t.name === "Artificer's Lore"));
  assert.ok(gnome.subraces?.[0].traits?.some((t) => t.name === "Tinker"));

  const appliedGnome = applyAncestrySelection(makeChar(), gnome, gnome.subraces?.[0], { compendium: inMemoryCompendium({ races }) });
  assert.deepEqual(
    appliedGnome.racialAbilityBonuses,
    { int: 2, con: 1 },
    "Rock Gnome in SRD must have +2 INT and +1 CON"
  );
  assert.equal(appliedGnome.race?.subraceName, "Rock");

  // 4. Halfling -> Lightfoot Halfling
  const halfling = races.find((r) => r.name === "Halfling");
  assert.ok(halfling, "Halfling must exist in SRD");
  assert.equal(halfling.subraces?.length, 1, "Halfling in SRD must have exactly 1 subrace");
  assert.equal(halfling.subraces?.[0].name, "Lightfoot", "Halfling SRD subrace must be Lightfoot");
  assert.deepEqual(halfling.subraces?.[0].abilityScoreIncrease, [{ cha: 1 }]);
  assert.ok(halfling.subraces?.[0].traits?.some((t) => t.name === "Naturally Stealthy"));

  const appliedHalfling = applyAncestrySelection(makeChar(), halfling, halfling.subraces?.[0], { compendium: inMemoryCompendium({ races }) });
  assert.deepEqual(
    appliedHalfling.racialAbilityBonuses,
    { dex: 2, cha: 1 },
    "Lightfoot Halfling in SRD must have +2 DEX and +1 CHA"
  );
  assert.equal(appliedHalfling.race?.subraceName, "Lightfoot");

  resetTestCompendium();
});


