import { test } from "node:test";
import assert from "node:assert/strict";
import { choiceSlotHeaders } from "../src/components/builder/equipmentSlotGroups.ts";
import type { StartingEquipmentCardSlot } from "../src/rules/startingEquipment.ts";

// Every name in this file is invented.

const option = (letter: string, chosen = false) => ({ letter, chosen, entries: [] });
const choice = (slot: number, ...options: ReturnType<typeof option>[]): StartingEquipmentCardSlot => ({
  kind: "choice",
  slot,
  options,
});
const fixed = (slot: number): StartingEquipmentCardSlot => ({ kind: "fixed", slot, entries: [] });
const unrecognised = (slot: number): StartingEquipmentCardSlot => ({ kind: "unrecognised", slot });

test("choice slots are numbered among the choice slots only", () => {
  const headers = choiceSlotHeaders([
    choice(0, option("a")),
    fixed(1),
    choice(2, option("a")),
    unrecognised(3),
    choice(4, option("a")),
  ]);
  assert.deepEqual(headers.get(0), { number: 1, total: 3, complete: false });
  assert.deepEqual(headers.get(2), { number: 2, total: 3, complete: false });
  assert.deepEqual(headers.get(4), { number: 3, total: 3, complete: false });
  assert.equal(headers.has(1), false);
  assert.equal(headers.has(3), false);
});

test("a choice slot is complete once one of its options is chosen", () => {
  const headers = choiceSlotHeaders([
    choice(0, option("a"), option("b", true)),
    choice(1, option("a"), option("b")),
  ]);
  assert.equal(headers.get(0)?.complete, true);
  assert.equal(headers.get(1)?.complete, false);
});

test("a card with no choice slots has no headers", () => {
  assert.equal(choiceSlotHeaders([fixed(0), unrecognised(1)]).size, 0);
});
