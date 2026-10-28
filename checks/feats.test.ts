import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Character, RuleChoiceEntry } from "../src/types/character.ts";
import { inMemoryCompendium } from "./testUtils.ts";
import {
  validateFeatPrerequisites,
  applyOriginFeat,
  removeOriginFeat,
  getBackgroundFeatGrant,
} from "../src/rules/feats.ts";
import { effectiveScores, hasFeat } from "../src/rules/abilities.ts";
import { FIGHTING_INITIATE_CHOICE_ID } from "../src/rules/choices/fightingStyles.ts";

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: "test-char",
    name: "Tester",
    folderId: null,
    gender: "Other",
    alignment: "Neutral",
    faction: { name: "", rank: "", renown: "", notes: "" },
    avatarUri: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    abilityMethod: "standardArray",
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    customLineage: false,
    lineageReplacement: null,
    race: { name: "Human", source: "PHB" },
    racialAbilityBonuses: {},
    background: { name: "Folk Hero", source: "PHB" },
    startingOption: "equipment",
    classes: [{ className: "Fighter", level: 1, source: "PHB" }],
    chosenSkills: [],
    chosenExpertise: [],
    asiSelections: [],
    originFeats: [],
    currentHp: 10,
    maxHpOverride: null,
    tempHp: 0,
    conditions: [],
    usedHitDice: {},
    deathSaves: { successes: 0, failures: 0 },
    usedSpellSlots: {},
    sorceryPointsUsed: 0,
    chosenMetamagic: [],
    items: [],
    pouch: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    useWeightLimit: false,
    resourceCounters: {},
    description: "",
    backstory: "",
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    notes: "",
    ...overrides,
  };
}

describe("Feat Prerequisite Validation", () => {
  it("passes when feat has no prerequisite", () => {
    const char = makeChar();
    const result = validateFeatPrerequisites(char, { name: "Alert" });
    assert.equal(result.met, true);
    assert.equal(result.reason, undefined);
  });

  describe("Ability Score Prerequisites", () => {
    it("validates Strength 13 or higher", () => {
      const lowStr = makeChar({ baseAbilityScores: { str: 12, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
      const highStr = makeChar({ baseAbilityScores: { str: 13, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });

      const fail = validateFeatPrerequisites(lowStr, { name: "Heavy Armor Master", prerequisite: "Strength 13 or higher" });
      assert.equal(fail.met, false);
      assert.match(fail.reason!, /Strength 13/i);

      const pass = validateFeatPrerequisites(highStr, { name: "Heavy Armor Master", prerequisite: "Strength 13 or higher" });
      assert.equal(pass.met, true);
    });

    it("validates Dexterity 13 or higher", () => {
      const char = makeChar({ baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });
      const pass = validateFeatPrerequisites(char, { name: "Defensive Duelist", prerequisite: "Dexterity 13 or higher" });
      assert.equal(pass.met, true);
    });

    it("validates Intelligence 13 or higher or Wisdom 13 or higher", () => {
      const fail = makeChar({ baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 12, cha: 10 } });
      const pass = makeChar({ baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } });

      const resFail = validateFeatPrerequisites(fail, {
        name: "Ritual Caster",
        prerequisite: "Intelligence 13 or higher or Wisdom 13 or higher",
      });
      assert.equal(resFail.met, false);

      const resPass = validateFeatPrerequisites(pass, {
        name: "Ritual Caster",
        prerequisite: "Intelligence 13 or higher or Wisdom 13 or higher",
      });
      assert.equal(resPass.met, true);
    });
  });

  describe("Armor and Weapon Proficiencies", () => {
    it("validates Proficiency with medium armor", () => {
      const wizard = makeChar({ classes: [{ className: "Wizard", level: 1, source: "PHB" }] });
      const fighter = makeChar({ classes: [{ className: "Fighter", level: 1, source: "PHB" }] });

      const fail = validateFeatPrerequisites(wizard, { name: "Heavily Armored", prerequisite: "Proficiency with medium armor" });
      assert.equal(fail.met, false);
      assert.match(fail.reason!, /medium armor/i);

      const pass = validateFeatPrerequisites(fighter, { name: "Heavily Armored", prerequisite: "Proficiency with medium armor" });
      assert.equal(pass.met, true);
    });

    it("validates Proficiency with light armor", () => {
      const rogue = makeChar({ classes: [{ className: "Rogue", level: 1, source: "PHB" }] });
      const pass = validateFeatPrerequisites(rogue, { name: "Moderately Armored", prerequisite: "Proficiency with light armor" });
      assert.equal(pass.met, true);
    });
  });

  describe("Spellcasting Prerequisite", () => {
    it("validates The ability to cast at least one spell", () => {
      const fighter = makeChar({ classes: [{ className: "Fighter", level: 1, source: "PHB" }] });
      const wizard = makeChar({ classes: [{ className: "Wizard", level: 1, source: "PHB" }] });

      const fail = validateFeatPrerequisites(fighter, { name: "War Caster", prerequisite: "The ability to cast at least one spell" });
      assert.equal(fail.met, false);
      assert.match(fail.reason!, /cast at least one spell/i);

      const pass = validateFeatPrerequisites(wizard, { name: "War Caster", prerequisite: "The ability to cast at least one spell" });
      assert.equal(pass.met, true);
    });
  });

  describe("Level Prerequisites", () => {
    it("validates Level 4 requirement", () => {
      const lvl1 = makeChar({ classes: [{ className: "Fighter", level: 1, source: "PHB" }] });
      const lvl4 = makeChar({ classes: [{ className: "Fighter", level: 4, source: "PHB" }] });

      const fail = validateFeatPrerequisites(lvl1, { name: "Ember of the Fire Giant", prerequisite: "Level 4; strike of the giants" });
      assert.equal(fail.met, false);
      assert.match(fail.reason!, /Level 4/i);

      lvl4.originFeats = [{ level: 1, type: "feat", featName: "Strike of the Giants" }];
      const pass = validateFeatPrerequisites(lvl4, { name: "Ember of the Fire Giant", prerequisite: "Level 4; strike of the giants" });
      assert.equal(pass.met, true);
    });
  });

  describe("Racial Prerequisites", () => {
    it("validates elf or half-elf requirement", () => {
      const human = makeChar({ race: { name: "Human", source: "PHB" } });
      const elf = makeChar({ race: { name: "Elf", subraceName: "High Elf", source: "PHB" } });
      const halfElf = makeChar({ race: { name: "Half-Elf", source: "PHB" } });

      const fail = validateFeatPrerequisites(human, { name: "Elven Accuracy", prerequisite: "elf or half-elf" });
      assert.equal(fail.met, false);
      assert.match(fail.reason!, /elf or half-elf/i);

      const passElf = validateFeatPrerequisites(elf, { name: "Elven Accuracy", prerequisite: "elf or half-elf" });
      assert.equal(passElf.met, true);

      const passHalfElf = validateFeatPrerequisites(halfElf, { name: "Elven Accuracy", prerequisite: "elf or half-elf" });
      assert.equal(passHalfElf.met, true);
    });

    it("validates dwarf requirement", () => {
      const human = makeChar({ race: { name: "Human", source: "PHB" } });
      const dwarf = makeChar({ race: { name: "Dwarf", subraceName: "Hill Dwarf", source: "PHB" } });

      const fail = validateFeatPrerequisites(human, { name: "Dwarven Fortitude", prerequisite: "dwarf" });
      assert.equal(fail.met, false);

      const pass = validateFeatPrerequisites(dwarf, { name: "Dwarven Fortitude", prerequisite: "dwarf" });
      assert.equal(pass.met, true);
    });
  });
});

describe("Origin Feat Application and Half-Feat Ability Increases", () => {
  it("applies an origin feat and includes half-feat +1 in effectiveScores", () => {
    let char = makeChar({ baseAbilityScores: { str: 10, dex: 15, con: 14, int: 10, wis: 10, cha: 10 } });

    // Athlete half-feat adding +1 to Dex
    char = applyOriginFeat(char, {
      level: 1,
      type: "feat",
      featName: "Athlete",
      featSource: "PHB",
      featAbility: "dex",
    });

    assert.equal(char.originFeats?.length, 1);
    assert.equal(hasFeat(char, "Athlete"), true);

    const { scores } = effectiveScores(char);
    assert.equal(scores.dex, 16);
  });

  it("removes an origin feat and reverts effectiveScores", () => {
    let char = makeChar({ baseAbilityScores: { str: 10, dex: 15, con: 14, int: 10, wis: 10, cha: 10 } });
    char = applyOriginFeat(char, {
      level: 1,
      type: "feat",
      featName: "Athlete",
      featSource: "PHB",
      featAbility: "dex",
    });
    assert.equal(effectiveScores(char).scores.dex, 16);

    char = removeOriginFeat(char, { featName: "Athlete", featSource: "PHB" });
    assert.equal(char.originFeats?.length, 0);
    assert.equal(hasFeat(char, "Athlete"), false);
    assert.equal(effectiveScores(char).scores.dex, 15);
  });

  it("replaces existing ancestry feat when oldFeatName is passed", () => {
    let char = makeChar({ baseAbilityScores: { str: 10, dex: 15, con: 14, int: 10, wis: 10, cha: 10 } });
    char = applyOriginFeat(char, {
      level: 1,
      type: "feat",
      featName: "Athlete",
      featSource: "PHB",
      featAbility: "dex",
    });
    assert.equal(char.originFeats?.length, 1);
    assert.equal(hasFeat(char, "Athlete"), true);

    // Replace Athlete with Alert
    char = applyOriginFeat(
      char,
      {
        level: 1,
        type: "feat",
        featName: "Alert",
        featSource: "PHB",
      },
      { featName: "Athlete", featSource: "PHB" }
    );
    assert.equal(char.originFeats?.length, 1);
    assert.equal(hasFeat(char, "Alert"), true);
    assert.equal(hasFeat(char, "Athlete"), false);
    assert.equal(effectiveScores(char).scores.dex, 15);
  });

  it("replacing Fighting Initiate with Alert prunes its style pick and records a review notice", () => {
    let char = makeChar({
      classes: [{ className: "Fighter", source: "PHB", level: 1 }],
      ruleChoices: [
        {
          id: FIGHTING_INITIATE_CHOICE_ID,
          trait: "Fighting Initiate Style",
          origin: "class",
          choose: 1,
          from: ["Archery", "Defense"],
          picked: ["Archery"],
        },
      ],
    });
    char = applyOriginFeat(char, {
      level: 1,
      type: "feat",
      featName: "Fighting Initiate",
      featSource: "TCE",
    });
    assert.equal(char.ruleChoices?.some((rc) => rc.id === FIGHTING_INITIATE_CHOICE_ID), true, "the style pick survives while the feat is held");

    char = applyOriginFeat(
      char,
      { level: 1, type: "feat", featName: "Alert", featSource: "PHB" },
      { featName: "Fighting Initiate", featSource: "TCE" }
    );

    assert.equal(char.ruleChoices?.some((rc) => rc.id === FIGHTING_INITIATE_CHOICE_ID), false, "the replaced feat's style pick is gone");
    assert.equal(hasFeat(char, "Fighting Initiate"), false);
    assert.ok(
      char.needsReview?.some((note) => note.includes("Fighting Initiate Style removed")),
      "a review notice names the removed Fighting Initiate style"
    );
  });
});

describe("Background Feat Grants", () => {
  it("detects Strike of the Giants for Giant Foundling", () => {
    const grant = getBackgroundFeatGrant("Giant Foundling");
    assert.ok(grant);
    assert.equal(grant?.featName, "Strike of the Giants");
  });

  it("detects Rune Shaper for Rune Carver", () => {
    const grant = getBackgroundFeatGrant("Rune Carver");
    assert.ok(grant);
    assert.equal(grant?.featName, "Rune Shaper");
  });

  it("returns null for standard PHB backgrounds like Acolyte", () => {
    const grant = getBackgroundFeatGrant("Acolyte");
    assert.equal(grant, null);
  });
});

describe("Removing an origin feat reconciles the choices that depended on it", () => {
  const fighterStyle: RuleChoiceEntry = {
    id: "PHB__Fighter__Fighting Style",
    trait: "Fighting Style",
    origin: "class",
    choose: 1,
    from: [],
    picked: ["Dueling"],
  };
  const initiateStyle: RuleChoiceEntry = {
    id: "TCE__Feat__Fighting Initiate__Style",
    trait: "Fighting Initiate Style",
    origin: "class",
    choose: 1,
    from: [],
    picked: ["Archery"],
  };
  const fighter4 = [{ className: "Fighter", source: "PHB", level: 4 }];

  it("removes the Fighting Initiate style it granted and records a review notice", () => {
    const char = makeChar({
      classes: fighter4,
      originFeats: [{ level: 1, type: "feat", featName: "Fighting Initiate", featSource: "PHB" }],
      ruleChoices: [fighterStyle, initiateStyle],
    });

    const updated = removeOriginFeat(char, { featName: "Fighting Initiate", featSource: "PHB" }, inMemoryCompendium({}));

    assert.deepEqual(updated.ruleChoices, [fighterStyle]);
    assert.deepEqual(updated.needsReview, [
      "Fighting Initiate Style removed: prerequisite no longer satisfied",
    ]);
  });

  it("keeps the style when a different held feat still grants Fighting Initiate", () => {
    const char = makeChar({
      classes: fighter4,
      asiSelections: [
        { level: 4, className: "Fighter", classLevel: 4, type: "feat", featName: "Fighting Initiate", featSource: "PHB" },
      ],
      originFeats: [{ level: 1, type: "feat", featName: "Alert", featSource: "PHB" }],
      ruleChoices: [fighterStyle, initiateStyle],
    });

    const updated = removeOriginFeat(char, { featName: "Alert", featSource: "PHB" }, inMemoryCompendium({}));

    assert.deepEqual(updated.ruleChoices, [fighterStyle, initiateStyle]);
    assert.deepEqual(updated.needsReview ?? [], []);
  });
});
