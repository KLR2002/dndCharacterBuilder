import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ItemData } from "../src/types/dnd5e.ts";

describe("Items Scraper & Catalog Integrity (Ticket 01)", () => {
  const itemsPath = path.resolve(process.cwd(), "src/data/items.json");
  const items: ItemData[] = JSON.parse(fs.readFileSync(itemsPath, "utf8"));

  it("pre-expands concrete weapon variants with accurate statistics and bonusWeapon", () => {
    const longswordPlusOne = items.find((i) => i.name === "Longsword, +1" && i.source === "DMG");
    assert.ok(longswordPlusOne, "Longsword, +1 should exist in items catalog");
    assert.equal(longswordPlusOne.itemCategory, "Weapon");
    assert.equal(longswordPlusOne.type, "Melee Weapon");
    assert.equal(longswordPlusOne.damage, "1d8");
    assert.equal(longswordPlusOne.damageType, "slashing");
    assert.equal(longswordPlusOne.weight, 3);
    assert.equal(longswordPlusOne.bonusWeapon, 1);
    assert.equal(longswordPlusOne.rarity, "Uncommon");
    assert.deepEqual(longswordPlusOne.properties, ["Versatile"]);

    const greatswordPlusThree = items.find((i) => i.name === "Greatsword, +3" && i.source === "DMG");
    assert.ok(greatswordPlusThree, "Greatsword, +3 should exist in items catalog");
    assert.equal(greatswordPlusThree.bonusWeapon, 3);
    assert.equal(greatswordPlusThree.damage, "2d6");
    assert.equal(greatswordPlusThree.rarity, "Very Rare");
    assert.ok(greatswordPlusThree.properties.includes("Two-Handed"));

    const shortbowPlusTwo = items.find((i) => i.name === "Shortbow, +2" && i.source === "DMG");
    assert.ok(shortbowPlusTwo, "Shortbow, +2 should exist in items catalog");
    assert.equal(shortbowPlusTwo.type, "Ranged Weapon");
    assert.equal(shortbowPlusTwo.bonusWeapon, 2);
    assert.equal(shortbowPlusTwo.rarity, "Rare");
  });

  it("generates Weapon of Warning variants with attunement required", () => {
    const daggerWarning = items.find((i) => i.name === "Dagger of Warning" && i.source === "DMG");
    assert.ok(daggerWarning, "Dagger of Warning should exist");
    assert.equal(daggerWarning.itemCategory, "Weapon");
    assert.equal(daggerWarning.attunement, "requires attunement");
    assert.equal(daggerWarning.damage, "1d4");
    assert.equal(daggerWarning.damageType, "piercing");
    assert.ok(daggerWarning.properties.includes("Finesse"));
    assert.ok(daggerWarning.properties.includes("Light"));
    assert.ok(daggerWarning.properties.includes("Thrown"));
    assert.ok(daggerWarning.description.includes("advantage on initiative"));
  });

  it("pre-expands concrete armor and shield variants with bonusAc and base AC", () => {
    // Shield +1, +2, +3
    const shield1 = items.find((i) => i.name === "Shield, +1" && i.source === "DMG");
    assert.ok(shield1);
    assert.equal(shield1.itemCategory, "Shield");
    assert.equal(shield1.bonusAc, 1);
    assert.equal(shield1.ac, 2);

    const shield2 = items.find((i) => i.name === "Shield, +2" && i.source === "DMG");
    assert.ok(shield2);
    assert.equal(shield2.bonusAc, 2);
    assert.equal(shield2.ac, 2);

    const shield3 = items.find((i) => i.name === "Shield, +3" && i.source === "DMG");
    assert.ok(shield3);
    assert.equal(shield3.bonusAc, 3);
    assert.equal(shield3.ac, 2);

    // Armor +1
    const plate1 = items.find((i) => i.name === "Plate Armor, +1" && i.source === "DMG");
    assert.ok(plate1);
    assert.equal(plate1.itemCategory, "Armor");
    assert.equal(plate1.bonusAc, 1);
    assert.equal(plate1.ac, 18);
    assert.equal(plate1.stealthDisadvantage, true);

    const leather1 = items.find((i) => i.name === "Leather Armor, +1" && i.source === "DMG");
    assert.ok(leather1);
    assert.equal(leather1.bonusAc, 1);
    assert.equal(leather1.ac, 11);
  });

  it("generates Adamantine and Mithral variants for eligible armors", () => {
    const adamantinePlate = items.find((i) => i.name === "Adamantine Plate Armor");
    assert.ok(adamantinePlate);
    assert.equal(adamantinePlate.itemCategory, "Armor");
    assert.equal(adamantinePlate.ac, 18);
    assert.ok(adamantinePlate.description.includes("critical hit against you becomes a normal hit"));

    const mithralPlate = items.find((i) => i.name === "Mithral Plate Armor");
    assert.ok(mithralPlate);
    assert.equal(mithralPlate.stealthDisadvantage, false, "Mithral removes stealth disadvantage");
    assert.equal(mithralPlate.strengthRequirement, null, "Mithral removes strength requirement");

    // Negative boundary verification: Hide Armor cannot be Adamantine or Mithral
    const adamantineHide = items.find((i) => i.name === "Adamantine Hide Armor");
    assert.equal(adamantineHide, undefined, "Hide armor should not have an Adamantine variant");
    const mithralHide = items.find((i) => i.name === "Mithral Hide Armor");
    assert.equal(mithralHide, undefined, "Hide armor should not have a Mithral variant");
  });

  it("retains canonical generic templates in the catalog", () => {
    const genericWep1 = items.find((i) => i.name === "Weapon, +1");
    assert.ok(genericWep1);
    assert.equal(genericWep1.bonusWeapon, 1);

    const genericWarning = items.find((i) => i.name === "Weapon of Warning");
    assert.ok(genericWarning);
    assert.equal(genericWarning.attunement, "requires attunement");

    const genericArmor1 = items.find((i) => i.name === "Armor, +1");
    assert.ok(genericArmor1);
    assert.equal(genericArmor1.bonusAc, 1);
  });

  it("normalizes pipe-separated type codes into canonical categories and types", () => {
    // Wand
    const wand = items.find((i) => i.name === "+1 Wand of the War Mage");
    assert.ok(wand);
    assert.equal(wand.type, "Wand");
    assert.equal(wand.itemCategory, "Wand");
    assert.ok(!wand.type.includes("|"), "Type should not contain source pipe");

    // Rod
    const rod = items.find((i) => i.name === "+1 Rod of the Pact Keeper");
    assert.ok(rod);
    assert.equal(rod.type, "Rod");
    assert.equal(rod.itemCategory, "Rod");
    assert.ok(!rod.type.includes("|"));

    // Scroll
    const scroll = items.find((i) => i.name === "Nether Scroll of Azumar");
    assert.ok(scroll);
    assert.equal(scroll.type, "Scroll");
    assert.equal(scroll.itemCategory, "Scroll");

    // Ring
    const ring = items.find((i) => i.name === "Ring of Animal Influence");
    assert.ok(ring);
    assert.equal(ring.type, "Ring");
    assert.equal(ring.itemCategory, "Ring");

    // Ensure no items have raw pipes in type
    const itemsWithPipeType = items.filter((i) => i.type.includes("|"));
    assert.equal(itemsWithPipeType.length, 0, "No item should have an unparsed pipe in type");
  });
});
