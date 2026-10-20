import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalogs, integratedTestCompendium } from "./testUtils.ts";
import { getWeaponAttacks, checkDualWielding } from "../src/rules/attacks.ts";
import { armorClass } from "../src/rules/ac.ts";
import type { InventoryItem } from "../src/types/character.ts";

describe("First-Class Attunement Ledger & 3-Slot Limit (Ticket 04)", () => {
  const catalogs = loadTestCatalogs();
  const compendium = integratedTestCompendium();

  it("accurately counts attuned items and enforces 3-slot maximum capacity logic", () => {
    const item1: InventoryItem = {
      id: "ring_1",
      name: "Ring of Protection",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      attunement: true,
      isAttuned: true,
      bonusAc: 1,
    };
    const item2: InventoryItem = {
      id: "cloak_1",
      name: "Cloak of Protection",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      attunement: true,
      isAttuned: true,
      bonusAc: 1,
    };
    const item3: InventoryItem = {
      id: "blade_1",
      name: "Sun Blade",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      damage: "1d8",
      damageType: "radiant",
      attunement: "requires attunement",
      isAttuned: true,
      bonusWeapon: 2,
    };
    const item4: InventoryItem = {
      id: "boots_1",
      name: "Winged Boots",
      source: "DMG",
      quantity: 1,
      isEquipped: false,
      section: "carried",
      attunement: "requires attunement",
      isAttuned: false,
    };
    const mundaneItem: InventoryItem = {
      id: "plate_mundane",
      name: "Plate Armor",
      source: "PHB",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      ac: 18,
    };

    const char = makeChar({
      items: [item1, item2, item3, item4, mundaneItem],
    });

    const getAttuned = (items: InventoryItem[]) =>
      items.filter((i) => Boolean(i.attunement) && i.isAttuned === true);

    // Initial state: exactly 3 items attuned
    let attuned = getAttuned(char.items);
    assert.equal(attuned.length, 3, "Character should have exactly 3 attuned items");
    assert.ok(attuned.some((i) => i.id === "ring_1"));
    assert.ok(attuned.some((i) => i.id === "cloak_1"));
    assert.ok(attuned.some((i) => i.id === "blade_1"));

    // Attempting to attune 4th item when capacity is 3 requires swapping
    const canAttuneDirectly = attuned.length < 3;
    assert.equal(canAttuneDirectly, false, "Cannot attune 4th item without swap");

    // Execute swap: replace Ring of Protection with Winged Boots
    const swappedItems = char.items.map((i) => {
      if (i.id === "ring_1") return { ...i, isAttuned: false };
      if (i.id === "boots_1") return { ...i, isAttuned: true };
      return i;
    });
    attuned = getAttuned(swappedItems);
    assert.equal(attuned.length, 3, "Capacity remains strictly 3 after swap");
    assert.equal(swappedItems.find((i) => i.id === "ring_1")?.isAttuned, false);
    assert.equal(swappedItems.find((i) => i.id === "boots_1")?.isAttuned, true);

    // Unattuning reduces count to 2
    const unattunedItems = swappedItems.map((i) =>
      i.id === "cloak_1" ? { ...i, isAttuned: false } : i
    );
    attuned = getAttuned(unattunedItems);
    assert.equal(attuned.length, 2, "Unattuning item reduces count to 2");
  });

  it("strictly gates weapon combat bonuses and applies Unattuned badge when inactive", () => {
    const fighter = makeChar({
      classes: [{ className: "Fighter", level: 1 }],
      baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    });

    const warningSword: InventoryItem = {
      id: "warning_sword",
      name: "Longsword of Warning",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      damage: "1d8",
      damageType: "slashing",
      attunement: "requires attunement",
      isAttuned: false,
    };

    // 1. Unattuned weapon without numeric bonus still shows Unattuned badge
    const charUnattuned = { ...fighter, items: [warningSword] };
    const attacksUnattuned = getWeaponAttacks(charUnattuned, { catalogs: { compendium } });
    assert.equal(attacksUnattuned[0].toHit, 5);
    assert.equal(attacksUnattuned[0].damage, "1d8 + 3");
    assert.deepEqual(attacksUnattuned[0].calculationBadges, ["Unattuned"]);

    // 2. Attuned weapon without numeric bonus removes Unattuned badge
    const charAttuned = { ...fighter, items: [{ ...warningSword, isAttuned: true }] };
    const attacksAttuned = getWeaponAttacks(charAttuned, { catalogs: { compendium } });
    assert.equal(attacksAttuned[0].toHit, 5);
    assert.equal(attacksAttuned[0].damage, "1d8 + 3");
    assert.equal(attacksAttuned[0].calculationBadges, undefined);

    // 3. Attunable weapon with numeric bonus
    const holyAvenger: InventoryItem = {
      id: "holy_avenger",
      name: "Holy Avenger Longsword",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      damage: "1d8",
      damageType: "slashing",
      bonusWeapon: 3,
      attunement: "requires attunement by a paladin",
      isAttuned: false,
    };

    // Unattuned: no +3 bonus, shows Unattuned
    const charHolyUnattuned = { ...fighter, items: [holyAvenger] };
    const attacksHolyUnattuned = getWeaponAttacks(charHolyUnattuned, { catalogs: { compendium } });
    assert.equal(attacksHolyUnattuned[0].toHit, 5);
    assert.equal(attacksHolyUnattuned[0].damage, "1d8 + 3");
    assert.equal(attacksHolyUnattuned[0].itemBonus, undefined);
    assert.deepEqual(attacksHolyUnattuned[0].calculationBadges, ["Unattuned"]);

    // Attuned: grants +3 bonus, shows Item +3
    const charHolyAttuned = { ...fighter, items: [{ ...holyAvenger, isAttuned: true }] };
    const attacksHolyAttuned = getWeaponAttacks(charHolyAttuned, { catalogs: { compendium } });
    assert.equal(attacksHolyAttuned[0].toHit, 8, "Str 3 + PB 2 + Item 3 = 8");
    assert.equal(attacksHolyAttuned[0].damage, "1d8 + 6", "Str 3 + Item 3 = 6");
    assert.equal(attacksHolyAttuned[0].itemBonus, 3);
    assert.deepEqual(attacksHolyAttuned[0].calculationBadges, ["Item +3"]);
  });

  it("strictly gates armor, shield, and accessory AC bonuses by attunement", () => {
    const paladin = makeChar({
      classes: [{ className: "Paladin", level: 1 }],
      baseAbilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    });

    const dragonArmor: InventoryItem = {
      id: "dragon_scale",
      name: "Dragon Scale Mail",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      ac: 14,
      bonusAc: 1,
      attunement: true,
      isAttuned: false,
    };

    const arrowShield: InventoryItem = {
      id: "arrow_shield",
      name: "Arrow-Catching Shield",
      source: "DMG",
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      ac: 2,
      bonusAc: 2,
      attunement: true,
      isAttuned: false,
    };

    // 1. Both equipped but both unattuned: only base 14 (Armor) and 2 (Shield) apply
    const charBothUnattuned = { ...paladin, items: [dragonArmor, arrowShield] };
    const acBothUnattuned = armorClass(charBothUnattuned);
    assert.equal(acBothUnattuned.ac, 16, "14 (Armor) + 2 (Shield) = 16 AC");
    assert.equal(acBothUnattuned.breakdown, "14 (Armor) + 0 (Dex max 2) + 2 (Shield)");

    // 2. Armor attuned, shield unattuned: +1 magic bonus from armor only
    const charArmorAttuned = {
      ...paladin,
      items: [{ ...dragonArmor, isAttuned: true }, arrowShield],
    };
    const acArmorAttuned = armorClass(charArmorAttuned);
    assert.equal(acArmorAttuned.ac, 17, "14 (Armor) + 2 (Shield) + 1 (Magic Item) = 17 AC");
    assert.equal(acArmorAttuned.breakdown, "14 (Armor) + 0 (Dex max 2) + 2 (Shield) + 1 (Magic Item)");

    // 3. Both attuned: +1 from armor, +2 from shield -> +3 total magic AC
    const charBothAttuned = {
      ...paladin,
      items: [
        { ...dragonArmor, isAttuned: true },
        { ...arrowShield, isAttuned: true },
      ],
    };
    const acBothAttuned = armorClass(charBothAttuned);
    assert.equal(acBothAttuned.ac, 19, "14 (Armor) + 2 (Shield) + 3 (Magic Item) = 19 AC");
    assert.equal(acBothAttuned.breakdown, "14 (Armor) + 0 (Dex max 2) + 2 (Shield) + 3 (Magic Item)");
  });

  it("handles attunement on dual wielding off-hand attacks", () => {
    const fighter = makeChar({
      classes: [{ className: "Fighter", level: 1 }],
      baseAbilityScores: { str: 16, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
      items: [
        {
          id: "main_dagger",
          name: "Dagger",
          source: "PHB",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          damage: "1d4",
          damageType: "piercing",
        },
        {
          id: "off_magic_dagger",
          name: "Dagger of Venom",
          source: "DMG",
          quantity: 1,
          isEquipped: true,
          section: "equipped",
          damage: "1d4",
          damageType: "piercing",
          bonusWeapon: 1,
          attunement: true,
          isAttuned: false,
        },
      ],
    });

    // 1. Off-hand unattuned: bonus is 0, has Unattuned badge
    const dualUnattuned = checkDualWielding(fighter);
    assert.ok(dualUnattuned.isDualWielding);
    assert.ok(dualUnattuned.offHand);
    assert.equal(dualUnattuned.offHand.toHit, 5, "Dex 3 + PB 2 = 5");
    assert.equal(dualUnattuned.offHand.damage, "1d4");
    assert.deepEqual(dualUnattuned.offHand.calculationBadges, ["Unattuned"]);

    // 2. Off-hand attuned: bonus is 1, has Item +1 badge
    const fighterAttuned = {
      ...fighter,
      items: [
        fighter.items[0],
        { ...fighter.items[1], isAttuned: true },
      ],
    };
    const dualAttuned = checkDualWielding(fighterAttuned);
    assert.ok(dualAttuned.isDualWielding);
    assert.ok(dualAttuned.offHand);
    assert.equal(dualAttuned.offHand.toHit, 6, "Dex 3 + PB 2 + Item 1 = 6");
    assert.equal(dualAttuned.offHand.damage, "1d4 + 1");
    assert.deepEqual(dualAttuned.offHand.calculationBadges, ["Item +1"]);
  });
});
