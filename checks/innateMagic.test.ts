import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../src/types/character.ts";
import { getInnateSpellProfile } from "../src/rules/innateMagic.ts";
import { applyLongRest } from "../src/rules/rest.ts";

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
  describe("Drow Innate Spells", () => {
    it("unlocks Dancing Lights at level 1", () => {
      const drow = makeChar({ classes: [{ className: "Rogue", level: 1, source: "PHB" }] });
      const profile = getInnateSpellProfile(drow);
      assert.ok(profile);
      assert.equal(profile?.ability, "cha");
      assert.equal(profile?.spellSaveDc, 13); // 8 + 2 (pb) + 3 (cha 16)
      assert.equal(profile?.spellAttackBonus, 5); // 2 + 3

      const spells = profile?.spells.map(s => s.name);
      assert.ok(spells?.includes("Dancing Lights"));
      assert.ok(!spells?.includes("Faerie Fire"));
      assert.ok(!spells?.includes("Darkness"));
    });

    it("unlocks Faerie Fire at level 3 and Darkness at level 5", () => {
      const drow3 = makeChar({ classes: [{ className: "Rogue", level: 3, source: "PHB" }] });
      const profile3 = getInnateSpellProfile(drow3);
      assert.ok(profile3?.spells.some(s => s.name === "Faerie Fire"));
      assert.ok(!profile3?.spells.some(s => s.name === "Darkness"));

      const drow5 = makeChar({ classes: [{ className: "Rogue", level: 5, source: "PHB" }] });
      const profile5 = getInnateSpellProfile(drow5);
      assert.ok(profile5?.spells.some(s => s.name === "Faerie Fire"));
      assert.ok(profile5?.spells.some(s => s.name === "Darkness"));
    });
  });

  describe("Tiefling Infernal Legacy", () => {
    it("unlocks Thaumaturgy, Hellish Rebuke at 3, and Darkness at 5", () => {
      const tiefling1 = makeChar({
        race: { name: "Tiefling", source: "PHB" },
        classes: [{ className: "Fighter", level: 1, source: "PHB" }],
      });
      const p1 = getInnateSpellProfile(tiefling1);
      assert.ok(p1?.spells.some(s => s.name === "Thaumaturgy"));
      assert.ok(!p1?.spells.some(s => s.name === "Hellish Rebuke"));

      const tiefling3 = makeChar({
        race: { name: "Tiefling", source: "PHB" },
        classes: [{ className: "Fighter", level: 3, source: "PHB" }],
      });
      const p3 = getInnateSpellProfile(tiefling3);
      assert.ok(p3?.spells.some(s => s.name === "Hellish Rebuke"));
      assert.ok(!p3?.spells.some(s => s.name === "Darkness"));

      const tiefling5 = makeChar({
        race: { name: "Tiefling", source: "PHB" },
        classes: [{ className: "Fighter", level: 5, source: "PHB" }],
      });
      const p5 = getInnateSpellProfile(tiefling5);
      assert.ok(p5?.spells.some(s => s.name === "Darkness"));
    });
  });

  describe("Gith Psionics", () => {
    it("Githyanki grants Mage Hand, Jump at 3, Misty Step at 5 using INT", () => {
      const gith = makeChar({
        race: { name: "Githyanki", source: "MToF" },
        baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
        classes: [{ className: "Fighter", level: 5, source: "PHB" }],
      });
      const profile = getInnateSpellProfile(gith);
      assert.ok(profile);
      assert.equal(profile?.ability, "int");
      assert.equal(profile?.spellSaveDc, 14); // 8 + 3 (pb at lvl 5) + 3 (int 16)
      assert.ok(profile?.spells.some(s => s.name === "Mage Hand"));
      assert.ok(profile?.spells.some(s => s.name === "Jump"));
      assert.ok(profile?.spells.some(s => s.name === "Misty Step"));
    });
  });

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

  describe("Deep Gnome Svirfneblin Magic", () => {
    it("unlocks Disguise Self and Nondetection at level 3 using INT", () => {
      const deepGnome1 = makeChar({
        race: { name: "Gnome", subraceName: "Deep Gnome", source: "MToF" },
        classes: [{ className: "Fighter", level: 1, source: "PHB" }],
      });
      const p1 = getInnateSpellProfile(deepGnome1);
      assert.equal(p1, null);

      const deepGnome3 = makeChar({
        race: { name: "Gnome", subraceName: "Deep Gnome", source: "MToF" },
        classes: [{ className: "Fighter", level: 3, source: "PHB" }],
      });
      const p3 = getInnateSpellProfile(deepGnome3);
      assert.ok(p3);
      assert.equal(p3?.ability, "int");
      assert.ok(p3?.spells.some(s => s.name === "Disguise Self"));
      assert.ok(p3?.spells.some(s => s.name === "Nondetection"));
    });
  });
});
