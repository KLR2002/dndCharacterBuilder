import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { fixedGrant, wardenClass } from "./proficiencySheetFixture.ts";
import {
  getWeaponAttacks,
  checkDualWielding,
  type WeaponAttackOption,
} from "../src/rules/attacks.ts";
import type { CharacterClass, InventoryItem } from "../src/types/character.ts";

const cl = (className: string, level: number, source = "PHB"): CharacterClass => ({
  className,
  source,
  level,
});

const weaponItem = (
  id: string,
  name: string,
  overrides: Partial<InventoryItem> = {}
): InventoryItem => ({
  id,
  name,
  source: "PHB",
  quantity: 1,
  isEquipped: true,
  section: "equipped",
  ...overrides,
});

test("getWeaponAttacks detects equipped weapons and ignores unequipped or non-weapon items", () => {
  const char = makeChar({
    classes: [cl("Fighter", 1)],
    items: [
      weaponItem("w1", "Longsword", { isEquipped: true, damage: "1d8", damageType: "slashing" }),
      weaponItem("w2", "Shortbow", { isEquipped: false, damage: "1d6", damageType: "piercing" }),
      {
        id: "a1",
        name: "Shield",
        source: "PHB",
        quantity: 1,
        isEquipped: true,
        section: "equipped",
        ac: 2,
      },
      {
        id: "a2",
        name: "Chain Mail",
        source: "PHB",
        quantity: 1,
        isEquipped: true,
        section: "equipped",
        ac: 16,
      },
    ],
  });

  const attacks = getWeaponAttacks(char);
  assert.equal(attacks.length, 1);
  assert.equal(attacks[0].name, "Longsword");
  assert.equal(attacks[0].item.id, "w1");
});

test("finesse weapons use higher of STR or DEX modifier", () => {
  // Case A: High DEX (+3), low STR (0) -> Rapier uses DEX
  const dexChar = makeChar({
    classes: [cl("Fighter", 1)], // PB = +2
    baseAbilityScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w1", "Rapier", { damage: "1d8", damageType: "piercing" }),
    ],
  });
  const dexAttacks = getWeaponAttacks(dexChar);
  assert.equal(dexAttacks.length, 1);
  assert.equal(dexAttacks[0].statUsed, "dex");
  assert.equal(dexAttacks[0].attackBonus, 5); // +3 DEX + 2 PB
  assert.equal(dexAttacks[0].toHit, 5);
  assert.equal(dexAttacks[0].damageString, "1d8 + 3");

  // Case B: High STR (+3), low DEX (0) -> Dagger uses STR
  const strChar = makeChar({
    classes: [cl("Fighter", 1)], // PB = +2
    baseAbilityScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w2", "Dagger", { damage: "1d4", damageType: "piercing" }),
    ],
  });
  const strAttacks = getWeaponAttacks(strChar);
  assert.equal(strAttacks.length, 1);
  assert.equal(strAttacks[0].statUsed, "str");
  assert.equal(strAttacks[0].attackBonus, 5); // +3 STR + 2 PB
  assert.equal(strAttacks[0].damageString, "1d4 + 3");

  // Case C: Scimitar with DEX 18 (+4) and STR 12 (+1)
  const scimitarChar = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: { str: 12, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w3", "Scimitar", { damage: "1d6", damageType: "slashing" }),
    ],
  });
  const scimitarAttacks = getWeaponAttacks(scimitarChar);
  assert.equal(scimitarAttacks[0].statUsed, "dex");
  assert.equal(scimitarAttacks[0].damageString, "1d6 + 4");
});

test("ranged weapons use DEX modifier even if STR is higher", () => {
  // Longbow with STR 16 (+3), DEX 14 (+2) -> must use DEX
  const ranger = makeChar({
    classes: [cl("Ranger", 1)], // PB = +2, proficient with Martial weapons
    baseAbilityScores: { str: 16, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w1", "Longbow", { damage: "1d8", damageType: "piercing", range: "150/600" }),
    ],
  });
  const rangerAttacks = getWeaponAttacks(ranger);
  assert.equal(rangerAttacks.length, 1);
  assert.equal(rangerAttacks[0].statUsed, "dex");
  assert.equal(rangerAttacks[0].attackBonus, 4); // +2 DEX + 2 PB
  assert.equal(rangerAttacks[0].damageString, "1d8 + 2");

  // Light Crossbow with DEX 16 (+3), STR 8 (-1)
  const rogue = makeChar({
    classes: [cl("Rogue", 1)],
    baseAbilityScores: { str: 8, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w2", "Light Crossbow", { damage: "1d8", damageType: "piercing", range: "80/320" }),
    ],
  });
  const rogueAttacks = getWeaponAttacks(rogue);
  assert.equal(rogueAttacks[0].statUsed, "dex");
  assert.equal(rogueAttacks[0].damageString, "1d8 + 3");
});

test("melee weapons without finesse use STR modifier even if DEX is higher", () => {
  // Greatsword with STR 10 (0), DEX 18 (+4) -> must use STR
  const char = makeChar({
    classes: [cl("Barbarian", 1)], // PB = +2, proficient with Martial weapons
    baseAbilityScores: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w1", "Greatsword", { damage: "2d6", damageType: "slashing" }),
    ],
  });
  const attacks = getWeaponAttacks(char);
  assert.equal(attacks.length, 1);
  assert.equal(attacks[0].statUsed, "str");
  assert.equal(attacks[0].attackBonus, 2); // +0 STR + 2 PB
  assert.equal(attacks[0].damageString, "2d6"); // +0 modifier omitted from dice
});

test("adds proficiency bonus to attack roll if character is proficient by category or exact weapon", () => {
  // Fighter: proficient with all Simple and Martial weapons by category
  const fighter = makeChar({
    classes: [cl("Fighter", 1)], // PB = +2
    baseAbilityScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w1", "Longsword", { damage: "1d8", damageType: "slashing" }),
    ],
  });
  const fighterAttacks = getWeaponAttacks(fighter);
  assert.equal(fighterAttacks[0].isProficient, true);
  assert.equal(fighterAttacks[0].attackBonus, 5); // 3 (STR) + 2 (PB)

  // Cleric: proficient with Simple weapons only
  const cleric = makeChar({
    classes: [cl("Cleric", 1)], // PB = +2
    baseAbilityScores: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w2", "Mace", { damage: "1d6", damageType: "bludgeoning" }), // Simple
      weaponItem("w3", "Greatsword", { damage: "2d6", damageType: "slashing" }), // Martial
    ],
  });
  const clericAttacks = getWeaponAttacks(cleric);
  const maceAttack = clericAttacks.find((a) => a.name === "Mace")!;
  const greatswordAttack = clericAttacks.find((a) => a.name === "Greatsword")!;

  assert.equal(maceAttack.isProficient, true);
  assert.equal(maceAttack.attackBonus, 4); // 2 (STR) + 2 (PB)

  assert.equal(greatswordAttack.isProficient, false);
  assert.equal(greatswordAttack.attackBonus, 2); // 2 (STR) + 0 (no PB)

  // Rogue: proficient with Simple + specific martial weapons (Rapier, Shortsword, Longsword, Hand Crossbow)
  const rogue = makeChar({
    classes: [cl("Rogue", 1)], // PB = +2
    baseAbilityScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w4", "Rapier", { damage: "1d8", damageType: "piercing" }), // Martial, but Rogue has exact prof
      weaponItem("w5", "Longbow", { damage: "1d8", damageType: "piercing", range: "150/600" }), // Martial, Rogue not proficient
    ],
  });
  const rogueAttacks = getWeaponAttacks(rogue);
  const rapierAttack = rogueAttacks.find((a) => a.name === "Rapier")!;
  const longbowAttack = rogueAttacks.find((a) => a.name === "Longbow")!;

  assert.equal(rapierAttack.isProficient, true);
  assert.equal(rapierAttack.attackBonus, 5); // 3 (DEX) + 2 (PB)

  assert.equal(longbowAttack.isProficient, false);
  assert.equal(longbowAttack.attackBonus, 3); // 3 (DEX) + 0 (no PB)
});

test("damage string formats positive, negative, and zero ability modifiers correctly", () => {
  // Positive modifier (+3) -> "1d8 + 3"
  const charPos = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    items: [weaponItem("w1", "Longsword", { damage: "1d8" })],
  });
  assert.equal(getWeaponAttacks(charPos)[0].damageString, "1d8 + 3");

  // Negative modifier (-1) -> "1d8 - 1"
  const charNeg = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: { str: 8, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    items: [weaponItem("w2", "Longsword", { damage: "1d8" })],
  });
  assert.equal(getWeaponAttacks(charNeg)[0].damageString, "1d8 - 1");

  // Zero modifier (+0) -> "1d8"
  const charZero = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    items: [weaponItem("w3", "Longsword", { damage: "1d8" })],
  });
  assert.equal(getWeaponAttacks(charZero)[0].damageString, "1d8");
});

test("checkDualWielding detects two equipped light melee weapons", () => {
  // Two light melee weapons (Shortsword + Dagger)
  const dualChar = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w1", "Shortsword", { damage: "1d6", damageType: "piercing" }),
      weaponItem("w2", "Dagger", { damage: "1d4", damageType: "piercing" }),
    ],
  });

  const result = checkDualWielding(dualChar);
  assert.equal(result.isDualWielding, true);
  assert.ok(result.mainHand);
  assert.ok(result.offHand);
  assert.equal(result.mainHand?.name, "Shortsword");
  assert.equal(result.offHand?.name, "Dagger");
});

test("checkDualWielding returns false if weapons are not both light melee", () => {
  // Longsword (not light) + Dagger (light) -> false
  const notBothLight = makeChar({
    classes: [cl("Fighter", 1)],
    items: [
      weaponItem("w1", "Longsword", { damage: "1d8" }),
      weaponItem("w2", "Dagger", { damage: "1d4" }),
    ],
  });
  assert.equal(checkDualWielding(notBothLight).isDualWielding, false);

  // Shortsword (light melee) + Hand Crossbow (light ranged) -> false (dual wielding requires melee)
  const rangedLight = makeChar({
    classes: [cl("Fighter", 1)],
    items: [
      weaponItem("w1", "Shortsword", { damage: "1d6" }),
      weaponItem("w2", "Hand Crossbow", { damage: "1d6", range: "30/120" }),
    ],
  });
  assert.equal(checkDualWielding(rangedLight).isDualWielding, false);

  // Only one light melee weapon -> false
  const singleWeapon = makeChar({
    classes: [cl("Fighter", 1)],
    items: [weaponItem("w1", "Dagger", { damage: "1d4" })],
  });
  assert.equal(checkDualWielding(singleWeapon).isDualWielding, false);
});

test("checkDualWielding offHand attack does NOT add ability modifier to damage unless negative", () => {
  // Case A: Positive modifier (+3) -> main hand adds +3, offHand does NOT add +3
  const dexChar = makeChar({
    classes: [cl("Rogue", 1)], // PB = +2
    baseAbilityScores: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w1", "Shortsword", { damage: "1d6", damageType: "piercing" }),
      weaponItem("w2", "Dagger", { damage: "1d4", damageType: "piercing" }),
    ],
  });

  const attacks = getWeaponAttacks(dexChar);
  const result = checkDualWielding(dexChar, attacks);

  assert.equal(result.isDualWielding, true);
  assert.equal(result.mainHand?.damageString, "1d6 + 3");
  assert.equal(result.offHand?.damageString, "1d4"); // No +3!
  assert.equal(result.offHand?.attackBonus, 5); // Attack roll still has +3 DEX + 2 PB!
  assert.equal(result.offHand?.isOffHand, true);

  // Case B: Negative modifier (-1) -> offHand DOES add negative modifier
  const weakChar = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: { str: 8, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w3", "Club", { damage: "1d4", damageType: "bludgeoning" }),
      weaponItem("w4", "Club", { damage: "1d4", damageType: "bludgeoning" }),
    ],
  });

  const weakResult = checkDualWielding(weakChar);
  assert.equal(weakResult.isDualWielding, true);
  assert.equal(weakResult.mainHand?.damageString, "1d4 - 1");
  assert.equal(weakResult.offHand?.damageString, "1d4 - 1"); // Negative modifier is retained!
});

test("a weapon proficiency granted by a class feature makes the attack proficient, and only while the feature applies", () => {
  const drill = {
    name: "Martial Drill",
    level: 1,
    description: "Placeholder description for the drill.",
    grants: [fixedGrant("FIX/Warden/Martial Drill@1#0", "weapons", ["martial weapons"])],
  };
  const char = makeChar({
    classes: [{ className: "Warden", source: "PHB", level: 1 }],
    items: [weaponItem("w1", "Greatsword", { damage: "2d6", damageType: "slashing" })],
  });
  const withDrill = getWeaponAttacks(char, { catalogs: { compendium: inMemoryCompendium({ classes: [wardenClass({ features: [drill] })] }), activeBooks: ALL_BOOKS } });
  assert.equal(withDrill[0].isProficient, true);
  const withoutDrill = getWeaponAttacks(char, { catalogs: { compendium: inMemoryCompendium({ classes: [wardenClass()] }), activeBooks: ALL_BOOKS } });
  assert.equal(withoutDrill[0].isProficient, false);
});

test("isProficientWithWeapon recognizes 'simple' and 'martial' from class weaponProficiencies", () => {
  const char = makeChar({
    classes: [cl("Fighter", 1)],
    baseAbilityScores: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    items: [
      weaponItem("w1", "Greatsword", { damage: "2d6", damageType: "slashing" }),
      weaponItem("w2", "Dagger", { damage: "1d4", damageType: "piercing" }),
    ],
  });

  const classDataCatalog = [
    {
      name: "Fighter",
      source: "PHB",
      hitDie: "1d10",
      savingThrows: ["Strength", "Constitution"],
      armorProficiencies: ["light", "medium", "heavy", "shield"],
      weaponProficiencies: ["simple", "martial"],
      toolProficiencies: [],
      features: [],
      subclasses: [],
    },
  ];

  const attacks = getWeaponAttacks(char, { catalogs: { compendium: inMemoryCompendium({ classes: classDataCatalog as any }), activeBooks: ALL_BOOKS } });
  assert.equal(attacks.length, 2);

  const greatsword = attacks.find((a) => a.name === "Greatsword");
  assert.ok(greatsword);
  assert.equal(greatsword.isProficient, true);
  // str mod (+3) + PB (+2) = +5
  assert.equal(greatsword.attackBonus, 5);

  const dagger = attacks.find((a) => a.name === "Dagger");
  assert.ok(dagger);
  assert.equal(dagger.isProficient, true);
  assert.equal(dagger.attackBonus, 5);
});

