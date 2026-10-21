import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getItems } from "../src/services/dataService.ts";
import type { InventoryItem } from "../src/types/character.ts";
import { makeChar } from "./testUtils.ts";

describe("Inventory Compendium & Category Filtering", () => {
  it("category filtering returns matching items for all canonical categories without empty screens", () => {
    const allItems = getItems(["PHB", "DMG", "XGE", "TCE"]);

    const filterByCategory = (cat: string) => {
      const lower = cat.toLowerCase();
      return allItems.filter(
        (i) =>
          (i.itemCategory && i.itemCategory.toLowerCase() === lower) ||
          (i.type && i.type.toLowerCase() === lower) ||
          (i.type && i.type.toLowerCase().includes(lower))
      );
    };

    const wands = filterByCategory("Wand");
    assert.ok(wands.length >= 20, `Wands count should be >= 20, got ${wands.length}`);
    assert.ok(wands.every((w) => w.itemCategory === "Wand" || w.type.toLowerCase().includes("wand")));

    const rods = filterByCategory("Rod");
    assert.ok(rods.length > 10, `Rods count should be > 10, got ${rods.length}`);

    const scrolls = filterByCategory("Scroll");
    assert.ok(scrolls.length > 15, `Scrolls count should be > 15, got ${scrolls.length}`);

    const rings = filterByCategory("Ring");
    assert.ok(rings.length > 50, `Rings count should be > 50, got ${rings.length}`);

    const weapons = filterByCategory("Weapon");
    assert.ok(weapons.length > 100, `Weapons count should be > 100, got ${weapons.length}`);

    const shields = filterByCategory("Shield");
    assert.ok(shields.length > 3, `Shields count should be > 3, got ${shields.length}`);

    const armors = filterByCategory("Armor");
    assert.ok(armors.length > 20, `Armors count should be > 20, got ${armors.length}`);

    const potions = filterByCategory("Potion");
    assert.ok(potions.length > 15, `Potions count should be > 15, got ${potions.length}`);
  });

  it("search query matches +1, Warning, and specific weapon names", () => {
    const allItems = getItems(["PHB", "DMG"]);

    const search = (q: string) => {
      const lower = q.toLowerCase().trim();
      return allItems.filter(
        (i) =>
          i.name.toLowerCase().includes(lower) ||
          (i.type || "").toLowerCase().includes(lower) ||
          (i.itemCategory || "").toLowerCase().includes(lower)
      );
    };

    const plusOneResults = search("+1");
    assert.ok(plusOneResults.length > 30, `Search for '+1' should return > 30 items, got ${plusOneResults.length}`);
    assert.ok(plusOneResults.some((i) => i.name === "Longsword, +1"));
    assert.ok(plusOneResults.some((i) => i.name === "Shield, +1"));

    const warningResults = search("warning");
    assert.ok(warningResults.some((i) => i.name === "Weapon of Warning"));
    assert.ok(warningResults.some((i) => i.name === "Dagger of Warning"));
  });

  it("respects activeBooks toggles by filtering out disabled sourcebooks", () => {
    // Only PHB active
    const phbOnly = getItems(["PHB"]);
    assert.ok(phbOnly.every((i) => i.source === "PHB" || !i.source));
    assert.ok(phbOnly.some((i) => i.name === "Longsword"));
    // DMG-only items should not be in PHB-only list
    assert.ok(!phbOnly.some((i) => i.name === "Longsword, +1"));

    // PHB + DMG active
    const phbAndDmg = getItems(["PHB", "DMG"]);
    assert.ok(phbAndDmg.some((i) => i.name === "Longsword, +1"));
  });

  it("adding item from library preserves metadata: rarity, attunement, bonusWeapon, bonusAc, itemCategory", () => {
    const allItems = getItems(["PHB", "DMG"]);
    const longswordPlusTwo = allItems.find((i) => i.name === "Longsword, +2");
    assert.ok(longswordPlusTwo);

    // Simulate addItemFromLibrary mapping
    const itemToAdd: InventoryItem = {
      id: "test_item_1",
      name: longswordPlusTwo.name,
      source: longswordPlusTwo.source,
      quantity: 1,
      isEquipped: true,
      section: "equipped",
      weight: longswordPlusTwo.weight,
      cost: longswordPlusTwo.cost,
      damage: longswordPlusTwo.damage,
      damageType: longswordPlusTwo.damageType,
      range: longswordPlusTwo.range,
      ac: longswordPlusTwo.ac,
      rarity: longswordPlusTwo.rarity,
      attunement: longswordPlusTwo.attunement,
      bonusWeapon: longswordPlusTwo.bonusWeapon,
      bonusAc: longswordPlusTwo.bonusAc,
      itemCategory: longswordPlusTwo.itemCategory,
      description: longswordPlusTwo.description,
    };

    const char = makeChar({ items: [itemToAdd] });
    assert.equal(char.items?.[0].bonusWeapon, 2);
    assert.equal(char.items?.[0].rarity, "Rare");
    assert.equal(char.items?.[0].itemCategory, "Weapon");
  });
});
