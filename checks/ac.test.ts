import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar } from "./testUtils.ts";
import { armorClass } from "../src/rules/ac.ts";
import type { ArmorCategory, InventoryItem } from "../src/types/character.ts";

const opts = { activeBooks: ALL_BOOKS };

const gear = (id: string, name: string, extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id, name, source: "PHB", quantity: 1, isEquipped: true, weight: 1, ...extra,
});

const armor = (id: string, name: string, ac: number, armorCategory: ArmorCategory): InventoryItem =>
  gear(id, name, { ac, armorCategory, weight: 20 });

const shield = gear("shield_1", "Shield", { ac: 2, armorCategory: "shield", weight: 6 });
const charm = gear("charm_1", "Charm of Warding", { bonusAc: 1 });

test("armor AC breakdown text is pinned for medium armor, Defense, a shield and a magic item", () => {
  const char = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    items: [armor("armor_1", "Breastplate", 14, "medium"), shield, charm],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Defense"],
        picked: ["Defense"],
      },
    ],
  });
  const result = armorClass(char, opts);
  assert.equal(result.ac, 20);
  assert.equal(result.breakdown, "14 (Armor) + 2 (Dex max 2) + 2 (Shield) + 1 (Defense) + 1 (Magic Item)");
});

test("armor AC breakdown text is pinned for heavy armor with Enhanced Defense on the armor", () => {
  const char = makeChar({
    classes: [{ className: "Artificer", source: "PHB", level:10 }],
    items: [armor("armor_1", "Chain Mail", 16, "heavy")],
    activeInfusions: [{ infusionName: "Enhanced Defense", targetItemId: "armor_1" }],
  });
  const result = armorClass(char, opts);
  assert.equal(result.ac, 18);
  assert.equal(result.breakdown, "16 (Armor) + 2 (Enhanced Defense)");
});

test("unarmored Barbarian breakdown text is pinned with and without a shield", () => {
  const withShield = makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 1 }],
    baseAbilityScores: { str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    items: [shield],
  });
  assert.equal(armorClass(withShield, opts).ac, 15);
  assert.equal(armorClass(withShield, opts).breakdown, "10 + 1 (Dex) + 2 (Con) + 2 (Shield)");

  const bare = makeChar({ ...withShield, items: [] });
  assert.equal(armorClass(bare, opts).ac, 13);
  assert.equal(armorClass(bare, opts).breakdown, "10 + 1 (Dex) + 2 (Con)");
});

test("unarmored Monk breakdown text is pinned with and without a magic item", () => {
  const bare = makeChar({
    classes: [{ className: "Monk", source: "PHB", level: 2 }],
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 16, cha: 10 },
  });
  assert.equal(armorClass(bare, opts).ac, 15);
  assert.equal(armorClass(bare, opts).breakdown, "10 + 2 (Dex) + 3 (Wis)");

  const withCharm = makeChar({ ...bare, items: [charm] });
  assert.equal(armorClass(withCharm, opts).ac, 16);
  assert.equal(armorClass(withCharm, opts).breakdown, "10 + 2 (Dex) + 3 (Wis) + 1 (Magic Item)");
});

test("plain AC breakdown text is pinned for a shield with Repulsion Shield and a negative Dex modifier", () => {
  const repulsion = makeChar({
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", source: "PHB", level:6 }],
    items: [shield],
    activeInfusions: [{ infusionName: "Repulsion Shield", targetItemId: "shield_1" }],
  });
  assert.equal(armorClass(repulsion, opts).ac, 15);
  assert.equal(armorClass(repulsion, opts).breakdown, "10 + 2 (Dex) + 2 (Shield) + 1 (Repulsion Shield)");

  const enhancedShield = makeChar({ ...repulsion, classes: [{ className: "Artificer", source: "PHB", level:2 }], activeInfusions: [{ infusionName: "Enhanced Defense", targetItemId: "shield_1" }] });
  assert.equal(armorClass(enhancedShield, opts).breakdown, "10 + 2 (Dex) + 2 (Shield) + 1 (Enhanced Defense)");

  const lowDex = makeChar({ baseAbilityScores: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 } });
  assert.equal(armorClass(lowDex, opts).ac, 9);
  assert.equal(armorClass(lowDex, opts).breakdown, "10 + -1 (Dex)");
});

const partsSumToAc = (result: ReturnType<typeof armorClass>) =>
  assert.equal(result.parts.reduce((total, part) => total + part.value, 0), result.ac);

test("armor AC parts sum to ac for medium armor with a shield, Defense and a magic item", () => {
  const char = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }],
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    items: [armor("armor_1", "Breastplate", 14, "medium"), shield, charm],
    ruleChoices: [
      {
        id: "PHB__Fighter__Fighting Style",
        trait: "Fighting Style",
        origin: "class",
        choose: 1,
        from: ["Defense"],
        picked: ["Defense"],
      },
    ],
  });
  const result = armorClass(char, opts);
  partsSumToAc(result);
  assert.deepEqual(result.parts, [
    { kind: "base", label: "Armor", value: 14 },
    { kind: "ability", label: "Dex max 2", value: 2 },
    { kind: "shield", label: "Shield", value: 2 },
    { kind: "fightingStyle", label: "Defense", value: 1 },
    { kind: "magic", label: "Magic Item", value: 1 },
  ]);
});

test("armor AC parts give Enhanced Defense on heavy armor an infusion part and no Dex part", () => {
  const char = makeChar({
    classes: [{ className: "Artificer", source: "PHB", level: 10 }],
    items: [armor("armor_1", "Chain Mail", 16, "heavy")],
    activeInfusions: [{ infusionName: "Enhanced Defense", targetItemId: "armor_1" }],
  });
  const result = armorClass(char, opts);
  partsSumToAc(result);
  assert.deepEqual(result.parts, [
    { kind: "base", label: "Armor", value: 16 },
    { kind: "infusion", label: "Enhanced Defense", value: 2 },
  ]);
});

test("unarmored Barbarian AC parts sum to ac and carry the Constitution part", () => {
  const char = makeChar({
    classes: [{ className: "Barbarian", source: "PHB", level: 1 }],
    baseAbilityScores: { str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    items: [shield],
  });
  const result = armorClass(char, opts);
  partsSumToAc(result);
  assert.deepEqual(result.parts, [
    { kind: "base", label: "", value: 10 },
    { kind: "ability", label: "Dex", value: 1 },
    { kind: "ability", label: "Con", value: 2 },
    { kind: "shield", label: "Shield", value: 2 },
  ]);
});

test("unarmored Monk AC parts sum to ac with the Wisdom part and a magic item", () => {
  const char = makeChar({
    classes: [{ className: "Monk", source: "PHB", level: 2 }],
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 10, wis: 16, cha: 10 },
    items: [charm],
  });
  const result = armorClass(char, opts);
  partsSumToAc(result);
  assert.deepEqual(result.parts, [
    { kind: "base", label: "", value: 10 },
    { kind: "ability", label: "Dex", value: 2 },
    { kind: "ability", label: "Wis", value: 3 },
    { kind: "magic", label: "Magic Item", value: 1 },
  ]);
});

test("plain AC parts sum to ac and give Repulsion Shield an infusion part", () => {
  const char = makeChar({
    baseAbilityScores: { str: 10, dex: 14, con: 10, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Artificer", source: "PHB", level: 6 }],
    items: [shield],
    activeInfusions: [{ infusionName: "Repulsion Shield", targetItemId: "shield_1" }],
  });
  const result = armorClass(char, opts);
  partsSumToAc(result);
  assert.deepEqual(result.parts, [
    { kind: "base", label: "", value: 10 },
    { kind: "ability", label: "Dex", value: 2 },
    { kind: "shield", label: "Shield", value: 2 },
    { kind: "infusion", label: "Repulsion Shield", value: 1 },
  ]);
});
