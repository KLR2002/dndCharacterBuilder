import test from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { skills } from "../src/rules/skills.ts";
import {
  evaluateCharacterTools,
  isToolExpertise,
  hasArtificerToolExpertise,
  type EvaluatedTool,
} from "../src/rules/tools.ts";
import {
  getAvailableExpertiseMilestones,
  getMilestonePicks,
  toggleExpertiseChoice,
} from "../src/rules/expertise.ts";
import type { Character } from "../src/types/character.ts";
import { loadTestCatalog, inMemoryCompendium } from "./testUtils.ts";

const races = loadTestCatalog("races");
const classes = loadTestCatalog("classes");
const backgrounds = loadTestCatalog("backgrounds");

function makeTestChar(overrides: Partial<Character> = {}): Character {
  return {
    id: "test_char",
    name: "Skill Master",
    createdAt: 1,
    updatedAt: 1,
    avatarUri: null,
    abilityMethod: "pointBuy",
    baseAbilityScores: { str: 10, dex: 16, con: 12, int: 14, wis: 10, cha: 10 },
    racialAbilityBonuses: {},
    race: null,
    background: null,
    startingOption: "equipment",
    classes: [],
    chosenSkills: [],
    chosenExpertise: [],
    asiSelections: [],
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
    useWeightLimit: true,
    resourceCounters: {},
    description: "",
    backstory: "",
    personalityTraits: "",
    ideals: "",
    bonds: "",
    flaws: "",
    ...overrides,
  };
}

test("skills: calculates Expertise (2x PB) bonus for skills in chosenExpertise", () => {
  const char = makeTestChar({
    classes: [{ className: "Rogue", level: 1, source: "PHB" }], // PB = 2, Dex = 16 (+3)
    chosenSkills: ["Stealth", "Acrobatics"],
    chosenExpertise: ["Stealth"],
  });
  const skillList = skills(char);

  const stealth = skillList.find((s) => s.name === "Stealth");
  assert.ok(stealth);
  assert.equal(stealth.isProficient, true);
  assert.equal(stealth.isExpertise, true);
  assert.equal(stealth.bonus, 3 + 2 * 2, "Stealth bonus should be Dex (+3) + 2*PB (+4) = +7");

  const acrobatics = skillList.find((s) => s.name === "Acrobatics");
  assert.ok(acrobatics);
  assert.equal(acrobatics.isProficient, true);
  assert.equal(acrobatics.isExpertise, false);
  assert.equal(acrobatics.bonus, 3 + 2, "Acrobatics bonus should be Dex (+3) + 1*PB (+2) = +5");
});

test("tools: Thieves' Tools calculates Dex modifier (+3) and double PB (+4) with expertise", () => {
  const char = makeTestChar({
    classes: [{ className: "Rogue", level: 1, source: "PHB" }], // PB = 2, Dex = 16 (+3)
    chosenTools: { class: ["Thieves' Tools"] },
    chosenExpertise: ["Thieves' Tools"],
  });

  const tools = evaluateCharacterTools(char, { compendium: inMemoryCompendium({ classes }) });
  const thievesTools = tools.find((t) => t.name.toLowerCase() === "thieves' tools");
  assert.ok(thievesTools);
  assert.equal(thievesTools.isExpertise, true);
  assert.equal(thievesTools.ability, "dex");
  assert.equal(thievesTools.bonus, 7, "Dex (+3) + 2*PB (+4) = +7");
  assert.equal(thievesTools.displayModifier, "+7");
});

test("tools: Musical instrument calculates Cha modifier with expertise", () => {
  const char = makeTestChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 }, // Cha = +3
    classes: [{ className: "Bard", level: 3, source: "PHB" }], // PB = 2
    chosenTools: { class: ["Lute"] },
    chosenExpertise: ["Lute"],
  });

  const tools = evaluateCharacterTools(char, { compendium: inMemoryCompendium({ classes }) });
  const lute = tools.find((t) => t.name.toLowerCase() === "lute");
  assert.ok(lute);
  assert.equal(lute.isExpertise, true);
  assert.equal(lute.ability, "cha");
  assert.equal(lute.bonus, 7, "Cha (+3) + 2*PB (+4) = +7");
  assert.equal(lute.displayModifier, "+7");
});

test("tools: Artisan's tools without canonical ability display flat PB modifier", () => {
  const char = makeTestChar({
    classes: [{ className: "Fighter", level: 1, source: "PHB" }], // PB = 2
    chosenTools: { background: ["Alchemist's Supplies"] },
  });

  const tools = evaluateCharacterTools(char, { compendium: inMemoryCompendium({ classes }) });
  const alchemist = tools.find((t) => t.name.toLowerCase() === "alchemist's supplies");
  assert.ok(alchemist);
  assert.equal(alchemist.isExpertise, false);
  assert.equal(alchemist.ability, undefined);
  assert.equal(alchemist.bonus, 2, "PB = +2");
  assert.equal(alchemist.displayModifier, "+2 PB");
});

test("tools: Artificer level 6 automatically grants Tool Expertise to all tools", () => {
  const char = makeTestChar({
    baseAbilityScores: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", level: 6, source: "TCE" }], // PB = 3, Dex = +2
    chosenTools: {
      class: ["Thieves' Tools", "Tinker's Tools", "Alchemist's Supplies"],
    },
    chosenExpertise: [], // empty manual picks!
  });

  assert.equal(hasArtificerToolExpertise(char), true);
  assert.equal(isToolExpertise("Thieves' Tools", char), true);
  assert.equal(isToolExpertise("Alchemist's Supplies", char), true);

  const tools = evaluateCharacterTools(char, { compendium: inMemoryCompendium({ classes }) });
  const thieves = tools.find((t) => t.name.toLowerCase() === "thieves' tools");
  assert.ok(thieves);
  assert.equal(thieves.isExpertise, true);
  assert.equal(thieves.bonus, 2 + 2 * 3, "Dex (+2) + 2*PB (+6) = +8");
  assert.equal(thieves.displayModifier, "+8");

  const alchemist = tools.find((t) => t.name.toLowerCase() === "alchemist's supplies");
  assert.ok(alchemist);
  assert.equal(alchemist.isExpertise, true);
  assert.equal(alchemist.displayModifier, "+6 PB");
});

test("evaluateCharacter integration: populates evaluated.tools with full expertise details", () => {
  const char = makeTestChar({
    classes: [{ className: "Rogue", level: 1, source: "PHB" }],
    chosenSkills: ["Stealth"],
    chosenTools: { class: ["Thieves' Tools"] },
    chosenExpertise: ["Stealth", "Thieves' Tools"],
  });

  const evaluated = evaluateCharacter(char, { compendium: inMemoryCompendium({ races, classes, backgrounds }) });
  assert.ok(evaluated.tools);
  assert.equal(evaluated.tools.length, 1);
  assert.equal(evaluated.tools[0].name, "Thieves' Tools");
  assert.equal(evaluated.tools[0].isExpertise, true);
  assert.equal(evaluated.tools[0].displayModifier, "+7");
});

test("milestones: Rogue 1 and Rogue 6 generate milestone cards with proficient options", () => {
  const char = makeTestChar({
    classes: [{ className: "Rogue", level: 6, source: "PHB" }],
    chosenSkills: ["Stealth", "Acrobatics", "Deception", "Insight"],
    chosenTools: { class: ["Thieves' Tools"] },
  });

  const milestones = getAvailableExpertiseMilestones(char, { compendium: inMemoryCompendium({ classes }) });
  assert.equal(milestones.length, 2);
  assert.equal(milestones[0].id, "rogue_1");
  assert.equal(milestones[0].count, 2);
  assert.ok(milestones[0].options.includes("Stealth"));
  assert.ok(milestones[0].options.includes("Thieves' Tools"));

  assert.equal(milestones[1].id, "rogue_6");
  assert.equal(milestones[1].count, 2);
  assert.ok(milestones[1].options.includes("Acrobatics"));
});

test("milestones: Bard 3 and Bard 10 generate milestone cards", () => {
  const char = makeTestChar({
    classes: [{ className: "Bard", level: 10, source: "PHB" }],
    chosenSkills: ["Performance", "Persuasion", "Deception", "Insight"],
  });

  const milestones = getAvailableExpertiseMilestones(char, { compendium: inMemoryCompendium({ classes }) });
  assert.equal(milestones.length, 2);
  assert.equal(milestones[0].id, "bard_3");
  assert.equal(milestones[0].count, 2);
  assert.equal(milestones[1].id, "bard_10");
  assert.equal(milestones[1].count, 2);
});

test("milestones: Knowledge Domain Cleric grants Arcana/History/Nature/Religion", () => {
  const char = makeTestChar({
    classes: [{ className: "Cleric", level: 1, source: "PHB", subclassName: "Knowledge Domain" }],
    chosenExpertise: ["Arcana", "History"],
  });

  const milestones = getAvailableExpertiseMilestones(char, { compendium: inMemoryCompendium({ classes }) });
  assert.equal(milestones.length, 1);
  assert.equal(milestones[0].id, "cleric_knowledge_1");
  assert.deepEqual(milestones[0].options, ["Arcana", "History", "Nature", "Religion"]);

  // Knowledge Cleric chosen skills become proficient automatically
  const skillList = skills(char);
  const arcana = skillList.find((s) => s.name === "Arcana");
  assert.ok(arcana);
  assert.equal(arcana.isProficient, true);
  assert.equal(arcana.isExpertise, true);
});

test("milestones: Deft Explorer Ranger Canny grants 1 pick from proficient skills", () => {
  const char = makeTestChar({
    classes: [{ className: "Ranger", level: 1, source: "PHB" }],
    optionalFeatureReplacements: { "Natural Explorer": true },
    chosenSkills: ["Survival", "Stealth"],
  });

  const milestones = getAvailableExpertiseMilestones(char, { compendium: inMemoryCompendium({ classes }) });
  assert.equal(milestones.length, 1);
  assert.equal(milestones[0].id, "ranger_deft_explorer_1");
  assert.equal(milestones[0].count, 1);
  assert.ok(milestones[0].options.includes("Survival"));
});

test("getMilestonePicks partitions chosenExpertise cleanly across milestones", () => {
  const char = makeTestChar({
    classes: [{ className: "Rogue", level: 6, source: "PHB" }],
    chosenSkills: ["Stealth", "Acrobatics", "Deception", "Insight"],
    chosenTools: { class: ["Thieves' Tools"] },
    chosenExpertise: ["Stealth", "Thieves' Tools", "Acrobatics"],
  });

  const milestones = getAvailableExpertiseMilestones(char, { compendium: inMemoryCompendium({ classes }) });
  const picks = getMilestonePicks(milestones, char.chosenExpertise);

  assert.equal(picks.length, 2);
  assert.deepEqual(picks[0].chosen, ["Stealth", "Thieves' Tools"]);
  assert.deepEqual(picks[1].chosen, ["Acrobatics"]);
  assert.ok(!picks[1].from.includes("Stealth"), "Stealth already claimed in milestone 1");
});

test("toggleExpertiseChoice: toggles selection within capacity", () => {
  let char = makeTestChar({
    classes: [{ className: "Rogue", level: 1, source: "PHB" }], // capacity 2
    chosenSkills: ["Stealth", "Acrobatics", "Insight"],
  });

  char = toggleExpertiseChoice(char, "Stealth", { compendium: inMemoryCompendium({ classes }) });
  assert.deepEqual(char.chosenExpertise, ["Stealth"]);

  char = toggleExpertiseChoice(char, "Acrobatics", { compendium: inMemoryCompendium({ classes }) });
  assert.deepEqual(char.chosenExpertise, ["Stealth", "Acrobatics"]);

  // Attempting 3rd pick exceeds capacity of 2
  char = toggleExpertiseChoice(char, "Insight", { compendium: inMemoryCompendium({ classes }) });
  assert.deepEqual(char.chosenExpertise, ["Stealth", "Acrobatics"]);

  // Toggling selected removes it
  char = toggleExpertiseChoice(char, "Stealth", { compendium: inMemoryCompendium({ classes }) });
  assert.deepEqual(char.chosenExpertise, ["Acrobatics"]);
});

test("reconcile: removes unproficient choices or excess when deleveling", () => {
  const char = makeTestChar({
    classes: [{ className: "Rogue", level: 1, source: "PHB" }], // capacity 2
    chosenSkills: ["Stealth"], // Only Stealth is proficient!
    chosenExpertise: ["Stealth", "Acrobatics", "Arcana"], // Arcana and Acrobatics are not proficient
  });

  const pruned = reconcile(char, inMemoryCompendium({ classes }));
  assert.deepEqual(pruned.chosenExpertise, ["Stealth"]);
});
