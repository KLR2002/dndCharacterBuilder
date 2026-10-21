import type { AbilityKey } from "../types/character.ts";

/** The Spell Owner key for a Path of the Giant Barbarian's granted cantrips (Druidcraft, Thaumaturgy). */
export const GIANT_BARBARIAN_OWNER_KEY = "Barbarian__BGG";

/** The cantrips a Path of the Giant Barbarian may take as its Giant Power cantrip (lowercase names). */
export const GIANT_POWER_CANTRIPS: ReadonlySet<string> = new Set(["druidcraft", "thaumaturgy"]);

export interface SkillDefinition {
  name: string;
  ability: AbilityKey;
}

export const DND_SKILLS: SkillDefinition[] = [
  { name: "Athletics", ability: "str" },
  { name: "Acrobatics", ability: "dex" },
  { name: "Sleight of Hand", ability: "dex" },
  { name: "Stealth", ability: "dex" },
  { name: "Arcana", ability: "int" },
  { name: "History", ability: "int" },
  { name: "Investigation", ability: "int" },
  { name: "Nature", ability: "int" },
  { name: "Religion", ability: "int" },
  { name: "Animal Handling", ability: "wis" },
  { name: "Insight", ability: "wis" },
  { name: "Medicine", ability: "wis" },
  { name: "Perception", ability: "wis" },
  { name: "Survival", ability: "wis" },
  { name: "Deception", ability: "cha" },
  { name: "Intimidation", ability: "cha" },
  { name: "Performance", ability: "cha" },
  { name: "Persuasion", ability: "cha" },
];

export const POINT_BUY_COST: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// Multiclassing Prerequisite Scores
export const MULTICLASS_PREREQUISITES: Record<string, { ability: AbilityKey; minScore: number }[] | { or: { ability: AbilityKey; minScore: number }[] }> = {
  Barbarian: [{ ability: "str", minScore: 13 }],
  Bard: [{ ability: "cha", minScore: 13 }],
  Cleric: [{ ability: "wis", minScore: 13 }],
  Druid: [{ ability: "wis", minScore: 13 }],
  Fighter: { or: [{ ability: "str", minScore: 13 }, { ability: "dex", minScore: 13 }] },
  Monk: [{ ability: "dex", minScore: 13 }, { ability: "wis", minScore: 13 }],
  Paladin: [{ ability: "str", minScore: 13 }, { ability: "cha", minScore: 13 }],
  Ranger: [{ ability: "dex", minScore: 13 }, { ability: "wis", minScore: 13 }],
  Rogue: [{ ability: "dex", minScore: 13 }],
  Sorcerer: [{ ability: "cha", minScore: 13 }],
  Warlock: [{ ability: "cha", minScore: 13 }],
  Wizard: [{ ability: "int", minScore: 13 }],
  Artificer: [{ ability: "int", minScore: 13 }],
};

// Multiclass Proficiencies Gained
export const MULTICLASS_PROFICIENCIES: Record<string, {
  armor?: string[];
  weapons?: string[];
  tools?: string[];
  skills?: string;
}> = {
  Barbarian: {
    armor: ["Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
  },
  Bard: {
    armor: ["Light armor"],
    skills: "One skill of your choice",
    tools: ["One musical instrument of your choice"],
  },
  Cleric: {
    armor: ["Light armor", "Medium armor", "Shields"],
  },
  Druid: {
    armor: ["Light armor", "Medium armor", "Shields"],
  },
  Fighter: {
    armor: ["Light armor", "Medium armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
  },
  Monk: {
    weapons: ["Simple weapons", "Shortswords"],
  },
  Paladin: {
    armor: ["Light armor", "Medium armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
  },
  Ranger: {
    armor: ["Light armor", "Medium armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
  },
  Rogue: {
    armor: ["Light armor"],
    tools: ["Thieves' tools"],
    skills: "One skill from the Rogue skill list",
  },
  Sorcerer: {},
  Warlock: {
    armor: ["Light armor"],
    weapons: ["Simple weapons"],
  },
  Wizard: {},
  Artificer: {
    armor: ["Light armor", "Medium armor", "Shields"],
    tools: ["Thieves' tools", "Tinker's tools"],
  },
};

// Multiclass Spell Slots Table: slots per spell level (1-9) for combined caster level 1-20
export const MULTICLASS_SPELL_SLOTS: Record<number, number[]> = {
  1:  [2],
  2:  [3],
  3:  [4, 2],
  4:  [4, 3],
  5:  [4, 3, 2],
  6:  [4, 3, 3],
  7:  [4, 3, 3, 1],
  8:  [4, 3, 3, 2],
  9:  [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

// Warlock Pact Magic slots by warlock level
export const WARLOCK_PACT_SLOTS: Record<number, { slotCount: number; slotLevel: number }> = {
  1:  { slotCount: 1, slotLevel: 1 },
  2:  { slotCount: 2, slotLevel: 1 },
  3:  { slotCount: 2, slotLevel: 2 },
  4:  { slotCount: 2, slotLevel: 2 },
  5:  { slotCount: 2, slotLevel: 3 },
  6:  { slotCount: 2, slotLevel: 3 },
  7:  { slotCount: 2, slotLevel: 4 },
  8:  { slotCount: 2, slotLevel: 4 },
  9:  { slotCount: 2, slotLevel: 5 },
  10: { slotCount: 2, slotLevel: 5 },
  11: { slotCount: 3, slotLevel: 5 },
  12: { slotCount: 3, slotLevel: 5 },
  13: { slotCount: 3, slotLevel: 5 },
  14: { slotCount: 3, slotLevel: 5 },
  15: { slotCount: 3, slotLevel: 5 },
  16: { slotCount: 3, slotLevel: 5 },
  17: { slotCount: 4, slotLevel: 5 },
  18: { slotCount: 4, slotLevel: 5 },
  19: { slotCount: 4, slotLevel: 5 },
  20: { slotCount: 4, slotLevel: 5 },
};
