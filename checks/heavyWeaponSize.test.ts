import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";
import { getWeaponAttacks } from "../src/rules/attacks.ts";
import type { RaceData } from "../src/types/dnd5e.ts";
import type { InventoryItem } from "../src/types/character.ts";

// A Small character attacks with a disadvantage marker when the weapon has the Heavy property. Every name and size is invented,
// except the two SRD weapons, which the weapon table reads by name.

const race = (name: string, size: string[]): RaceData => ({
  name,
  source: "TST",
  size,
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
});

const compendium = inMemoryCompendium(
  {
    races: [
      race("Sample Stout", ["Small", "Medium"]),
      race("Sample Little", ["Small"]),
      race("Sample Tall", ["Medium"]),
    ],
  },
  { integrated: true },
);
const catalogs = { compendium, activeBooks: ALL_BOOKS };

const weapon = (name: string): InventoryItem => ({
  id: name.toLowerCase(),
  name,
  source: "PHB",
  quantity: 1,
  isEquipped: true,
  section: "equipped",
});

const DISADVANTAGE = "Disadvantage";

test("a Small character picked by the player shows the marker on a Heavy weapon", () => {
  const char = makeChar({
    race: { name: "Sample Stout", source: "TST" },
    sizeChoice: "Small",
    items: [weapon("Greatsword")],
  });

  const [attack] = getWeaponAttacks(char, { catalogs });

  assert.equal(attack.disadvantage, true);
  assert.ok(attack.calculationBadges?.includes(DISADVANTAGE));
});

test("a race that lists only Small shows the marker on a Heavy weapon", () => {
  const char = makeChar({
    race: { name: "Sample Little", source: "TST" },
    items: [weapon("Greatsword")],
  });

  const [attack] = getWeaponAttacks(char, { catalogs });

  assert.equal(attack.disadvantage, true);
  assert.ok(attack.calculationBadges?.includes(DISADVANTAGE));
});

test("a Medium character shows no marker on a Heavy weapon", () => {
  const char = makeChar({
    race: { name: "Sample Tall", source: "TST" },
    items: [weapon("Greatsword")],
  });

  const [attack] = getWeaponAttacks(char, { catalogs });

  assert.equal(attack.disadvantage, undefined);
  assert.equal(attack.calculationBadges, undefined);
});

test("a character with no race shows no marker on a Heavy weapon", () => {
  const char = makeChar({ race: null, items: [weapon("Greatsword")] });

  const [attack] = getWeaponAttacks(char, { catalogs });

  assert.equal(attack.disadvantage, undefined);
  assert.equal(attack.calculationBadges, undefined);
});

test("a Small character shows no marker on a weapon without the Heavy property", () => {
  const char = makeChar({
    race: { name: "Sample Little", source: "TST" },
    items: [weapon("Longsword")],
  });

  const [attack] = getWeaponAttacks(char, { catalogs });

  assert.equal(attack.disadvantage, undefined);
  assert.equal(attack.calculationBadges, undefined);
});
