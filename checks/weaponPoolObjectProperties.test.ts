import test from "node:test";
import assert from "node:assert/strict";
import type { ItemData } from "../src/types/dnd5e.ts";
import { poolNames, type ChoiceProficiencyGrant } from "../src/rules/proficiencyPools.ts";

/**
 * A catalog cached before the scraper turned object-form properties into names still holds them as objects.
 * The weapons pool must read such an item by its other properties, and must not throw on the object.
 */

const inventedWeapon = (overrides: Partial<ItemData>): ItemData => ({
  name: "Invented Blade",
  source: "OTB",
  type: "Melee Weapon",
  itemCategory: "Weapon",
  rarity: "None",
  attunement: false,
  cost: null,
  weight: 2,
  damage: "1d6",
  damageType: "slashing",
  range: null,
  properties: [],
  ac: null,
  strengthRequirement: null,
  stealthDisadvantage: false,
  description: "",
  ...overrides,
});

/** A property in the object form the source data uses: a uid naming the property and a free-text note. */
const objectProperty = (uid: string) => ({ uid, note: "invented note" }) as unknown as string;

const martialMelee: ChoiceProficiencyGrant = {
  id: "invented/martial-melee",
  kind: "choice",
  category: "weapons",
  count: 1,
  pool: { kind: "weapons", base: ["martial"], withoutProperties: ["Heavy"], plus: [] },
};

test("a weapon with an object-form property is offered by its other properties", () => {
  const items = [
    inventedWeapon({ name: "Lantern Rapier", weaponCategory: "martial", properties: ["Finesse", objectProperty("2H|XPHB")] }),
  ];
  assert.deepEqual(poolNames(martialMelee, items), ["Lantern Rapier"]);
});

test("a string property still excludes a weapon that also carries an object-form property", () => {
  const items = [
    inventedWeapon({ name: "Lantern Rapier", weaponCategory: "martial", properties: ["Finesse", objectProperty("2H|XPHB")] }),
    inventedWeapon({ name: "Ember Maul", weaponCategory: "martial", properties: [objectProperty("F|OTB"), "Heavy"] }),
  ];
  assert.deepEqual(poolNames(martialMelee, items), ["Lantern Rapier"]);
});
