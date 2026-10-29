import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalogs, inMemoryCompendium } from "./testUtils.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";

const catalogs = { compendium: inMemoryCompendium(loadTestCatalogs()), activeBooks: ALL_BOOKS };
const cl = (className: string, level: number) => ({ className, source: "PHB", level });
const scores = (overrides: Record<string, number>) => ({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...overrides });

test("evaluateCharacter lists an Artificer as a caster, alone and with a Wizard", () => {
  const artificer = (level: number) => ({ className: "Artificer", source: "TCE", level });
  const [lone] = evaluateCharacter(makeChar({ classes: [artificer(5)] }), catalogs).spellProfiles;
  assert.equal(lone.className, "Artificer");
  assert.equal(lone.ability, "int");
  assert.equal(lone.maxSpellLevel, 2);

  const pooled = evaluateCharacter(makeChar({ classes: [cl("Wizard", 3), artificer(3)] }), catalogs).spellProfiles;
  assert.deepEqual(pooled.map((p) => p.className).sort(), ["Artificer", "Wizard"]);
});

test("evaluateCharacter evaluates single-class Fighter 1", () => {
  const char = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: scores({ str: 16, dex: 14, con: 14 }),
    items: [
      { id: "chain_mail", name: "Chain Mail", source: "PHB", ac: 16, isEquipped: true, section: "equipped", quantity: 1, weight: 55 },
      { id: "shield", name: "Shield", source: "PHB", ac: 2, isEquipped: true, section: "equipped", quantity: 1, weight: 6 },
    ],
  });

  const evaluated = evaluateCharacter(char, catalogs);
  assert.equal(evaluated.totalLevel, 1);
  assert.equal(evaluated.proficiencyBonus, 2);
  assert.equal(evaluated.effectiveScores.scores.str, 16);
  assert.equal(evaluated.effectiveScores.modifiers.str, 3);
  assert.equal(evaluated.effectiveScores.modifiers.dex, 2);
  assert.equal(evaluated.armorClass.ac, 18); // 16 (chain mail) + 2 (shield)
  assert.equal(evaluated.hp.max, 12); // 10 (d10 fighter) + 2 (con)
  assert.equal(evaluated.hitDice.d10.total, 1);
  assert.equal(evaluated.initiative, 2); // DEX mod
  assert.equal(evaluated.saves.str.proficient, true); // Fighter saves STR/CON
  assert.equal(evaluated.saves.con.proficient, true);
  assert.equal(evaluated.saves.dex.proficient, false);
});

test("evaluateCharacter evaluates multiclass Barbarian 1 / Bard 1 with Unarmored Defense", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 1), cl("Bard", 1)],
    baseAbilityScores: scores({ str: 16, dex: 14, con: 16, cha: 12 }),
  });

  const evaluated = evaluateCharacter(char, catalogs);
  assert.equal(evaluated.totalLevel, 2);
  assert.equal(evaluated.proficiencyBonus, 2);
  // Barbarian 1st: unarmored AC = 10 + 2 (DEX) + 3 (CON) = 15
  assert.equal(evaluated.armorClass.ac, 15);
  // Hit dice pools: 1d12 and 1d8
  assert.equal(evaluated.hitDice.d12.total, 1);
  assert.equal(evaluated.hitDice.d8.total, 1);
  // Max HP: Barbarian 12 + 3 (CON) = 15, Bard lvl 2: floor(8/2)+1 + 3 = 8 -> 15 + 8 = 23
  assert.equal(evaluated.hp.max, 23);
  // First class Barbarian saves: STR, CON
  assert.equal(evaluated.saves.str.proficient, true);
  assert.equal(evaluated.saves.con.proficient, true);
  assert.equal(evaluated.saves.cha.proficient, false);
});

test("evaluateCharacter resolves ancestry and background proficiencies in a single pass", () => {
  const char = makeChar({
    race: { name: "Elf", subraceName: "High", source: "PHB" },
    background: { name: "Acolyte", source: "PHB" },
    classes: [cl("Wizard", 1)],
    baseAbilityScores: scores({ int: 15, dex: 14 }),
  });

  const evaluated = evaluateCharacter(char, catalogs);
  // Elf gives +2 DEX, High Elf gives +1 INT
  assert.equal(evaluated.effectiveScores.scores.dex, 16);
  assert.equal(evaluated.effectiveScores.scores.int, 16);
  // High Elf weapon training: Longswords, Shortswords, Shortbows, Longbows
  assert.ok(evaluated.proficiencies.weapons.includes("Longswords"));
  // Perception from Elf keen senses
  assert.ok(evaluated.skills.some(s => s.name === "Perception" && s.isProficient));
  // Acolyte gives Insight & Religion
  assert.ok(evaluated.skills.some(s => s.name === "Insight" && s.isProficient));
  assert.ok(evaluated.skills.some(s => s.name === "Religion" && s.isProficient));
  // Passive perception = 10 + WIS mod (0) + PB (2) = 12
  assert.equal(evaluated.skills.find(s => s.name === "Perception")?.passiveBonus, 12);
});

test("evaluateCharacter respects unarmored defense precedence for Monk first", () => {
  const char = makeChar({
    classes: [cl("Monk", 1), cl("Barbarian", 1)],
    baseAbilityScores: scores({ str: 14, dex: 16, con: 16, wis: 14 }),
  });

  const evaluated = evaluateCharacter(char, catalogs);
  // Monk first: 10 + 3 (DEX) + 2 (WIS) = 15
  assert.equal(evaluated.armorClass.ac, 15);
  assert.match(evaluated.armorClass.breakdown, /Wis/);
  // First class saves: STR, DEX
  assert.equal(evaluated.saves.str.proficient, true);
  assert.equal(evaluated.saves.dex.proficient, true);
  assert.equal(evaluated.saves.con.proficient, false);
});

test("evaluateCharacter respects maxHpOverride and temporary hp", () => {
  const char = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: scores({ con: 14 }),
    maxHpOverride: 30,
    tempHp: 5,
    currentHp: 25,
  });

  const evaluated = evaluateCharacter(char, catalogs);
  assert.equal(evaluated.hp.max, 30);
  assert.equal(evaluated.hp.current, 25);
  assert.equal(evaluated.hp.temp, 5);
  assert.equal(evaluated.hp.override, 30);
});

test("evaluateCharacter derives spell profiles, pact magic, and DCs in unified envelope", () => {
  const char = makeChar({
    classes: [cl("Warlock", 3)],
    baseAbilityScores: scores({ cha: 16 }),
  });

  const evaluated = evaluateCharacter(char, catalogs);
  assert.equal(evaluated.spellProfiles.length, 1);
  assert.equal(evaluated.spellProfiles[0].className, "Warlock");
  assert.equal(evaluated.spellProfiles[0].spellSaveDc, 13); // 8 + 2 (PB) + 3 (CHA)
  assert.equal(evaluated.spellProfiles[0].spellAttackBonus, 5); // 2 (PB) + 3 (CHA)
  assert.deepEqual(evaluated.pactMagic, { count: 2, level: 2 });
  assert.equal(evaluated.combatDcs.spellSaveDc, 13);
  assert.equal(evaluated.combatDcs.maneuverSaveDc, 10); // 8 + 2 (PB) + 0 (max STR/DEX)
});

test("evaluateCharacter derives combat dice and clamps feature counters", () => {
  const char = makeChar({
    classes: [cl("Barbarian", 3), cl("Rogue", 3)],
    baseAbilityScores: scores({ str: 16, dex: 14, con: 14 }),
    resourceCounters: {
      rage: { id: "rage", name: "Rage", current: 1, max: 3, resetOn: "long" },
      custom_luck: { id: "custom_luck", name: "Luck", current: 2, max: 3, resetOn: "long" },
    },
  });

  const evaluated = evaluateCharacter(char, catalogs);
  // Rogue sneak attack 2d6
  assert.equal(evaluated.combatDice.sneakAttack, "2d6");
  // Barbarian level 3 grants 3 rages, current clamped to saved 1
  assert.equal(evaluated.featureCounters.rage.max, 3);
  assert.equal(evaluated.featureCounters.rage.current, 1);
  // Custom counter preserved
  assert.equal(evaluated.featureCounters.custom_luck.current, 2);
});


const human = loadTestCatalogs().races.find((r: { name: string; source: string }) => r.name === "Human" && r.source === "PHB");
const testfolk = { ...human, name: "Testfolk", source: "TEST", subraces: [] };
const xgefolk = { ...human, name: "Xgefolk", source: "XGE", subraces: [] };

test("evaluateCharacter resolves the race from the Compendium it is given", () => {
  const char = makeChar({ classes: [cl("Fighter", 1)], race: { name: "Testfolk", source: "TEST" } });
  const compendium = inMemoryCompendium({ races: [testfolk] });

  assert.equal(evaluateCharacter(char, { compendium, activeBooks: ALL_BOOKS }).resolvedAncestry.race?.name, "Testfolk");
});

test("evaluateCharacter finds no race the Compendium does not contain", () => {
  const char = makeChar({ classes: [cl("Fighter", 1)], race: { name: "Testfolk", source: "TEST" } });

  assert.equal(evaluateCharacter(char, { compendium: inMemoryCompendium({ races: [] }), activeBooks: ALL_BOOKS }).resolvedAncestry.race, undefined);
  assert.equal(evaluateCharacter(char, { activeBooks: ALL_BOOKS }).resolvedAncestry.race, undefined, "the SRD default does not contain Testfolk");
});

test("evaluateCharacter scopes an integrated Compendium's races to activeBooks", () => {
  const char = makeChar({ classes: [cl("Fighter", 1)], race: { name: "Xgefolk", source: "XGE" } });
  const compendium = inMemoryCompendium({ races: [xgefolk] }, { integrated: true });

  assert.equal(evaluateCharacter(char, { compendium, activeBooks: ["PHB"] }).resolvedAncestry.race, undefined);
  assert.equal(evaluateCharacter(char, { compendium, activeBooks: ["XGE"] }).resolvedAncestry.race?.name, "Xgefolk");
});
