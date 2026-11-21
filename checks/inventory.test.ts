import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  ATTUNEMENT_LIMIT,
  changeCoin,
  changeItemQuantity,
  customItem,
  itemFromCatalog,
  removeItem,
  setCoin,
  swapAttunement,
  toggleAttunement,
  toggleEquipped,
} from "../src/rules/inventory.ts";
import type { InventoryItem } from "../src/types/character.ts";
import { makeChar } from "./testUtils.ts";

function item(id: string, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return { id, name: id, source: "PHB", quantity: 1, isEquipped: false, ...overrides };
}

const attunable = (id: string) => item(id, { attunement: true });

describe("equipping", () => {
  test("toggleEquipped flips an item on and back off", () => {
    const start = makeChar({ items: [item("sword")] });

    const equipped = toggleEquipped(start, "sword");
    assert.equal(equipped.items[0].isEquipped, true);

    const carried = toggleEquipped(equipped, "sword");
    assert.equal(carried.items[0].isEquipped, false);
  });
});

describe("quantity", () => {
  test("changeItemQuantity +1 raises the count", () => {
    const next = changeItemQuantity(makeChar({ items: [item("arrows", { quantity: 2 })] }), "arrows", 1);
    assert.equal(next.items[0].quantity, 3);
  });

  test("changeItemQuantity -1 at quantity 1 removes the item", () => {
    const next = changeItemQuantity(makeChar({ items: [item("torch")] }), "torch", -1);
    assert.deepEqual(next.items, []);
  });

  test("removeItem drops only the named item", () => {
    const next = removeItem(makeChar({ items: [item("a"), item("b")] }), "a");
    assert.deepEqual(next.items.map((i) => i.id), ["b"]);
  });
});

describe("attunement", () => {
  test("the limit is three", () => {
    assert.equal(ATTUNEMENT_LIMIT, 3);
  });

  test("attunes up to three items, then a fourth returns swapNeeded", () => {
    let character = makeChar({ items: [attunable("a"), attunable("b"), attunable("c"), attunable("d")] });
    for (const id of ["a", "b", "c"]) {
      const result = toggleAttunement(character, id);
      assert.ok("character" in result, `${id} attunes`);
      character = result.character;
    }

    assert.deepEqual(toggleAttunement(character, "d"), { swapNeeded: true });
  });

  test("swapAttunement moves attunement from one item to another", () => {
    const character = makeChar({
      items: [attunable("a"), attunable("b"), attunable("c"), attunable("d")].map((i) =>
        i.id === "a" || i.id === "b" || i.id === "c" ? { ...i, isAttuned: true } : i,
      ),
    });

    const swapped = swapAttunement(character, "a", "d");
    assert.deepEqual(
      swapped.items.map((i) => [i.id, i.isAttuned === true]),
      [["a", false], ["b", true], ["c", true], ["d", true]],
    );
  });

  test("toggleAttunement on an attuned item unattunes it", () => {
    const character = makeChar({ items: [item("ring", { attunement: true, isAttuned: true })] });

    const result = toggleAttunement(character, "ring");
    assert.ok("character" in result);
    assert.equal(result.character.items[0].isAttuned, false);
  });
});

describe("coins", () => {
  test("changeCoin never takes a coin below zero", () => {
    const next = changeCoin(makeChar({ pouch: { cp: 0, sp: 0, ep: 0, gp: 2, pp: 0 } }), "gp", -5);
    assert.equal(next.pouch.gp, 0);
  });

  test("setCoin with text that is not a number sets the coin to zero", () => {
    const next = setCoin(makeChar({ pouch: { cp: 0, sp: 0, ep: 0, gp: 9, pp: 0 } }), "gp", "abc");
    assert.equal(next.pouch.gp, 0);
  });

  test("setCoin never sets a negative value", () => {
    const next = setCoin(makeChar(), "sp", "-4");
    assert.equal(next.pouch.sp, 0);
  });
});

describe("building items", () => {
  test("customItem reads +1 from the name as the weapon bonus when a damage is given", () => {
    const built = customItem({
      name: "Longsword +1",
      weight: "",
      cost: "",
      damage: "1d8 slashing",
      ac: "",
      bonusWeapon: "",
      bonusAc: "",
      description: "",
      equipped: true,
    });

    assert.equal(built.name, "Longsword +1");
    assert.equal(built.bonusWeapon, 1);
    assert.equal(built.isEquipped, true);
    assert.equal(built.isCustom, true);
    assert.equal(built.source, "Custom");
  });

  test("itemFromCatalog keeps rarity, attunement and armor class from the record", () => {
    const built = itemFromCatalog({
      name: "Glimmer Charm",
      source: "Test Book",
      type: "Wondrous Item",
      rarity: "Uncommon",
      attunement: "by a wizard",
      ac: 13,
    });

    assert.equal(built.rarity, "Uncommon");
    assert.equal(built.attunement, "by a wizard");
    assert.equal(built.ac, 13);
    assert.equal(built.isEquipped, false);
    assert.equal(built.quantity, 1);
  });
});
