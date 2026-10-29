import { ALL_BOOKS } from "../src/constants/books.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalogs, inMemoryCompendium, integratedTestCompendium } from "./testUtils.ts";
import { getWeaponAttacks, checkDualWielding } from "../src/rules/attacks.ts";
import { armorClass } from "../src/rules/ac.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { getTacticalActionLedger } from "../src/rules/tacticalActions.ts";
import type { InventoryItem } from "../src/types/character.ts";

describe("Combat Economy Engine: Passive Weapon & Armor Enhancement Bonuses", () => {
  const catalogs = loadTestCatalogs();
  const compendium = integratedTestCompendium();

  it("calculates +1, +2, +3 weapon attack bonus, damage formula, and Item +X badges", () => {
    // Fighter level 1 with Str 16 (+3), PB +2
    const baseFighter = makeChar({
      classes: [{ className: "Fighter", level: 1 }],
      baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    });

    // 1. Mundane Longsword
    const mundaneItem: InventoryItem = {
      id: "sword_mundane",
      name: "Longsword",
      source: "PHB",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      damage: "1d8",
      damageType: "slashing",
    };
    const charMundane = { ...baseFighter, items: [mundaneItem] };
    const attacksMundane = getWeaponAttacks(charMundane, { catalogs: { compendium, activeBooks: ALL_BOOKS } });
    assert.equal(attacksMundane.length, 1);
    assert.equal(attacksMundane[0].toHit, 5, "Str +3 and PB +2 = +5 to hit");
    assert.equal(attacksMundane[0].damage, "1d8 + 3");
    assert.equal(attacksMundane[0].itemBonus, undefined);
    assert.equal(attacksMundane[0].calculationBadges, undefined);

    // 2. Longsword, +1
    const plusOneItem: InventoryItem = {
      id: "sword_plus1",
      name: "Longsword, +1",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      damage: "1d8",
      damageType: "slashing",
      bonusWeapon: 1,
    };
    const charPlusOne = { ...baseFighter, items: [plusOneItem] };
    const attacksPlusOne = getWeaponAttacks(charPlusOne, { catalogs: { compendium, activeBooks: ALL_BOOKS } });
    assert.equal(attacksPlusOne.length, 1);
    assert.equal(attacksPlusOne[0].toHit, 6, "Str +3, PB +2, Item +1 = +6 to hit");
    assert.equal(attacksPlusOne[0].damage, "1d8 + 4", "Damage gets +1 magic bonus: 3 + 1 = 4");
    assert.equal(attacksPlusOne[0].itemBonus, 1);
    assert.deepEqual(attacksPlusOne[0].calculationBadges, ["Item +1"]);

    // 3. Greatsword, +2
    const plusTwoItem: InventoryItem = {
      id: "gs_plus2",
      name: "Greatsword, +2",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      damage: "2d6",
      damageType: "slashing",
      bonusWeapon: 2,
    };
    const charPlusTwo = { ...baseFighter, items: [plusTwoItem] };
    const attacksPlusTwo = getWeaponAttacks(charPlusTwo, { catalogs: { compendium, activeBooks: ALL_BOOKS } });
    assert.equal(attacksPlusTwo[0].toHit, 7, "Str +3, PB +2, Item +2 = +7 to hit");
    assert.equal(attacksPlusTwo[0].damage, "2d6 + 5", "Damage gets +2 magic bonus: 3 + 2 = 5");
    assert.equal(attacksPlusTwo[0].itemBonus, 2);
    assert.deepEqual(attacksPlusTwo[0].calculationBadges, ["Item +2"]);

    // 4. Dagger, +3 (Finesse, using Dex 10 or Str 16 -> Str 16 mod +3)
    const plusThreeItem: InventoryItem = {
      id: "dagger_plus3",
      name: "Dagger, +3",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      damage: "1d4",
      damageType: "piercing",
      bonusWeapon: 3,
    };
    const charPlusThree = { ...baseFighter, items: [plusThreeItem] };
    const attacksPlusThree = getWeaponAttacks(charPlusThree, { catalogs: { compendium, activeBooks: ALL_BOOKS } });
    assert.equal(attacksPlusThree[0].toHit, 8, "Str +3, PB +2, Item +3 = +8 to hit");
    assert.equal(attacksPlusThree[0].damage, "1d4 + 6", "Damage gets +3 magic bonus: 3 + 3 = 6");
    assert.equal(attacksPlusThree[0].itemBonus, 3);
    assert.deepEqual(attacksPlusThree[0].calculationBadges, ["Item +3"]);
  });

  it("stacks weapon enhancement bonus with fighting styles (Archery and Dueling)", () => {
    // Ranger with Archery fighting style and Dex 16 (+3)
    const ranger = makeChar({
      classes: [{ className: "Ranger", level: 2 }],
      baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
      ruleChoices: [
        {
          id: "PHB__Ranger__Fighting Style",
          picked: ["Archery"],
          level: 2,
          source: "PHB",
          origin: "class",
        },
      ],
      items: [
        {
          id: "bow_plus1",
          name: "Longbow, +1",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          damage: "1d8",
          damageType: "piercing",
          bonusWeapon: 1,
        },
      ],
    });

    const rangerAttacks = getWeaponAttacks(ranger, { catalogs: { compendium, activeBooks: ALL_BOOKS } });
    assert.equal(rangerAttacks[0].toHit, 8, "Dex +3, PB +2, Archery +2, Item +1 = +8 to hit");
    assert.equal(rangerAttacks[0].damage, "1d8 + 4", "Damage: 3 (Dex) + 1 (Item) = 4");
    assert.ok(rangerAttacks[0].calculationBadges?.includes("Archery +2"));
    assert.ok(rangerAttacks[0].calculationBadges?.includes("Item +1"));

    // Fighter with Dueling fighting style and Str 16 (+3)
    const duelist = makeChar({
      classes: [{ className: "Fighter", level: 1 }],
      baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      ruleChoices: [
        {
          id: "PHB__Fighter__Fighting Style",
          picked: ["Dueling"],
          level: 1,
          source: "PHB",
          origin: "class",
        },
      ],
      items: [
        {
          id: "rapier_plus2",
          name: "Rapier, +2",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          damage: "1d8",
          damageType: "piercing",
          bonusWeapon: 2,
        },
      ],
    });

    const duelistAttacks = getWeaponAttacks(duelist, { catalogs: { compendium, activeBooks: ALL_BOOKS } });
    assert.equal(duelistAttacks[0].toHit, 7, "Str +3, PB +2, Item +2 = +7 to hit");
    assert.equal(duelistAttacks[0].damage, "1d8 + 7", "Damage: 3 (Str) + 2 (Dueling) + 2 (Item) = +7");
    assert.ok(duelistAttacks[0].calculationBadges?.includes("Dueling +2"));
    assert.ok(duelistAttacks[0].calculationBadges?.includes("Item +2"));
  });

  it("gates weapon bonuses by attunement status and renders Unattuned badge when inactive", () => {
    const fighter = makeChar({
      classes: [{ className: "Fighter", level: 1 }],
      baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    });

    // Magic weapon requiring attunement (e.g. Moonblade or custom weapon)
    const attunableSword: InventoryItem = {
      id: "sword_attunable",
      name: "Sun Blade",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      damage: "1d8",
      damageType: "radiant",
      bonusWeapon: 2,
      attunement: "requires attunement",
      isAttuned: false,
    };

    // 1. Unattuned state
    const charUnattuned = { ...fighter, items: [attunableSword] };
    const attacksUnattuned = getWeaponAttacks(charUnattuned, { catalogs: { compendium, activeBooks: ALL_BOOKS } });
    assert.equal(attacksUnattuned[0].toHit, 5, "Unattuned weapon grants no enhancement bonus: 3 + 2 = 5");
    assert.equal(attacksUnattuned[0].damage, "1d8 + 3", "Unattuned weapon grants no damage bonus: 3");
    assert.equal(attacksUnattuned[0].itemBonus, undefined);
    assert.deepEqual(attacksUnattuned[0].calculationBadges, ["Unattuned"]);

    // 2. Attuned state
    const attunedSword: InventoryItem = { ...attunableSword, isAttuned: true };
    const charAttuned = { ...fighter, items: [attunedSword] };
    const attacksAttuned = getWeaponAttacks(charAttuned, { catalogs: { compendium, activeBooks: ALL_BOOKS } });
    assert.equal(attacksAttuned[0].toHit, 7, "Attuned weapon grants +2 enhancement: 3 + 2 + 2 = 7");
    assert.equal(attacksAttuned[0].damage, "1d8 + 5", "Attuned weapon grants +2 damage: 3 + 2 = 5");
    assert.equal(attacksAttuned[0].itemBonus, 2);
    assert.deepEqual(attacksAttuned[0].calculationBadges, ["Item +2"]);
  });

  it("applies bonusWeapon to dual wielding off-hand attack", () => {
    const rogue = makeChar({
      classes: [{ className: "Rogue", level: 1 }],
      baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
      items: [
        {
          id: "main_dagger",
          name: "Shortsword, +1",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          damage: "1d6",
          damageType: "piercing",
          bonusWeapon: 1,
        },
        {
          id: "off_dagger",
          name: "Dagger, +2",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          damage: "1d4",
          damageType: "piercing",
          bonusWeapon: 2,
        },
      ],
    });

    const dualResult = checkDualWielding(rogue);
    assert.ok(dualResult.isDualWielding);
    assert.ok(dualResult.mainHand);
    assert.ok(dualResult.offHand);

    // Main hand Shortsword +1: Dex 3, PB 2, Item 1 = 6 to hit. Damage 1d6 + 3 + 1 = 1d6 + 4
    assert.equal(dualResult.mainHand.toHit, 6);
    assert.equal(dualResult.mainHand.damage, "1d6 + 4");
    assert.ok(dualResult.mainHand.calculationBadges?.includes("Item +1"));

    // Off-hand Dagger +2 without TWF style: Dex mod not added to damage, but magic +2 is!
    // Attack bonus: Dex 3, PB 2, Item 2 = 7 to hit. Damage: 1d4 + 2
    assert.equal(dualResult.offHand.toHit, 7);
    assert.equal(dualResult.offHand.damage, "1d4 + 2");
    assert.equal(dualResult.offHand.itemBonus, 2);
    assert.ok(dualResult.offHand.calculationBadges?.includes("Item +2"));
  });

  it("calculates magic AC bonus from equipped armor, shields, and accessories with breakdown", () => {
    // 1. Plate Armor, +1 (base AC 18, bonusAc 1)
    const charPlate1 = makeChar({
      baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      items: [
        {
          id: "plate_1",
          name: "Plate Armor, +1",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          ac: 18,
          bonusAc: 1,
        },
      ],
    });
    const acPlate1 = armorClass(charPlate1, { activeBooks: ALL_BOOKS });
    assert.equal(acPlate1.ac, 19, "18 base + 1 magic = 19 AC");
    assert.equal(acPlate1.breakdown, "18 (Armor) + 1 (Magic Item)");

    // 2. Plate Armor, +1 AND Shield, +1
    const charPlateAndShield = makeChar({
      baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      items: [
        {
          id: "plate_1",
          name: "Plate Armor, +1",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          ac: 18,
          bonusAc: 1,
        },
        {
          id: "shield_1",
          name: "Shield, +1",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          ac: 2,
          bonusAc: 1,
        },
      ],
    });
    const acPlateAndShield = armorClass(charPlateAndShield, { activeBooks: ALL_BOOKS });
    assert.equal(acPlateAndShield.ac, 22, "18 base + 2 shield + 2 magic = 22 AC");
    assert.equal(acPlateAndShield.breakdown, "18 (Armor) + 2 (Shield) + 2 (Magic Item)");

    // 3. Plate Armor, +2 AND Shield, +3
    const charHeavyDefense = makeChar({
      baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
      items: [
        {
          id: "plate_2",
          name: "Plate Armor, +2",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          ac: 18,
          bonusAc: 2,
        },
        {
          id: "shield_3",
          name: "Shield, +3",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          ac: 2,
          bonusAc: 3,
        },
      ],
    });
    const acHeavy = armorClass(charHeavyDefense, { activeBooks: ALL_BOOKS });
    assert.equal(acHeavy.ac, 25, "18 base + 2 shield + 5 magic = 25 AC");
    assert.equal(acHeavy.breakdown, "18 (Armor) + 2 (Shield) + 5 (Magic Item)");
  });

  it("gates magic AC bonuses by attunement requirement", () => {
    // Unarmored character (Dex 14 -> +2) with Ring of Protection (bonusAc 1, attunement true)
    const baseChar = makeChar({
      baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    });

    const ringItem: InventoryItem = {
      id: "ring_prot",
      name: "Ring of Protection",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      bonusAc: 1,
      attunement: true,
      isAttuned: false,
    };

    // 1. Unattuned: does not grant +1 AC
    const charUnattuned = { ...baseChar, items: [ringItem] };
    const acUnattuned = armorClass(charUnattuned, { activeBooks: ALL_BOOKS });
    assert.equal(acUnattuned.ac, 12, "10 + 2 (Dex) = 12 AC");
    assert.equal(acUnattuned.breakdown, "10 + 2 (Dex)");

    // 2. Attuned: grants +1 AC
    const charAttuned = { ...baseChar, items: [{ ...ringItem, isAttuned: true }] };
    const acAttuned = armorClass(charAttuned, { activeBooks: ALL_BOOKS });
    assert.equal(acAttuned.ac, 13, "10 + 2 (Dex) + 1 (Magic Item) = 13 AC");
    assert.equal(acAttuned.breakdown, "10 + 2 (Dex) + 1 (Magic Item)");
  });

  it("supports custom items with bonusWeapon and bonusAc in evaluation and tactical ledger", () => {
    const hero = makeChar({
      classes: [{ className: "Fighter", level: 1 }],
      baseAbilityScores: { str: 16, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
      items: [
        {
          id: "custom_sword",
          name: "Enchanted Blade",
          source: "Custom",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          damage: "1d8",
          damageType: "slashing",
          bonusWeapon: 2,
          isCustom: true,
        },
        {
          id: "custom_buckler",
          name: "Runic Buckler",
          source: "Custom",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          ac: 2,
          bonusAc: 1,
          isCustom: true,
        },
      ],
    });

    const evaluated = evaluateCharacter(hero, { compendium: inMemoryCompendium(catalogs), activeBooks: ALL_BOOKS });

    // AC verification
    assert.equal(evaluated.armorClass.ac, 15, "10 + 2 (Dex) + 2 (Shield) + 1 (Magic Item) = 15 AC");
    assert.ok(evaluated.armorClass.breakdown.includes("+ 1 (Magic Item)"));

    // Weapon attack verification
    const atk = evaluated.weaponAttacks?.[0];
    assert.ok(atk);
    assert.equal(atk.toHit, 7, "Str 3 + PB 2 + Item 2 = 7");
    assert.equal(atk.damage, "1d8 + 5", "Str 3 + Item 2 = 5");
    assert.deepEqual(atk.calculationBadges, ["Item +2"]);

    // Tactical ledger integration
    const tacticalLedger = getTacticalActionLedger(hero, evaluated);
    assert.equal(tacticalLedger.weaponAttacks.length, 1);
    assert.equal(tacticalLedger.weaponAttacks[0].toHit, 7);
  });
});
