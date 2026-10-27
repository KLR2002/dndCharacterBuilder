import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";
import { createCompendium, currentCompendium, type Compendium } from "../src/services/compendium.ts";
import { isSpellAvailableForClass } from "../src/rules/spellcasting.ts";
import { resolveAncestryState, applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { raceSpellRuleChoices, subclassRuleChoices } from "../src/rules/ruleChoices.ts";
import { maxHp } from "../src/rules/hp.ts";
import { srdBaselineBundle, srdBaselineCompendium, integratedTestCompendium, makeChar, withSpellChoiceFixtures } from "./testUtils.ts";

// Dual-Mode suites: the SRD Baseline is an explicit Compendium, so these tests never mutate
// the process-wide default and do not depend on test ordering.
const srd = srdBaselineCompendium();

test("srdBaseline: default SRD catalogs are accessible even when activeBooks does not include SRD", () => {
  assert.equal(srd.integrated, false, "App must be in SRD mode");

  // activeBooks default to expansion books which do not contain 'SRD'
  const activeBooks = [...DEFAULT_ACTIVE_BOOK_CODES];
  assert.equal(activeBooks.includes("SRD"), false);

  const races = srd.for(activeBooks).races();
  assert.ok(races.length > 0, "Races must not be empty in SRD mode");
  assert.ok(races.some((r) => r.name === "Elf"));

  const classes = srd.for(activeBooks).classes();
  assert.equal(classes.length, 12, "Must return 12 SRD classes");

  const backgrounds = srd.for(activeBooks).backgrounds();
  assert.ok(backgrounds.length > 0, "Backgrounds must not be empty in SRD mode");

  const feats = srd.for(activeBooks).feats();
  assert.ok(feats.length > 0, "Feats must not be empty in SRD mode");

  const spells = srd.for(activeBooks).spells();
  assert.ok(spells.length > 0, "Spells must not be empty in SRD mode");

  const items = srd.for(activeBooks).items();
  assert.ok(items.length > 0, "Items must not be empty in SRD mode");

  const beasts = srd.for(activeBooks).beasts();
  assert.ok(beasts.length > 0, "Beasts must not be empty in SRD mode");

  const options = srd.for(activeBooks).optionsAndFeatures();
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
});

test("srdBaseline: Human has +1 to all ability scores and no flexible ASI choice", () => {
  const human = srd.for().races().find((r) => r.name === "Human");
  assert.ok(human, "Human race must exist in SRD");
  assert.deepEqual(
    human.abilityScoreIncrease,
    [{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }],
    "Human in SRD must have +1 to all six ability scores"
  );

  const humanChar = makeChar({
    race: { name: "Human", source: "SRD" },
  });
  const state = resolveAncestryState(humanChar, { compendium: srd });
  assert.equal(state.hasFixedASI, true);
  assert.deepEqual(state.fixedBonuses, { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
  assert.equal(state.isChoiceASIRace, false, "Standard Human must not be a choice ASI race");
  assert.equal(state.isFlexibleMPMM, false, "Standard Human must not have flexible MPMM ASI");

  const applied = applyAncestrySelection(makeChar(), human, undefined, { compendium: srd });
  assert.deepEqual(
    applied.racialAbilityBonuses,
    { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    "Applying Human must award +1 to all six ability scores"
  );
});

test("srdBaseline: does not contain expansion Lineage races or Custom Lineage", () => {
  const raceNames = new Set(srd.for().races().map((r) => r.name));
  assert.equal(raceNames.has("Dhampir"), false);
  assert.equal(raceNames.has("Hexblood"), false);
  assert.equal(raceNames.has("Reborn"), false);
  assert.equal(raceNames.has("Custom Lineage"), false);
});

test("srdBaseline: Dwarf, Elf, Gnome, and Halfling have their single SRD subrace with complete ASI and features", () => {
  const races = srd.for().races();

  // 1. Dwarf -> Hill Dwarf
  const dwarf = races.find((r) => r.name === "Dwarf");
  assert.ok(dwarf, "Dwarf must exist in SRD");
  assert.equal(dwarf.subraces?.length, 1, "Dwarf in SRD must have exactly 1 subrace");
  assert.equal(dwarf.subraces?.[0].name, "Hill", "Dwarf SRD subrace must be Hill Dwarf");
  assert.deepEqual(dwarf.subraces?.[0].abilityScoreIncrease, [{ wis: 1 }]);
  assert.ok(dwarf.subraces?.[0].traits?.some((t) => t.name === "Dwarven Toughness"));

  const appliedDwarf = applyAncestrySelection(makeChar(), dwarf, dwarf.subraces?.[0], { compendium: srd });
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

  const appliedElf = applyAncestrySelection(makeChar(), elf, elf.subraces?.[0], { compendium: srd });
  assert.deepEqual(
    appliedElf.racialAbilityBonuses,
    { dex: 2, int: 1 },
    "High Elf in SRD must have +2 DEX and +1 INT"
  );
  assert.equal(appliedElf.race?.subraceName, "High");
  const elfPick = raceSpellRuleChoices(appliedElf, srd).find((choice) => choice.traitName === "High Elf Cantrip");
  assert.ok(elfPick, "High Elf must offer its wizard cantrip as a race pick on the SRD Baseline");
  assert.equal(elfPick.choose, 1);

  // 3. Gnome -> Rock Gnome
  const gnome = races.find((r) => r.name === "Gnome");
  assert.ok(gnome, "Gnome must exist in SRD");
  assert.equal(gnome.subraces?.length, 1, "Gnome in SRD must have exactly 1 subrace");
  assert.equal(gnome.subraces?.[0].name, "Rock", "Gnome SRD subrace must be Rock Gnome");
  assert.deepEqual(gnome.subraces?.[0].abilityScoreIncrease, [{ con: 1 }]);
  assert.ok(gnome.subraces?.[0].traits?.some((t) => t.name === "Artificer's Lore"));
  assert.ok(gnome.subraces?.[0].traits?.some((t) => t.name === "Tinker"));

  const appliedGnome = applyAncestrySelection(makeChar(), gnome, gnome.subraces?.[0], { compendium: srd });
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

  const appliedHalfling = applyAncestrySelection(makeChar(), halfling, halfling.subraces?.[0], { compendium: srd });
  assert.deepEqual(
    appliedHalfling.racialAbilityBonuses,
    { dex: 2, cha: 1 },
    "Lightfoot Halfling in SRD must have +2 DEX and +1 CHA"
  );
  assert.equal(appliedHalfling.race?.subraceName, "Lightfoot");
});

test("dual-mode: SRD and integrated Compendiums sit side by side and leave the process default alone", () => {
  const before = currentCompendium();
  const integrated = integratedTestCompendium();

  assert.equal(srd.integrated, false);
  assert.equal(integrated.integrated, true);
  assert.equal(srd.findRace("Dhampir"), undefined, "SRD must not offer expansion lineages");
  assert.ok(integrated.findRace("Dhampir"), "integrated catalog must offer expansion lineages");
  assert.equal(currentCompendium(), before, "building explicit Compendiums must not change the process default");
});

test("dual-mode: a Nature Domain cantrip offers Druid cantrips from whichever Compendium it is given", () => {
  const integrated = integratedTestCompendium();
  const nature = makeChar({
    classes: [{ className: "Cleric", level: 1, subclassName: "Nature", hitDiceType: "d8" }],
  });

  const acolyteOptions = (compendium: Compendium) =>
    subclassRuleChoices(nature, undefined, compendium)
      .find((c) => c.id === "PHB__Cleric__Nature Domain__Acolyte of Nature")
      ?.options.map((o) => o.name) ?? [];

  // The SRD Baseline has no Nature Domain; the SRD side overlays the fixture domain that carries the
  // druid filter, so SRD mode offers the SRD druid cantrips as it did before the change.
  const srdWithDomain = createCompendium(withSpellChoiceFixtures(srdBaselineBundle()));
  const srdOptions = acolyteOptions(srdWithDomain);
  const integratedOptions = acolyteOptions(integrated);

  assert.ok(srdOptions.includes("Druidcraft"), "SRD mode offers the SRD druid cantrip");
  assert.ok(integratedOptions.includes("Druidcraft"), "integrated mode offers the SRD druid cantrip by name");
  assert.ok(srdOptions.every((n) => integratedOptions.includes(n)), "every SRD option is also offered when integrated");
  assert.ok(integratedOptions.length > srdOptions.length, "integrated mode offers more druid cantrips than SRD");
});
