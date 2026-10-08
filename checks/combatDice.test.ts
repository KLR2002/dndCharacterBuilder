import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getBardicInspirationDie,
  getSneakAttackDice,
  getMartialArtsDie,
  getClassDice,
} from "../src/rules/combatDice.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { isMonkWeapon, getWeaponAttacks } from "../src/rules/attacks.ts";
import type { Character } from "../src/types/character.ts";

const readCatalog = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8")
  );

const classes = readCatalog("classes");

function makeTestChar(overrides: Partial<Character> = {}): Character {
  return {
    id: "test_char",
    name: "Dice Roller",
    createdAt: 1,
    updatedAt: 1,
    avatarUri: null,
    abilityMethod: "pointBuy",
    baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 14 },
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

test("combatDice: Bardic Inspiration die progression", () => {
  assert.equal(getBardicInspirationDie(1), "1d6");
  assert.equal(getBardicInspirationDie(4), "1d6");
  assert.equal(getBardicInspirationDie(5), "1d8");
  assert.equal(getBardicInspirationDie(9), "1d8");
  assert.equal(getBardicInspirationDie(10), "1d10");
  assert.equal(getBardicInspirationDie(14), "1d10");
  assert.equal(getBardicInspirationDie(15), "1d12");
  assert.equal(getBardicInspirationDie(20), "1d12");
});

test("combatDice: Rogue Sneak Attack dice progression", () => {
  assert.equal(getSneakAttackDice(1), "1d6");
  assert.equal(getSneakAttackDice(2), "1d6");
  assert.equal(getSneakAttackDice(3), "2d6");
  assert.equal(getSneakAttackDice(4), "2d6");
  assert.equal(getSneakAttackDice(5), "3d6");
  assert.equal(getSneakAttackDice(19), "10d6");
  assert.equal(getSneakAttackDice(20), "10d6");
});

test("combatDice: Monk Martial Arts die progression", () => {
  assert.equal(getMartialArtsDie(1), "1d4");
  assert.equal(getMartialArtsDie(4), "1d4");
  assert.equal(getMartialArtsDie(5), "1d6");
  assert.equal(getMartialArtsDie(10), "1d6");
  assert.equal(getMartialArtsDie(11), "1d8");
  assert.equal(getMartialArtsDie(16), "1d8");
  assert.equal(getMartialArtsDie(17), "1d10");
  assert.equal(getMartialArtsDie(20), "1d10");
});

test("combatDice: getClassDice aggregates active scaling dice", () => {
  const multiclassChar = makeTestChar({
    classes: [
      { className: "Bard", level: 5, source: "PHB" },
      { className: "Rogue", level: 3, source: "PHB" },
      { className: "Monk", level: 1, source: "PHB" },
    ],
  });

  const dice = getClassDice(multiclassChar);
  assert.equal(dice.bardicInspiration, "1d8");
  assert.equal(dice.sneakAttack, "2d6");
  assert.equal(dice.martialArts, "1d4");
});

test("monk weapons: recognizes shortswords, unarmed strikes, and simple melee non-heavy weapons", () => {
  assert.equal(isMonkWeapon({ name: "Shortsword" } as any), true);
  assert.equal(isMonkWeapon({ name: "Unarmed Strike" } as any), true);
  assert.equal(isMonkWeapon({ name: "Dagger" } as any), true);
  assert.equal(isMonkWeapon({ name: "Quarterstaff" } as any), true);
  assert.equal(isMonkWeapon({ name: "Spear" } as any), true);
  assert.equal(isMonkWeapon({ name: "Greatclub" } as any), false, "Greatclub has two-handed property");
  assert.equal(isMonkWeapon({ name: "Shortbow" } as any), false, "Shortbow is ranged");
  assert.equal(isMonkWeapon({ name: "Longsword" } as any), false, "Longsword is martial non-shortsword");
});

test("attacks: Monk upgrades unarmed strike and monk weapon damage to martial arts die and uses Dex", () => {
  const monkChar = makeTestChar({
    baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 10 }, // Dex mod = +3, Str mod = 0
    classes: [{ className: "Monk", level: 5, source: "PHB" }], // Martial arts die is 1d6
    items: [
      { id: "i1", name: "Dagger", quantity: 1, weight: 1, isEquipped: true } as any, // Base 1d4
      { id: "i2", name: "Shortsword", quantity: 1, weight: 2, isEquipped: true } as any, // Base 1d6
    ],
  });

  const attacks = getWeaponAttacks(monkChar, { classes });
  const dagger = attacks.find((a) => a.name === "Dagger");
  assert.ok(dagger);
  assert.equal(dagger.statUsed, "dex");
  assert.equal(dagger.damageDice, "1d6", "Dagger 1d4 upgraded to Monk 1d6");
  assert.equal(dagger.damage, "1d6 + 3");

  // Monk also has automatic unarmed strike
  const unarmed = attacks.find((a) => a.name.toLowerCase() === "unarmed strike");
  assert.ok(unarmed);
  assert.equal(unarmed.statUsed, "dex");
  assert.equal(unarmed.damageDice, "1d6", "Unarmed strike upgraded to 1d6");
  assert.equal(unarmed.damage, "1d6 + 3");
});

test("attacks: Rogue weapons flag sneak attack eligibility with dice count", () => {
  const rogueChar = makeTestChar({
    classes: [{ className: "Rogue", level: 5, source: "PHB" }], // 3d6 sneak attack
    items: [
      { id: "i1", name: "Rapier", quantity: 1, weight: 2, isEquipped: true } as any, // Finesse
      { id: "i2", name: "Shortbow", quantity: 1, weight: 2, isEquipped: true } as any, // Ranged
      { id: "i3", name: "Club", quantity: 1, weight: 2, isEquipped: true } as any, // Simple melee, NOT finesse or ranged
    ],
  });

  const attacks = getWeaponAttacks(rogueChar, { classes });
  const rapier = attacks.find((a) => a.name === "Rapier");
  assert.ok(rapier);
  assert.equal(rapier.isSneakAttackEligible, true);
  assert.equal(rapier.sneakAttackDice, "3d6");

  const shortbow = attacks.find((a) => a.name === "Shortbow");
  assert.ok(shortbow);
  assert.equal(shortbow.isSneakAttackEligible, true);
  assert.equal(shortbow.sneakAttackDice, "3d6");

  const club = attacks.find((a) => a.name === "Club");
  assert.ok(club);
  assert.equal(club.isSneakAttackEligible, false);
});
