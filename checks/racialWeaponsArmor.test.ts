import { test } from "node:test";
import assert from "node:assert/strict";
import type { Character, InventoryItem } from "../src/types/character.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { proficiencySheet } from "../src/rules/proficiencySheet.ts";
import { integratedTestCompendium, makeChar } from "./testUtils.ts";

// Racial weapon and armor proficiencies, read through the Proficiency Sheet from the Catalog. The
// Githyanki and Drow cases use the real race and subrace names, and the integrated Catalog they come from.

const compendium = integratedTestCompendium();
const sheetOf = (character: Character) => proficiencySheet(character, { compendium });
const namesOf = (entries: { name: string }[]) => entries.map((entry) => entry.name);

/** A wizard, whose own weapons never include a sword or a bow, so only the race's weapons show as swords and bows. */
function characterOf(race: Character["race"]): Character {
  return makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    race,
    background: { name: "Acolyte", source: "PHB" },
  });
}

const GITHYANKI = characterOf({ name: "Gith", source: "MTF", subraceName: "Githyanki", subraceSource: "MTF" });
const DROW = characterOf({ name: "Elf", source: "PHB", subraceName: "Drow", subraceSource: "PHB" });

test("a Githyanki holds the light and medium armor and the swords its subrace names", () => {
  const sheet = sheetOf(GITHYANKI);
  const armor = namesOf(sheet.armor);
  const weapons = namesOf(sheet.weapons);
  assert.ok(armor.includes("Light armor"), `armor: ${armor.join(", ")}`);
  assert.ok(armor.includes("Medium armor"), `armor: ${armor.join(", ")}`);
  for (const sword of ["Shortswords", "Longswords", "Greatswords"]) {
    assert.ok(weapons.includes(sword), `weapons: ${weapons.join(", ")}`);
  }
});

test("a Drow holds the weapons its subrace names, and none of the bows and swords of the other elves", () => {
  const weapons = namesOf(sheetOf(DROW).weapons);
  for (const weapon of ["Rapiers", "Shortswords", "Hand crossbows"]) {
    assert.ok(weapons.includes(weapon), `weapons: ${weapons.join(", ")}`);
  }
  for (const weapon of ["Longswords", "Shortbows", "Longbows"]) {
    assert.ok(!weapons.includes(weapon), `a Drow has no ${weapon}: ${weapons.join(", ")}`);
  }
});

test("the Githyanki race of Mordenkainen's Presents holds the swords and armor its own record names, which is none", () => {
  const race = characterOf({ name: "Githyanki", source: "MPMM" });
  assert.deepEqual(namesOf(sheetOf(race).armor), []);
  const weapons = namesOf(sheetOf(race).weapons);
  assert.ok(!weapons.includes("Longswords"), `weapons: ${weapons.join(", ")}`);
});

test("attacks read the sheet: an equipped sword is proficient for a Githyanki, and a longbow is not for a Drow", () => {
  const equip = (name: string): InventoryItem => ({
    id: `probe_${name}`,
    name,
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
  });
  const proficient = (character: Character, weapon: string) => {
    const evaluated = evaluateCharacter(
      { ...character, items: [...character.items, equip(weapon)] },
      { compendium },
    );
    const attack = evaluated.weaponAttacks.find((option) => option.name === weapon);
    assert.ok(attack, `${weapon} is offered as an attack`);
    return attack.isProficient;
  };
  assert.equal(proficient(GITHYANKI, "longsword"), true);
  assert.equal(proficient(DROW, "longbow"), false);
});
