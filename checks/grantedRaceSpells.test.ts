import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { validateFeatPrerequisites } from "../src/rules/feats.ts";
import { toggleInnateSpellUse } from "../src/rules/characterSpells.ts";
import { raceSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { applyLongRest } from "../src/rules/rest.ts";
import type { CharacterClass, RuleChoiceEntry } from "../src/types/character.ts";
import type { InnateSpellEntry, InnateSpellProfile } from "../src/rules/innateMagic.ts";
import { inMemoryCompendium, integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";
import { grantedSpellClasses, grantedSpellFeats, grantedSpellRaces, grantedSpellSpells } from "./grantedSpellsFixture.ts";

// Race and subrace spell grants are Innate Magic sources too (ADR 0017). Every name here is invented
// (checks/grantedSpellsFixture.ts). Sample Kin is the race, Sample Line and Sample Plain its subraces.

const catalogs = {
  compendium: inMemoryCompendium({
    classes: grantedSpellClasses(),
    races: grantedSpellRaces(),
    feats: grantedSpellFeats(),
    spells: grantedSpellSpells(),
  }), activeBooks: ALL_BOOKS,
};

const mage = (level: number): CharacterClass => ({ className: "Sample Mage", source: "TST", level });

/** A character of the invented race (and subrace, when given) at the given level. */
const kin = (level: number, subraceName?: string) =>
  makeChar({
    classes: [mage(level)],
    race: { name: "Sample Kin", source: "TST", ...(subraceName ? { subraceName, subraceSource: "TST" } : {}) },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
  });

const sourceTitled = (sources: InnateSpellProfile[], title: string) => sources.find((source) => source.title === title);

test("a race's fixed cantrip is at will, on a card titled for the race", () => {
  const evaluated = evaluateCharacter(kin(1), catalogs);
  const card = sourceTitled(evaluated.grantedSpellSources, "Sample Kin");
  assert.ok(card, "the race has a source titled by its name");
  assert.equal(card.ability, "cha");
  assert.equal(card.spellSaveDc, 8 + 2 + 3, "8 + proficiency bonus + Charisma modifier");
  const ember = card.spells.find((spell) => spell.name === "Sample Ember");
  assert.ok(ember, "the cantrip is listed");
  assert.equal(ember.isCantrip, true);
  assert.equal(ember.resourceCounterId, undefined, "a cantrip is at will");
});

test("a race's leveled spell in its known group is cast once per Long Rest from the level its key gives", () => {
  const character = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Learned", source: "TST" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
  });
  const card = sourceTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Learned");
  const pulse = card?.spells.find((spell) => spell.name === "Sample Pulse");
  assert.equal(pulse?.minCharacterLevel, 1, "the key gives level 1");
  assert.equal(pulse?.resourceCounterId, "innate_spell_sample_pulse", "its counter is the spell's own id");
  assert.equal(pulse?.maxUses, 1);
});

test("a race's spell from a later level is listed only from that level, with its counter", () => {
  const below = evaluateCharacter(kin(2), catalogs);
  const card = sourceTitled(below.grantedSpellSources, "Sample Kin");
  assert.ok(card?.spells.some((spell) => spell.name === "Sample Ember"));
  assert.equal(card?.spells.some((spell) => spell.name === "Sample Pulse"), false, "level 2 is below the level-3 grant");

  const at = evaluateCharacter(kin(3), catalogs);
  const pulse = sourceTitled(at.grantedSpellSources, "Sample Kin")?.spells.find((spell) => spell.name === "Sample Pulse");
  assert.ok(pulse, "level 3 unlocks the grant");
  assert.equal(pulse.minCharacterLevel, 3);
  assert.equal(pulse.maxUses, 1, "a daily spell allows one use");
  assert.ok(pulse.resourceCounterId, "a daily spell has a Long Rest counter");
});

test("a race's per-rest spell has a counter that a long rest restores", () => {
  const character = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Kin", source: "TST", subraceName: "Sample Line", subraceSource: "TST" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
  });
  const evaluated = evaluateCharacter(character, catalogs);
  const glimmer = sourceTitled(evaluated.grantedSpellSources, "Sample Line")?.spells.find((spell) => spell.name === "Sample Glimmer");
  assert.ok(glimmer?.resourceCounterId, "the per-rest spell has a counter");

  const spell = glimmer!;
  const used = toggleInnateSpellUse(character, spell);
  assert.equal(used.resourceCounters[spell.resourceCounterId!]?.current, 0, "casting it uses the counter");
  const rested = applyLongRest(used);
  assert.equal(rested.resourceCounters[spell.resourceCounterId!]?.current, 1, "a long rest restores the counter");
});

test("a race's granted spell satisfies a feat prerequisite of being able to cast a spell", () => {
  const prerequisite = { name: "Sample Requirement", prerequisite: "The ability to cast at least one spell" };
  assert.equal(validateFeatPrerequisites(kin(1), prerequisite, { catalogs }).met, true);
  assert.equal(validateFeatPrerequisites(makeChar({ classes: [mage(1)] }), prerequisite, { catalogs }).met, false);
});

test("a saved counter under a race spell's id keeps its used state", () => {
  const character = makeChar({
    classes: [mage(3)],
    race: { name: "Sample Kin", source: "TST" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    resourceCounters: {
      innate_spell_sample_pulse: { id: "innate_spell_sample_pulse", name: "Innate: Sample Pulse", current: 0, max: 1, resetOn: "long" },
    },
  });
  const evaluated = evaluateCharacter(character, catalogs);
  const pulse = sourceTitled(evaluated.grantedSpellSources, "Sample Kin")?.spells.find((spell) => spell.name === "Sample Pulse");
  assert.equal(pulse?.resourceCounterId, "innate_spell_sample_pulse", "the race spell uses the id the table saved");
  assert.equal(character.resourceCounters[pulse!.resourceCounterId!]?.current, 0, "the used state is what was saved");
});

test("a subrace's own grants replace the race's, and a subrace without grants keeps them", () => {
  const withOwn = evaluateCharacter(kin(1, "Sample Line"), catalogs);
  const titles = withOwn.grantedSpellSources.map((source) => source.title);
  assert.deepEqual(titles, ["Sample Line"], "only the subrace's source is listed");

  const withoutOwn = evaluateCharacter(kin(1, "Sample Plain"), catalogs);
  assert.deepEqual(
    withoutOwn.grantedSpellSources.map((source) => source.title),
    ["Sample Kin"],
    "the race's source stays",
  );
});

test("a race whose casting ability is a pick has a card that needs the ability until it is chosen", () => {
  const character = makeChar({
    classes: [mage(1)],
    race: { name: "Sample Chooser", source: "TST" },
  });
  const card = sourceTitled(evaluateCharacter(character, catalogs).grantedSpellSources, "Sample Chooser");
  assert.equal(card?.ability, undefined);
  assert.ok(card?.spells.some((spell) => spell.name === "Sample Ember"), "the fixed spell is listed");
  assert.deepEqual(card?.notices, ["Needs review: choose a casting ability"]);
});

test("a race source has origin race and a feat source has origin feat", () => {
  const character = makeChar({
    classes: [mage(4)],
    race: { name: "Sample Kin", source: "TST" },
    asiSelections: [{ level: 4, type: "feat", featName: "Sample Cinder", featSource: "TST", featAbility: "int" }],
  });
  const sources = evaluateCharacter(character, catalogs).grantedSpellSources;
  assert.equal(sourceTitled(sources, "Sample Kin")?.origin, "race");
  assert.equal(sourceTitled(sources, "Sample Cinder")?.origin, "feat");
});

// The SRD Baseline carries High Elf and Tiefling, so their grants read with no synced catalog (no invented data here).
test("on the SRD Baseline alone, a Tiefling has Thaumaturgy at will, and Hellish Rebuke and Darkness from their levels", () => {
  const tiefling = (level: number) =>
    makeChar({
      classes: [{ className: "Fighter", source: "PHB", level }],
      race: { name: "Tiefling", source: "SRD" },
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
    });
  const srd = { compendium: srdBaselineCompendium(), activeBooks: ALL_BOOKS };

  const level1 = sourceTitled(evaluateCharacter(tiefling(1), srd).grantedSpellSources, "Tiefling");
  assert.ok(level1?.spells.some((spell) => spell.name === "Thaumaturgy" && spell.resourceCounterId === undefined));
  assert.equal(level1?.spells.some((spell) => spell.name === "Hellish Rebuke"), false);

  const level3 = sourceTitled(evaluateCharacter(tiefling(3), srd).grantedSpellSources, "Tiefling");
  const rebuke = level3?.spells.find((spell) => spell.name === "Hellish Rebuke");
  assert.equal(rebuke?.resourceCounterId, "innate_spell_hellish_rebuke", "the counter id is the spell's own id");
  assert.equal(rebuke?.level, 2, "the source casts Hellish Rebuke at level 2");

  const level5 = sourceTitled(evaluateCharacter(tiefling(5), srd).grantedSpellSources, "Tiefling");
  assert.ok(level5?.spells.some((spell) => spell.name === "Darkness"));
});

test("on the SRD Baseline, a High Elf's race card is titled with the subrace and the race", () => {
  const highElf = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    race: { name: "Elf", source: "SRD", subraceName: "High", subraceSource: "SRD" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
  });
  const card = evaluateCharacter(highElf, { compendium: srdBaselineCompendium(), activeBooks: ALL_BOOKS }).grantedSpellSources.find((source) => source.origin === "race");
  assert.ok(card, "the High Elf's grant gives a race card");
  assert.equal(card.title, "High Elf");
});

test("a race's spell with a cast-level suffix is listed at that level, and one without keeps its own level", () => {
  const caster = makeChar({
    classes: [mage(3)],
    race: { name: "Sample Caster", source: "TST" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
  });
  const card = sourceTitled(evaluateCharacter(caster, catalogs).grantedSpellSources, "Sample Caster");
  const pulse = card?.spells.find((spell) => spell.name === "Sample Pulse");
  const veil = card?.spells.find((spell) => spell.name === "Sample Veil");
  assert.equal(pulse?.level, 2, "Sample Pulse is catalogued at level 1 but cast at level 2");
  assert.equal(pulse?.isCantrip, false);
  assert.equal(veil?.level, 2, "Sample Veil has no suffix and keeps its catalogued level");
});

test("a race's spell with a note carries it on its entry, and a spell without one carries none", () => {
  const caster = makeChar({
    classes: [mage(3)],
    race: { name: "Sample Caster", source: "TST" },
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
  });
  const card = sourceTitled(evaluateCharacter(caster, catalogs).grantedSpellSources, "Sample Caster");
  assert.equal(card?.spells.find((spell) => spell.name === "Sample Veil")?.note, "self only");
  assert.equal("note" in (card?.spells.find((spell) => spell.name === "Sample Pulse") ?? {}), false);
});

test("a race's spell list offered for the race words its casting ability as chosen for the race, not for a feat", () => {
  const character = makeChar({ classes: [mage(1)], race: { name: "Sample Listed", source: "TST" } });
  const lists = raceSpellRuleChoices(character, catalogs.compendium, ALL_BOOKS).find((choice) => choice.options.some((o) => o.name === "Sample Listed Spells"));
  assert.ok(lists, "the race's list is offered");
  assert.equal(lists.options[0].description, "Casting ability: chosen for the race");
});

test("a subrace's grant is read only while the option that gates it is picked in the Rule Choice it waits on", () => {
  const gated = (ruleChoices?: RuleChoiceEntry[]) =>
    makeChar({
      classes: [mage(1)],
      race: { name: "Sample Gated", source: "TST", subraceName: "Sample Gated Line", subraceSource: "TST" },
      ...(ruleChoices ? { ruleChoices } : {}),
    });
  const shut = evaluateCharacter(gated(), catalogs).grantedSpellSources;
  assert.equal(sourceTitled(shut, "Sample Gated Line"), undefined, "the option is not picked, so the grant is not read");

  const pick: RuleChoiceEntry = {
    id: "TST__Sample Gated__Sample Gated Line__Sample Option (Choose 1)",
    trait: "Sample Option (Choose 1)",
    origin: "race",
    choose: 1,
    from: ["Sample Cantrip", "Sample Other"],
    picked: ["Sample Cantrip"],
  };
  const open = evaluateCharacter(gated([pick]), catalogs).grantedSpellSources;
  assert.ok(sourceTitled(open, "Sample Gated Line")?.spells.some((spell) => spell.name === "Sample Ember"), "picked, the grant is read");
});

test("the tracked catalog reads the Moon Elf or Sun Elf descent's wizard cantrip only once its Cantrip option is picked", () => {
  const integrated = { compendium: integratedTestCompendium(), activeBooks: ALL_BOOKS };
  const descent = { name: "Half-Elf", source: "PHB", subraceName: "Moon Elf or Sun Elf Descent", subraceSource: "SCAG" };
  const wizard = { className: "Wizard", source: "PHB", level: 1 };
  const shut = evaluateCharacter(makeChar({ classes: [wizard], race: descent }), integrated).grantedSpellSources;
  assert.equal(sourceTitled(shut, "Moon Elf or Sun Elf Descent"), undefined, "the option is not picked, so the cantrip is not read");

  const pick: RuleChoiceEntry = {
    id: "SCAG__Half-Elf__Moon Elf or Sun Elf Descent__Variant Feature (Choose 1)",
    trait: "Variant Feature (Choose 1)",
    origin: "race",
    choose: 1,
    from: ["Cantrip", "Other"],
    picked: ["Cantrip"],
  };
  const open = evaluateCharacter(makeChar({ classes: [wizard], race: descent, ruleChoices: [pick] }), integrated).grantedSpellSources;
  assert.ok(sourceTitled(open, "Moon Elf or Sun Elf Descent"), "picked, the grant is read and offers its wizard cantrip");
});

test("the tracked catalog reads Half-Elf Drow Descent's spells only once its Drow Magic option is picked", () => {
  const integrated = { compendium: integratedTestCompendium(), activeBooks: ALL_BOOKS };
  const descent = { name: "Half-Elf", source: "PHB", subraceName: "Drow Descent", subraceSource: "SCAG" };
  const fighter = { className: "Fighter", source: "PHB", level: 5 };
  const shut = evaluateCharacter(makeChar({ classes: [fighter], race: descent }), integrated).grantedSpellSources;
  assert.equal(sourceTitled(shut, "Drow Descent"), undefined, "the option is not picked, so the descent's spells are not read");

  const pick: RuleChoiceEntry = {
    id: "SCAG__Half-Elf__Drow Descent__Variant Feature (Choose 1)",
    trait: "Variant Feature (Choose 1)",
    origin: "race",
    choose: 1,
    from: ["Skill Versatility", "Drow Magic"],
    picked: ["Drow Magic"],
  };
  const open = evaluateCharacter(makeChar({ classes: [fighter], race: descent, ruleChoices: [pick] }), integrated).grantedSpellSources;
  const card = sourceTitled(open, "Drow Descent");
  assert.ok(card, "picked, the descent's spells are read");
  assert.ok(card.spells.some((spell) => spell.name === "Dancing Lights"), "its cantrip is listed");
});

test("the tracked catalog gives Deep Gnome and Hexblood their leveled spells once per Long Rest from level 1, Deep Gnome's nondetection at will", () => {
  const integrated = { compendium: integratedTestCompendium(), activeBooks: ALL_BOOKS };
  const cases = [
    { race: "Gnome (Deep)", source: "DMG", spells: ["Disguise Self"] },
    { race: "Hexblood", source: "VRGR", spells: ["Disguise Self", "Hex"] },
  ];
  for (const { race, source, spells } of cases) {
    const character = makeChar({ classes: [{ className: "Wizard", source: "PHB", level: 1 }], race: { name: race, source } });
    const card = sourceTitled(evaluateCharacter(character, integrated).grantedSpellSources, race);
    assert.ok(card, `${race} has its card`);
    for (const name of spells) {
      const spell: InnateSpellEntry | undefined = card.spells.find((candidate) => candidate.name === name);
      assert.ok(spell, `${name} is listed`);
      assert.equal(spell.minCharacterLevel, 1, "the data keys it at level 1");
      assert.equal(spell.maxUses, 1, "a leveled spell of a known group is once per Long Rest");
      assert.ok(spell.resourceCounterId, `${name} has a counter`);
    }
  }
  const gnome = makeChar({ classes: [{ className: "Wizard", source: "PHB", level: 1 }], race: { name: "Gnome (Deep)", source: "DMG" } });
  const nondetection = sourceTitled(evaluateCharacter(gnome, integrated).grantedSpellSources, "Gnome (Deep)")?.spells.find((spell) => spell.name === "Nondetection");
  assert.ok(nondetection, "Nondetection is listed");
  assert.equal(nondetection.resourceCounterId, undefined, "the trait casts Nondetection at will, with no counter");
});
