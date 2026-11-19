import { ALL_BOOKS } from "../src/constants/books.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { armorClass } from "../src/rules/ac.ts";
import { getWeaponAttacks } from "../src/rules/attacks.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { makeChar } from "./testUtils.ts";

// Saves written before `section` left the item type. The records are untyped so they can carry the legacy field.
function loadWith(items: unknown[], classes = [{ className: "Fighter", source: "PHB", level: 1 }]) {
  const saved = { ...makeChar({ classes }), items };
  return migrateCharacter(JSON.parse(JSON.stringify(saved)), undefined, [], ALL_BOOKS);
}

describe("an item's equipped state is one field", () => {
  test("an old save's armor with section equipped and isEquipped false loads equipped and counts for AC", () => {
    const loaded = loadWith([
      { id: "chain", name: "Chain Mail", source: "PHB", quantity: 1, isEquipped: false, section: "equipped", ac: 16, armorCategory: "heavy" },
    ]);

    assert.equal(loaded.items[0].isEquipped, true);
    assert.equal(armorClass(loaded, { activeBooks: ALL_BOOKS }).ac, 16);
  });

  test("an item with isEquipped true and section carried loads equipped", () => {
    const loaded = loadWith([
      { id: "torch", name: "Torch", source: "PHB", quantity: 1, isEquipped: true, section: "carried" },
    ]);

    assert.equal(loaded.items[0].isEquipped, true);
  });

  test("a loaded item carries no section", () => {
    const loaded = loadWith([
      { id: "sword", name: "Longsword", source: "PHB", quantity: 1, isEquipped: false, section: "equipped", damage: "1d8", damageType: "slashing" },
      { id: "rope", name: "Rope", source: "PHB", quantity: 1, isEquipped: false, section: "carried" },
    ]);

    for (const item of loaded.items) assert.equal("section" in item, false, `${item.name} still has a section`);
  });

  test("an old save's weapon marked only by section equipped is listed by the attacks", () => {
    const loaded = loadWith([
      { id: "sword", name: "Longsword", source: "PHB", quantity: 1, isEquipped: false, section: "equipped", damage: "1d8", damageType: "slashing" },
    ]);

    const attacks = getWeaponAttacks(loaded, { catalogs: { activeBooks: ALL_BOOKS } });
    assert.deepEqual(attacks.map((attack) => attack.name), ["Longsword"]);
  });
});
