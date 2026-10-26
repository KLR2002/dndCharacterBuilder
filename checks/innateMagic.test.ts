import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import { getInnateSpellProfile } from "../src/rules/innateMagic.ts";
import { applyLongRest } from "../src/rules/rest.ts";

// Race and subrace spells come from the Catalog (ADR 0017): see grantedRaceSpells.test.ts and liveCatalog.test.ts. Only the
// High Elf and half-elf descent cantrip is read here, until ticket 07 moves it.

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: "test-innate",
    name: "Caster",
    folderId: null,
    gender: "Other",
    alignment: "Neutral",
    faction: { name: "", rank: "", renown: "", notes: "" },
    avatarUri: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    abilityMethod: "standardArray",
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 14, wis: 12, cha: 16 },
    customLineage: false,
    lineageReplacement: null,
    race: { name: "Elf", subraceName: "Dark Elf (Drow)", source: "PHB" },
    racialAbilityBonuses: {},
    background: { name: "Sage", source: "PHB" },
    startingOption: "equipment",
    classes: [{ className: "Rogue", level: 1, source: "PHB" }],
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

describe("Innate Magic Rules", () => {
  describe("Daily Spell Usage and Long Rest Integration", () => {
    it("spending daily racial spell use increments resource counter, reset on Long Rest", () => {
      let char = makeChar({
        classes: [{ className: "Rogue", level: 3, source: "PHB" }],
        resourceCounters: {
          "innate_spell_faerie_fire": {
            id: "innate_spell_faerie_fire",
            name: "Innate: Faerie Fire",
            current: 0, // spent use (0 remaining)
            max: 1,
            resetOn: "long",
          },
        },
      });

      assert.equal(char.resourceCounters["innate_spell_faerie_fire"].current, 0);

      // Take long rest
      char = applyLongRest(char);
      assert.equal(char.resourceCounters["innate_spell_faerie_fire"].current, 1);
    });
  });

  describe("High Elf Cantrip", () => {
    it("includes chosen high elf cantrip in innate profile with INT ability", () => {
      const highElf = makeChar({
        race: { name: "Elf", subraceName: "High Elf", source: "PHB" },
        ruleChoices: [
          {
            id: "PHB__Elf__PHB__High Elf__Cantrip",
            origin: "High Elf",
            choose: 1,
            from: [],
            picked: ["Fire Bolt"],
          },
        ],
      });
      const profile = getInnateSpellProfile(highElf);
      assert.ok(profile);
      assert.equal(profile?.ability, "int");
      assert.ok(profile?.spells.some(s => s.name === "Fire Bolt"));
    });

    it("matches PHB subrace name 'High' as well as 'High Elf'", () => {
      const highElfPhb = makeChar({
        race: { name: "Elf", subraceName: "High", source: "PHB" },
        ruleChoices: [
          {
            id: "PHB__Elf__PHB__High Elf__Cantrip",
            origin: "High Elf",
            choose: 1,
            from: [],
            picked: ["Prestidigitation"],
          },
        ],
      });
      const profile = getInnateSpellProfile(highElfPhb);
      assert.ok(profile);
      assert.ok(profile?.spells.some(s => s.name === "Prestidigitation"));
    });

    it("Half-Elf with Moon Elf or Sun Elf Descent gets cantrip when Cantrip feature is chosen", () => {
      const halfElf = makeChar({
        race: { name: "Half-Elf", subraceName: "Moon Elf or Sun Elf Descent", source: "PHB" },
        ruleChoices: [
          {
            id: "SCAG__Half-Elf__Moon Elf or Sun Elf Descent__Variant Feature (Choose 1)",
            origin: "race",
            choose: 1,
            from: ["Skill Versatility", "Elf Weapon Training", "Cantrip"],
            picked: ["Cantrip"],
          },
          {
            id: "PHB__Elf__PHB__High Elf__Cantrip",
            origin: "race",
            choose: 1,
            from: [],
            picked: ["Minor Illusion"],
          },
        ],
      });
      const profile = getInnateSpellProfile(halfElf);
      assert.ok(profile);
      assert.equal(profile?.ability, "int");
      assert.ok(profile?.spells.some(s => s.name === "Minor Illusion"));
    });

    it("Half-Elf with Moon Elf or Sun Elf Descent does NOT get cantrip when Skill Versatility is chosen", () => {
      const halfElf = makeChar({
        race: { name: "Half-Elf", subraceName: "Moon Elf or Sun Elf Descent", source: "PHB" },
        ruleChoices: [
          {
            id: "SCAG__Half-Elf__Moon Elf or Sun Elf Descent__Variant Feature (Choose 1)",
            origin: "race",
            choose: 1,
            from: ["Skill Versatility", "Elf Weapon Training", "Cantrip"],
            picked: ["Skill Versatility"],
          },
          {
            id: "PHB__Elf__PHB__High Elf__Cantrip",
            origin: "race",
            choose: 1,
            from: [],
            picked: ["Minor Illusion"],
          },
        ],
      });
      const profile = getInnateSpellProfile(halfElf);
      assert.equal(profile, null);
    });
  });
});
