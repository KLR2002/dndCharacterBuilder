import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalogs, loadSrdCatalog, inMemoryCompendium } from "./testUtils.ts";
import {
  resolveAncestryState,
  applyAncestrySelection,
  applyAncestryChoice,
  clearAncestryChoice,
  setRacialCantrip,
  offersPlainRaceForm,
} from "../src/rules/ancestryEngine.ts";
import { setChoiceRacialBonus } from "../src/rules/builderTransitions.ts";
import type { RaceData } from "../src/types/dnd5e.ts";

const testCollections = loadTestCatalogs();
const catalogs = { compendium: inMemoryCompendium(testCollections) };
const races = testCollections.races as RaceData[];

test("resolveAncestryState detects High Elf and unlocks racial cantrip", () => {
  const char = makeChar({
    race: { name: "Elf", subraceName: "High", source: "PHB" },
  });

  const state = resolveAncestryState(char, catalogs);
  assert.equal(state.hasRacialCantrip, true);
  assert.equal(state.racialCantripTitle, "High Elf Cantrip");
  assert.equal(state.currentRacialCantrip, undefined);
  assert.equal(state.hasOriginFeat, false);
  assert.equal(state.hasFixedASI, true);
  assert.equal(state.fixedBonuses.dex, 2);
  assert.equal(state.fixedBonuses.int, 1);

  // Set cantrip
  const withCantrip = setRacialCantrip(char, "Fire Bolt");
  const stateWithCantrip = resolveAncestryState(withCantrip, catalogs);
  assert.equal(stateWithCantrip.currentRacialCantrip, "Fire Bolt");
});

test("resolveAncestryState detects Variant Human and Custom Lineage for origin feats", () => {
  const vHuman = makeChar({
    race: { name: "Human", subraceName: "Variant", source: "PHB" },
  });
  const vState = resolveAncestryState(vHuman, catalogs);
  assert.equal(vState.hasOriginFeat, true);
  assert.equal(vState.originFeatTitle, "Variant Human Origin Feat");
  assert.equal(vState.isChoiceASIRace, true);
  assert.equal(vState.choiceASIConfig.count, 2);
  assert.equal(vState.choiceASIConfig.amount, 1);

  const customLineage = makeChar({
    race: { name: "Custom Lineage", source: "TCoE" },
  });
  const cState = resolveAncestryState(customLineage, catalogs);
  assert.equal(cState.hasOriginFeat, true);
  assert.equal(cState.originFeatTitle, "Custom Lineage Feat");
  assert.equal(cState.choiceASIConfig.count, 1);
  assert.equal(cState.choiceASIConfig.amount, 2);
});

test("Half-Elf High descent unlocks cantrip and cascades invalidation on descent change", () => {
  const halfElf = makeChar({
    race: { name: "Half-Elf", subraceName: "Moon Elf or Sun Elf Descent", source: "PHB", subraceSource: "SCAG" },
  });

  // Initially no ruleChoice picked -> hasRacialCantrip is false
  const state0 = resolveAncestryState(halfElf, catalogs);
  assert.equal(state0.hasRacialCantrip, false);
  assert.ok(state0.availableRuleChoices.length > 0);

  const descentChoice = state0.availableRuleChoices[0];
  assert.ok(descentChoice.options.some((o) => o.name === "Cantrip"));

  // Pick "Cantrip" descent trait
  const charWithDescent = applyAncestryChoice(halfElf, descentChoice.id, "Cantrip", catalogs);
  const state1 = resolveAncestryState(charWithDescent, catalogs);
  assert.equal(state1.hasRacialCantrip, true);
  assert.equal(state1.racialCantripTitle, "Half-Elf Cantrip");

  // Pick a wizard cantrip
  const charWithCantrip = setRacialCantrip(charWithDescent, "Mage Hand");
  const state2 = resolveAncestryState(charWithCantrip, catalogs);
  assert.equal(state2.currentRacialCantrip, "Mage Hand");

  // Change descent from "Cantrip" to "Elf Weapon Training" -> must CASCADE and purge picked cantrip
  const charChanged = applyAncestryChoice(charWithCantrip, descentChoice.id, "Elf Weapon Training", catalogs);
  const state3 = resolveAncestryState(charChanged, catalogs);
  assert.equal(state3.hasRacialCantrip, false);
  assert.equal(state3.currentRacialCantrip, undefined);
  // Ensure the orphaned cantrip rule choice was purged
  assert.ok(!charChanged.ruleChoices?.some((r) => r.id.includes("High Elf") || r.picked?.includes("Mage Hand")));
});

test("applyAncestrySelection resets old picks and assigns fixed bonuses", () => {
  const elfRace = races.find((r) => r.name === "Elf")!;
  const highElfSubrace = elfRace.subraces?.find((sr) => sr.name === "High");
  const dwarfRace = races.find((r) => r.name === "Dwarf")!;
  const mountainDwarfSubrace = dwarfRace.subraces?.find((sr) => sr.name === "Mountain");

  let char = makeChar();
  char = applyAncestrySelection(char, elfRace, highElfSubrace, catalogs);
  char = setRacialCantrip(char, "Prestidigitation");
  assert.equal(resolveAncestryState(char, catalogs).currentRacialCantrip, "Prestidigitation");

  // Switch to Mountain Dwarf
  char = applyAncestrySelection(char, dwarfRace, mountainDwarfSubrace, catalogs);
  const dwarfState = resolveAncestryState(char, catalogs);
  assert.equal(dwarfState.hasRacialCantrip, false);
  assert.equal(dwarfState.currentRacialCantrip, undefined);
  assert.equal(dwarfState.fixedBonuses.str, 2);
  assert.equal(dwarfState.fixedBonuses.con, 2);
  assert.equal(char.ruleChoices?.length ?? 0, 0);
});

test("Half-Elf High descent purges cantrip when toggling off Cantrip pick", () => {
  const halfElf = makeChar({
    race: { name: "Half-Elf", subraceName: "Moon Elf or Sun Elf Descent", source: "PHB", subraceSource: "SCAG" },
  });
  const state0 = resolveAncestryState(halfElf, catalogs);
  const descentChoice = state0.availableRuleChoices[0];

  // Pick "Cantrip"
  const charWithDescent = applyAncestryChoice(halfElf, descentChoice.id, "Cantrip", catalogs);
  // Pick wizard cantrip
  const charWithCantrip = setRacialCantrip(charWithDescent, "Shocking Grasp");
  assert.equal(resolveAncestryState(charWithCantrip, catalogs).currentRacialCantrip, "Shocking Grasp");

  // Toggle "Cantrip" off by calling applyAncestryChoice with "Cantrip" again
  const charToggledOff = applyAncestryChoice(charWithCantrip, descentChoice.id, "Cantrip", catalogs);
  const stateOff = resolveAncestryState(charToggledOff, catalogs);
  assert.equal(stateOff.hasRacialCantrip, false);
  assert.equal(stateOff.currentRacialCantrip, undefined);
  // Cantrip choice must be purged
  assert.ok(!charToggledOff.ruleChoices?.some((r) => r.id.includes("High Elf") || r.picked?.includes("Shocking Grasp")));
});

test("resolveAncestryState returns speed, size, darkvision, and traits", () => {
  const elf = makeChar({
    race: { name: "Elf", subraceName: "High", source: "PHB" },
  });
  const state = resolveAncestryState(elf, catalogs);
  assert.equal(state.speed, 30);
  assert.equal(state.size, "Medium");
  assert.equal(state.darkvision, 60);
  assert.ok(state.traits.length >= 4);
  assert.ok(state.traits.some((t) => t.name === "Darkvision"));
  assert.ok(state.traits.some((t) => t.name === "Keen Senses"));
});

test("clearAncestryChoice deselects picked option and purges dependent cantrip", () => {
  const halfElf = makeChar({
    race: { name: "Half-Elf", subraceName: "Moon Elf or Sun Elf Descent", source: "PHB", subraceSource: "SCAG" },
  });
  const state = resolveAncestryState(halfElf, catalogs);
  const choiceId = state.availableRuleChoices[0].id;

  const picked = applyAncestryChoice(halfElf, choiceId, "Cantrip", catalogs);
  const withCantrip = setRacialCantrip(picked, "Ray of Frost");
  assert.equal(resolveAncestryState(withCantrip, catalogs).currentRacialCantrip, "Ray of Frost");

  const cleared = clearAncestryChoice(withCantrip, choiceId);
  assert.equal(cleared.ruleChoices?.find((r) => r.id === choiceId), undefined);
  assert.equal(resolveAncestryState(cleared, catalogs).hasRacialCantrip, false);
  assert.equal(resolveAncestryState(cleared, catalogs).currentRacialCantrip, undefined);
});

test("resolveAncestryState distinguishes MPMM Genasi (flexible choice ASI) from EEPC Genasi (fixed ASI)", () => {
  const mpmmGenasi = makeChar({
    race: { name: "Genasi", subraceName: "Air", source: "MPMM" },
  });
  const mpmmState = resolveAncestryState(mpmmGenasi, catalogs);
  assert.equal(mpmmState.hasFixedASI, false);
  assert.equal(mpmmState.isFlexibleMPMM, true);
  assert.equal(mpmmState.isChoiceASIRace, true);

  const eepcGenasi = makeChar({
    race: { name: "Genasi", subraceName: "Air", source: "EEPC" },
  });
  const eepcState = resolveAncestryState(eepcGenasi, catalogs);
  assert.equal(eepcState.hasFixedASI, true);
  assert.equal(eepcState.fixedBonuses.con, 2);
  assert.equal(eepcState.fixedBonuses.dex, 1);
  assert.equal(eepcState.isFlexibleMPMM, false);

  // User chooses +2 INT, +1 DEX on MPMM Genasi
  const withBonuses = setChoiceRacialBonus(mpmmGenasi, [
    { key: "int", amount: 2 },
    { key: "dex", amount: 1 },
  ]);
  assert.equal(withBonuses.racialAbilityBonuses?.int, 2);
  assert.equal(withBonuses.racialAbilityBonuses?.dex, 1);
});



test("resolveAncestryState reads the selected race from the Compendium it is given", () => {
  const human = races.find((r) => r.name === "Human" && r.source === "PHB")!;
  const testfolk = { ...human, name: "Testfolk", source: "TEST", subraces: [] };
  const char = makeChar({ race: { name: "Testfolk", source: "TEST" } });

  assert.equal(resolveAncestryState(char, { compendium: inMemoryCompendium({ races: [testfolk] }) }).selectedRace?.name, "Testfolk");
  assert.equal(resolveAncestryState(char, { compendium: inMemoryCompendium({ races: [] }) }).selectedRace, undefined);
});

test("offersPlainRaceForm offers a plain form to integrated races the SRD holds without a subrace", () => {
  const srdRaces = loadSrdCatalog<RaceData[]>("races");
  const offered = (name: string) =>
    offersPlainRaceForm(races.find((r) => r.name === name && r.source === "PHB")!, srdRaces);

  assert.equal(offered("Half-Elf"), true);
  assert.equal(offered("Dragonborn"), true);
  assert.equal(offered("Tiefling"), true);
  // SRD races held only with a named subrace, Human's unnamed base subrace, and Half-Orc (one integrated subrace).
  for (const name of ["Dwarf", "Elf", "Halfling", "Gnome", "Human", "Half-Orc"]) {
    assert.equal(offered(name), false, `${name} should not gain a plain form`);
  }
});

test("offersPlainRaceForm withholds the plain form when the SRD has no such race or holds it with a named subrace", () => {
  const srdRaces = loadSrdCatalog<RaceData[]>("races");
  const base = races.find((r) => r.name === "Dragonborn" && r.source === "PHB")!;
  const twoSubraces = [
    { ...base.subraces![0], name: "Alpha Lineage" },
    { ...base.subraces![1], name: "Beta Lineage" },
  ];
  const unknown = { ...base, name: "Testfolk", source: "TEST", subraces: twoSubraces };
  assert.equal(offersPlainRaceForm(unknown, srdRaces), false);

  const srdElf = srdRaces.find((r) => r.name === "Elf")!;
  const srdWithNamedSubrace = { ...srdElf, name: "Testfolk", source: "SRD", subraces: [{ ...srdElf.subraces![0], name: "Gamma" }] };
  assert.equal(offersPlainRaceForm(unknown, [...srdRaces, srdWithNamedSubrace]), false);

  const srdBare = { ...base, name: "Testfolk", source: "SRD", subraces: [] };
  assert.equal(offersPlainRaceForm(unknown, [...srdRaces, srdBare]), true);
});

test("picking the plain integrated Half-Elf leaves no subrace and offers the Choice ASI picker", () => {
  const halfElf = races.find((r) => r.name === "Half-Elf" && r.source === "PHB")!;
  const char = applyAncestrySelection(makeChar(), halfElf, undefined, catalogs);

  assert.equal(char.race?.name, "Half-Elf");
  assert.equal(char.race?.subraceName, undefined);
  assert.deepEqual(char.racialAbilityBonuses, {});

  const state = resolveAncestryState(char, catalogs);
  assert.equal(state.selectedSubrace, undefined);
  assert.equal(state.isChoiceASIRace, true);
});
