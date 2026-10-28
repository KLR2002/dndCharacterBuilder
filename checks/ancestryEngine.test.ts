import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalogs, loadSrdCatalog, inMemoryCompendium } from "./testUtils.ts";
import {
  resolveAncestryState,
  applyAncestrySelection,
  applyAncestryChoice,
  clearAncestryChoice,
  offersPlainRaceForm,
} from "../src/rules/ancestryEngine.ts";
import { pickRuleChoice, raceSpellRuleChoices } from "../src/rules/ruleChoices.ts";
import { setChoiceRacialBonus } from "../src/rules/builderTransitions.ts";
import type { RaceData } from "../src/types/dnd5e.ts";

const testCollections = loadTestCatalogs();
const catalogs = { compendium: inMemoryCompendium(testCollections) };
const races = testCollections.races as RaceData[];

/** The race spell pick offering the option, for the character as it is. */
const racePickOffering = (character: ReturnType<typeof makeChar>, option: string) =>
  raceSpellRuleChoices(character, catalogs.compendium).find((choice) => choice.options.some((o) => o.name === option));


test("resolveAncestryState detects High Elf, and its wizard cantrip is the race's pick", () => {
  const char = makeChar({
    race: { name: "Elf", subraceName: "High", source: "PHB" },
  });

  const state = resolveAncestryState(char, catalogs);
  assert.equal(state.hasOriginFeat, false);
  assert.equal(state.hasFixedASI, true);
  assert.equal(state.fixedBonuses.dex, 2);
  assert.equal(state.fixedBonuses.int, 1);

  const offer = racePickOffering(char, "Fire Bolt");
  assert.ok(offer, "the wizard cantrips are offered as the race's pick");
  const picked = pickRuleChoice(char, offer, "Fire Bolt", catalogs.compendium);
  assert.deepEqual(picked.ruleChoices?.map((entry) => entry.picked), [["Fire Bolt"]]);
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


test("Half-Elf High descent offers the wizard cantrip once Cantrip is picked, and changing the descent releases it", () => {
  const halfElf = makeChar({
    race: { name: "Half-Elf", subraceName: "Moon Elf or Sun Elf Descent", source: "PHB", subraceSource: "SCAG" },
  });

  const descentChoice = resolveAncestryState(halfElf, catalogs).availableRuleChoices[0];
  assert.ok(descentChoice.options.some((o) => o.name === "Cantrip"));
  assert.equal(racePickOffering(halfElf, "Mage Hand"), undefined, "no cantrip pick before Cantrip is chosen");

  const charWithDescent = applyAncestryChoice(halfElf, descentChoice.id, "Cantrip", catalogs);
  const offer = racePickOffering(charWithDescent, "Mage Hand");
  assert.ok(offer, "Cantrip offers the wizard cantrip pick");
  const charWithCantrip = pickRuleChoice(charWithDescent, offer, "Mage Hand", catalogs.compendium);
  assert.ok(charWithCantrip.ruleChoices?.some((r) => r.picked.includes("Mage Hand")));

  // Change descent from "Cantrip" to "Elf Weapon Training": the cantrip is released with a notice
  const charChanged = applyAncestryChoice(charWithCantrip, descentChoice.id, "Elf Weapon Training", catalogs);
  assert.equal(charChanged.ruleChoices?.some((r) => r.picked.includes("Mage Hand")), false);
  assert.ok(charChanged.needsReview?.some((message) => message.includes("removed")));
});


test("applyAncestrySelection resets old picks and assigns fixed bonuses", () => {
  const elfRace = races.find((r) => r.name === "Elf")!;
  const highElfSubrace = elfRace.subraces?.find((sr) => sr.name === "High");
  const dwarfRace = races.find((r) => r.name === "Dwarf")!;
  const mountainDwarfSubrace = dwarfRace.subraces?.find((sr) => sr.name === "Mountain");

  let char = makeChar();
  char = applyAncestrySelection(char, elfRace, highElfSubrace, catalogs);
  const offer = racePickOffering(char, "Prestidigitation");
  assert.ok(offer);
  char = pickRuleChoice(char, offer, "Prestidigitation", catalogs.compendium);
  assert.equal(char.ruleChoices?.length, 1);

  // Switch to Mountain Dwarf: the High Elf's pick goes, with a notice
  char = applyAncestrySelection(char, dwarfRace, mountainDwarfSubrace, catalogs);
  const dwarfState = resolveAncestryState(char, catalogs);
  assert.equal(dwarfState.fixedBonuses.str, 2);
  assert.equal(dwarfState.fixedBonuses.con, 2);
  assert.equal(char.ruleChoices?.length ?? 0, 0);
  assert.ok(char.needsReview?.includes("Prestidigitation removed from High Elf: ancestry no longer grants it"), JSON.stringify(char.needsReview));
});


test("Half-Elf High descent releases its cantrip when the Cantrip option is toggled off", () => {
  const halfElf = makeChar({
    race: { name: "Half-Elf", subraceName: "Moon Elf or Sun Elf Descent", source: "PHB", subraceSource: "SCAG" },
  });
  const choiceId = resolveAncestryState(halfElf, catalogs).availableRuleChoices[0].id;

  const charWithDescent = applyAncestryChoice(halfElf, choiceId, "Cantrip", catalogs);
  const offer = racePickOffering(charWithDescent, "Fire Bolt");
  const charWithCantrip = pickRuleChoice(charWithDescent, offer!, "Fire Bolt", catalogs.compendium);
  assert.ok(charWithCantrip.ruleChoices?.some((r) => r.picked.includes("Fire Bolt")));

  // Toggle "Cantrip" off by picking it again
  const charToggledOff = applyAncestryChoice(charWithCantrip, choiceId, "Cantrip", catalogs);
  assert.equal(charToggledOff.ruleChoices?.some((r) => r.picked.includes("Fire Bolt")), false);
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


test("clearAncestryChoice deselects the descent and releases the cantrip it gave", () => {
  const halfElf = makeChar({
    race: { name: "Half-Elf", subraceName: "Moon Elf or Sun Elf Descent", source: "PHB", subraceSource: "SCAG" },
  });
  const choiceId = resolveAncestryState(halfElf, catalogs).availableRuleChoices[0].id;

  const picked = applyAncestryChoice(halfElf, choiceId, "Cantrip", catalogs);
  const offer = racePickOffering(picked, "Ray of Frost");
  const withCantrip = pickRuleChoice(picked, offer!, "Ray of Frost", catalogs.compendium);

  const cleared = clearAncestryChoice(withCantrip, choiceId);
  assert.equal(cleared.ruleChoices?.find((r) => r.id === choiceId), undefined);
  assert.equal(cleared.ruleChoices?.some((r) => r.picked.includes("Ray of Frost")), false);
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
