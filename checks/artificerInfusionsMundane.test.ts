import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../src/rules/characterReconciler.ts";
import { currentCompendium } from "../src/services/compendium.ts";
import { makeChar } from "./testUtils.ts";
import {
  isMundaneItem,
  isMundaneInfusionTarget,
} from "../src/rules/ruleChoices.ts";
import type { InventoryItem } from "../src/types/character.ts";

test("isMundaneItem and isMundaneInfusionTarget correctly identify nonmagical base equipment", () => {
  const mundaneDagger: InventoryItem = {
    id: "dagger_1",
    name: "Dagger",
    source: "PHB",
    quantity: 1,
    weight: 1,
    rarity: "None",
  };
  assert.equal(isMundaneItem(mundaneDagger), true);
  assert.equal(isMundaneInfusionTarget(mundaneDagger), true);

  const mundaneLongsword: InventoryItem = {
    id: "longsword_1",
    name: "Longsword",
    source: "PHB",
    quantity: 1,
    weight: 3,
  };
  assert.equal(isMundaneItem(mundaneLongsword), true);

  const mundaneShield: InventoryItem = {
    id: "shield_1",
    name: "Shield",
    source: "PHB",
    quantity: 1,
    weight: 6,
    ac: 2,
    rarity: "None",
  };
  assert.equal(isMundaneItem(mundaneShield), true);

  const mundanePlate: InventoryItem = {
    id: "plate_1",
    name: "Plate Armor",
    source: "PHB",
    quantity: 1,
    weight: 65,
    ac: 18,
  };
  assert.equal(isMundaneItem(mundanePlate), true);
});

test("isMundaneItem rejects magic weapons, armors, and wondrous items", () => {
  // Magic weapons with bonusWeapon or rarity
  const plusOneLongsword: InventoryItem = {
    id: "magic_sword_1",
    name: "Longsword, +1",
    source: "DMG",
    quantity: 1,
    bonusWeapon: 1,
    rarity: "Uncommon",
  };
  assert.equal(isMundaneItem(plusOneLongsword), false);

  const sunBlade: InventoryItem = {
    id: "sun_blade",
    name: "Sun Blade",
    source: "DMG",
    quantity: 1,
    bonusWeapon: 2,
    rarity: "Rare",
  };
  assert.equal(isMundaneItem(sunBlade), false);

  const daggerOfWarning: InventoryItem = {
    id: "dagger_warning",
    name: "Dagger of Warning",
    source: "DMG",
    quantity: 1,
    rarity: "Uncommon",
  };
  assert.equal(isMundaneItem(daggerOfWarning), false);

  // Magic armors and shields
  const plusOneShield: InventoryItem = {
    id: "magic_shield_1",
    name: "Shield, +1",
    source: "DMG",
    quantity: 1,
    ac: 2,
    bonusAc: 1,
    rarity: "Uncommon",
  };
  assert.equal(isMundaneItem(plusOneShield), false);

  const plusOnePlate: InventoryItem = {
    id: "magic_plate_1",
    name: "Plate Armor, +1",
    source: "DMG",
    quantity: 1,
    ac: 18,
    bonusAc: 1,
    rarity: "Rare",
  };
  assert.equal(isMundaneItem(plusOnePlate), false);

  const adamantineArmor: InventoryItem = {
    id: "adamantine_chain",
    name: "Adamantine Chain Mail",
    source: "DMG",
    quantity: 1,
    ac: 16,
    rarity: "Uncommon",
  };
  assert.equal(isMundaneItem(adamantineArmor), false);

  // Accessories
  const ringOfProtection: InventoryItem = {
    id: "ring_prot",
    name: "Ring of Protection",
    source: "DMG",
    quantity: 1,
    bonusAc: 1,
    rarity: "Rare",
  };
  assert.equal(isMundaneItem(ringOfProtection), false);
});

test("reconcile removes active infusions bound to magical items", () => {
  const mundaneSword: InventoryItem = {
    id: "mundane_sword",
    name: "Longsword",
    source: "PHB",
    quantity: 1,
    isInfused: true,
    infusedWith: "Enhanced Weapon",
  };

  const magicSword: InventoryItem = {
    id: "magic_sword",
    name: "Sun Blade",
    source: "DMG",
    quantity: 1,
    rarity: "Rare",
    bonusWeapon: 2,
    isInfused: true,
    infusedWith: "Radiant Weapon",
  };

  const artChar = makeChar({
    classes: [{ className: "Artificer", level: 6, hitDiceType: "d8" }],
    ruleChoices: [
      {
        id: "TCE__Artificer__Infusions 2",
        trait: "Infusions Known (2nd Level)",
        choose: 4,
        from: [],
        origin: "class",
        picked: ["Enhanced Defense", "Enhanced Weapon", "Mind Sharpener", "Repeating Shot"],
      },
      {
        id: "TCE__Artificer__Infusions 6",
        trait: "Infusions Known (6th Level)",
        choose: 2,
        from: [],
        origin: "class",
        picked: ["Radiant Weapon", "Repulsion Shield"],
      },
    ],
    items: [mundaneSword, magicSword],
    activeInfusions: [
      {
        infusionName: "Enhanced Weapon",
        targetItemId: "mundane_sword",
        targetItemName: "Longsword",
      },
      {
        infusionName: "Radiant Weapon",
        targetItemId: "magic_sword",
        targetItemName: "Sun Blade",
      },
    ],
  });

  const pruned = reconcile(artChar, currentCompendium());

  // Mundane sword infusion should remain active
  assert.equal(
    pruned.activeInfusions?.some((a) => a.infusionName === "Enhanced Weapon"),
    true
  );
  const updatedMundaneSword = pruned.items?.find((i) => i.id === "mundane_sword");
  assert.equal(updatedMundaneSword?.isInfused, true);
  assert.equal(updatedMundaneSword?.infusedWith, "Enhanced Weapon");

  // Magic sword infusion should be stripped
  assert.equal(
    pruned.activeInfusions?.some((a) => a.infusionName === "Radiant Weapon"),
    false
  );
  const updatedMagicSword = pruned.items?.find((i) => i.id === "magic_sword");
  assert.equal(updatedMagicSword?.isInfused, undefined);
  assert.equal(updatedMagicSword?.infusedWith, undefined);

  // Needs review should record the violation
  assert.equal(
    pruned.needsReview?.some((n) => n.includes("Radiant Weapon") && n.includes("magical")),
    true
  );
});
