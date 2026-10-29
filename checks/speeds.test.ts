import { ALL_BOOKS } from "../src/constants/books.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalogs } from "./testUtils.ts";
import { speed, characterSpeeds } from "../src/rules/speed.ts";
import type { InventoryItem } from "../src/types/character.ts";

const catalogs = loadTestCatalogs();
const tritonRace = catalogs.races.find(r => r.name === "Triton" && r.source === "VGM")!;
const tabaxiRace = catalogs.races.find(r => r.name === "Tabaxi" && r.source === "VGM")!;
const aarakocraRace = catalogs.races.find(r => r.name === "Aarakocra" && r.source === "EEPC")!;
const fairyRace = catalogs.races.find(r => r.name === "Fairy" && r.source === "MPMM")!;
const dhampirRace = catalogs.races.find(r => r.name === "Dhampir" && r.source === "VRGR")!;
const woodElfRace = catalogs.races.find(r => r.name === "Elf" && r.source === "PHB")!;
const dwarfRace = catalogs.races.find(r => r.name === "Dwarf" && r.source === "PHB")!;

function makeEquippedArmor(name: string, category: "light" | "medium" | "heavy", ac = 14): InventoryItem {
  return {
    id: `item_${name.toLowerCase()}`,
    name,
    quantity: 1,
    weight: 20,
    cost: "50 gp",
    isEquipped: true,
    section: "equipped",
    ac,
    armorCategory: category,
  };
}

test("characterSpeeds: base walk speed defaults to 30 ft when no race is assigned", () => {
  const char = makeChar();
  const speeds = characterSpeeds(char, { activeBooks: ALL_BOOKS });
  assert.equal(speeds.walk, 30);
  assert.equal(speeds.swim, undefined);
  assert.equal(speeds.climb, undefined);
  assert.equal(speeds.fly, undefined);
  assert.equal(speeds.flyRestricted, false);
  assert.equal(speed(char, { activeBooks: ALL_BOOKS }), 30);
});

test("characterSpeeds: respects race and subrace base walking speeds", () => {
  const dwarfChar = makeChar({ race: { name: "Dwarf", source: "PHB" } });
  const dwarfSpeeds = characterSpeeds(dwarfChar, { race: dwarfRace, activeBooks: ALL_BOOKS });
  assert.equal(dwarfSpeeds.walk, 25);
  assert.equal(speed(dwarfChar, { race: dwarfRace, activeBooks: ALL_BOOKS }), 25);

  const woodElfChar = makeChar({
    race: { name: "Elf", source: "PHB", subraceName: "Wood", subraceSource: "PHB" },
  });
  const woodElfSubrace = woodElfRace.subraces?.find(s => s.name === "Wood" || s.name === "Wood Elf");
  const woodElfSpeeds = characterSpeeds(woodElfChar, { race: woodElfRace, subrace: woodElfSubrace, activeBooks: ALL_BOOKS });
  assert.equal(woodElfSpeeds.walk, 35);
  assert.equal(speed(woodElfChar, { race: woodElfRace, subrace: woodElfSubrace, activeBooks: ALL_BOOKS }), 35);
});

test("characterSpeeds: evaluates innate racial swimming, climbing, and flying speeds", () => {
  // Triton: walk 30 ft, swim 30 ft
  const tritonChar = makeChar({ race: { name: "Triton", source: "VGM" } });
  const tritonSpeeds = characterSpeeds(tritonChar, { race: tritonRace, activeBooks: ALL_BOOKS });
  assert.equal(tritonSpeeds.walk, 30);
  assert.equal(tritonSpeeds.swim, 30);
  assert.equal(tritonSpeeds.fly, undefined);

  // Tabaxi: walk 30 ft, climb 20 ft
  const tabaxiChar = makeChar({ race: { name: "Tabaxi", source: "VGM" } });
  const tabaxiSpeeds = characterSpeeds(tabaxiChar, { race: tabaxiRace, activeBooks: ALL_BOOKS });
  assert.equal(tabaxiSpeeds.walk, 30);
  assert.equal(tabaxiSpeeds.climb, 20);

  // Aarakocra: walk 25 ft, fly 50 ft
  const aarakocraChar = makeChar({ race: { name: "Aarakocra", source: "EEPC" } });
  const aarakocraSpeeds = characterSpeeds(aarakocraChar, { race: aarakocraRace, activeBooks: ALL_BOOKS });
  assert.equal(aarakocraSpeeds.walk, 25);
  assert.equal(aarakocraSpeeds.fly, 50);
  assert.equal(aarakocraSpeeds.flyRestricted, false);
});

test("characterSpeeds: dynamic relative scaling for 'equal to your walking speed' traits", () => {
  // Dhampir Spider Climb specifies climbing speed equal to walking speed (base 35 ft)
  const dhampirChar = makeChar({ race: { name: "Dhampir", source: "VRGR" } });
  const baseSpeeds = characterSpeeds(dhampirChar, { race: dhampirRace, activeBooks: ALL_BOOKS });
  assert.equal(baseSpeeds.walk, 35);
  assert.equal(baseSpeeds.climb, 35);

  // Monk 2 Unarmored Movement (+10 ft) -> walk: 45, climb: 45
  const dhampirMonk = makeChar({
    race: { name: "Dhampir", source: "VRGR" },
    classes: [{ className: "Monk", level: 2, isStartingClass: true }],
  });
  const monkSpeeds = characterSpeeds(dhampirMonk, { race: dhampirRace, activeBooks: ALL_BOOKS });
  assert.equal(monkSpeeds.walk, 45);
  assert.equal(monkSpeeds.climb, 45);

  // Barbarian 5 Fast Movement (+10 ft) -> walk: 45, climb: 45
  const dhampirBarb = makeChar({
    race: { name: "Dhampir", source: "VRGR" },
    classes: [{ className: "Barbarian", level: 5, isStartingClass: true }],
  });
  const barbSpeeds = characterSpeeds(dhampirBarb, { race: dhampirRace, activeBooks: ALL_BOOKS });
  assert.equal(barbSpeeds.walk, 45);
  assert.equal(barbSpeeds.climb, 45);

  // Mobile feat (+10 ft)
  const dhampirMobile = makeChar({
    race: { name: "Dhampir", source: "VRGR" },
    asiSelections: [{ level: 4, type: "feat", featName: "Mobile" }],
  });
  const mobileSpeeds = characterSpeeds(dhampirMobile, { race: dhampirRace, activeBooks: ALL_BOOKS });
  assert.equal(mobileSpeeds.walk, 45);
  assert.equal(mobileSpeeds.climb, 45);

  // Fixed speeds (Tabaxi 20 ft climb) remain fixed even if walk increases
  const tabaxiMonk = makeChar({
    race: { name: "Tabaxi", source: "VGM" },
    classes: [{ className: "Monk", level: 2, isStartingClass: true }],
  });
  const tabaxiMonkSpeeds = characterSpeeds(tabaxiMonk, { race: tabaxiRace, activeBooks: ALL_BOOKS });
  assert.equal(tabaxiMonkSpeeds.walk, 40);
  assert.equal(tabaxiMonkSpeeds.climb, 20);
});

test("characterSpeeds: medium and heavy armor flight restrictions (negative boundary verification)", () => {
  // Aarakocra with light armor (leather): flight permitted
  const lightArmorChar = makeChar({
    race: { name: "Aarakocra", source: "EEPC" },
    items: [makeEquippedArmor("Leather Armor", "light", 11)],
  });
  const lightSpeeds = characterSpeeds(lightArmorChar, { race: aarakocraRace, activeBooks: ALL_BOOKS });
  assert.equal(lightSpeeds.fly, 50);
  assert.equal(lightSpeeds.flyRestricted, false);

  // Aarakocra with medium armor (breastplate): flight restricted to 0
  const medArmorChar = makeChar({
    race: { name: "Aarakocra", source: "EEPC" },
    items: [makeEquippedArmor("Breastplate", "medium", 14)],
  });
  const medSpeeds = characterSpeeds(medArmorChar, { race: aarakocraRace, activeBooks: ALL_BOOKS });
  assert.equal(medSpeeds.fly, 0);
  assert.equal(medSpeeds.flyRestricted, true);
  assert.ok(medSpeeds.details.some(d => d.mode === "fly" && d.restricted));

  // Fairy with heavy armor (plate): flight restricted to 0
  const heavyFairyChar = makeChar({
    race: { name: "Fairy", source: "MPMM" },
    items: [makeEquippedArmor("Plate Armor", "heavy", 18)],
  });
  const fairySpeeds = characterSpeeds(heavyFairyChar, { race: fairyRace, activeBooks: ALL_BOOKS });
  assert.equal(fairySpeeds.fly, 0);
  assert.equal(fairySpeeds.flyRestricted, true);

  // Non-flying race (Triton) with heavy armor: swim unaffected by armor
  const heavyTritonChar = makeChar({
    race: { name: "Triton", source: "VGM" },
    items: [makeEquippedArmor("Plate Armor", "heavy", 18)],
  });
  const tritonSpeeds = characterSpeeds(heavyTritonChar, { race: tritonRace, activeBooks: ALL_BOOKS });
  assert.equal(tritonSpeeds.swim, 30);
  assert.equal(tritonSpeeds.fly, undefined);
  assert.equal(tritonSpeeds.flyRestricted, false);
});
