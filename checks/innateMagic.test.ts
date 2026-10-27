import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import { applyLongRest } from "../src/rules/rest.ts";

// Race and subrace spells come from the Catalog (ADR 0017): see grantedRaceSpells.test.ts, grantedRacePicks.test.ts and liveCatalog.test.ts.

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
});
