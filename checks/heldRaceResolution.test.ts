import test from "node:test";
import assert from "node:assert/strict";
import { findRace } from "../src/services/dataService.ts";
import { integrate } from "../src/services/compendium.ts";
import { resetTestCompendium } from "./testUtils.ts";
import type { RaceData, SubraceData } from "../src/types/dnd5e.ts";

// The Journal reads a held race with its subrace through the active Compendium. Every name here is invented.

const subrace = (source: string): SubraceData => ({
  name: "Sample Line",
  source,
  raceName: "Sample Kin",
  raceSource: source,
  isVariant: false,
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
});

const kin = (source: string): RaceData => ({
  name: "Sample Kin",
  source,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [subrace(source)],
  description: "Placeholder description for the race.",
});

test("a held race with its subrace resolves to the record of the active book, and the saved source is kept", () => {
  integrate({
    hasIntegratedCatalog: true,
    races: [kin("OLD"), kin("ALT")],
    classes: [],
    feats: [],
    backgrounds: [],
    items: [],
    spells: [],
    beasts: [],
    conditions: [],
    optionsAndFeatures: [],
    books: [],
  });
  try {
    const held = { name: "Sample Kin", source: "GONE", subraceName: "Sample Line", subraceSource: "GONE" };
    assert.equal(findRace(held, ["ALT"])?.source, "ALT", "the active book's record is the one the Journal reads");
    assert.equal(findRace(held)?.source, "OLD", "without active books, the first record listed");
    assert.equal(findRace({ name: "Sample Kin", source: "ALT", subraceName: "Sample Line", subraceSource: "ALT" }, ["OLD"])?.source, "ALT", "a saved source is kept");
  } finally {
    resetTestCompendium();
  }
});
