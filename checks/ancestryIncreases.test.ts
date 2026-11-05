import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium } from "./testUtils.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { effectiveScores } from "../src/rules/abilities.ts";
import { reconcile } from "../src/rules/characterReconciler.ts";
import type { RaceData, SubraceData } from "../src/types/dnd5e.ts";

// A race's and a subrace's Fixed Increases combine, unless the subrace replaces them. Every name here is invented.

const SOURCE = "TST";
const ACTIVE = [SOURCE];

const TIEFLING = "Sample Tiefling";
const FIEND = "Sample Fiend";
const VARIANT = "Sample Variant";
const DWARF = "Sample Dwarf";
const HILL = "Sample Hill";

const subrace = (name: string, raceName: string, abilityScoreIncrease: Record<string, number>[], extra: Partial<SubraceData> = {}): SubraceData => ({
  name,
  source: SOURCE,
  raceName,
  raceSource: SOURCE,
  abilityScoreIncrease,
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
  ...extra,
});

const race = (name: string, abilityScoreIncrease: Record<string, number>[], subraces: SubraceData[] = []): RaceData => ({
  name,
  source: SOURCE,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease,
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces,
  description: "Placeholder description for the race.",
});

const tiefling = race(TIEFLING, [{ int: 1 }, { cha: 2 }]);
const fiend = subrace(FIEND, TIEFLING, [{ dex: 1 }, { cha: 2 }], { replacesRaceAbilityScores: true });
const variant = subrace(VARIANT, TIEFLING, [{ int: 1 }], {
  replacesRaceAbilityScores: true,
  abilityScoreChoices: [{ from: ["dex", "cha"], count: 1, amount: 2 }],
});
const dwarf = race(DWARF, [{ con: 2 }], [subrace(HILL, DWARF, [{ wis: 1 }])]);

const compendium = inMemoryCompendium({ races: [{ ...tiefling, subraces: [fiend, variant] }, dwarf] }, { integrated: true });
const catalogs = { compendium, activeBooks: ACTIVE };

test("a replacing subrace gives only its own Fixed Increases", () => {
  const held = applyAncestrySelection(makeChar(), tiefling, fiend, catalogs);
  const { scores } = effectiveScores(held);
  assert.equal(scores.dex, 11);
  assert.equal(scores.cha, 12);
  assert.equal(scores.int, 10);
});

test("with no saved scores, effectiveScores gives a replacing subrace's Fixed Increases alone", () => {
  const held = makeChar({ race: { name: TIEFLING, source: SOURCE, subraceName: FIEND, subraceSource: SOURCE } });
  const { scores } = effectiveScores(held, { race: tiefling, subrace: fiend });
  assert.equal(scores.dex, 11);
  assert.equal(scores.cha, 12);
  assert.equal(scores.int, 10);
});

test("a replacing subrace's Fixed Increase applies alone until its Increase Choice is picked", () => {
  const held = applyAncestrySelection(makeChar(), tiefling, variant, catalogs);
  const { scores } = effectiveScores(held);
  assert.equal(scores.int, 11);
  assert.equal(scores.dex, 10);
  assert.equal(scores.cha, 10);
});

test("a replacing subrace's Increase Choice applies with its saved pick", () => {
  const held = applyAncestrySelection(makeChar(), tiefling, variant, catalogs);
  const picked = reconcile({ ...held, racialChoiceBonus: [{ key: "cha", amount: 2 }] }, compendium, { activeBooks: ACTIVE });
  const { scores } = effectiveScores(picked);
  assert.equal(scores.int, 11);
  assert.equal(scores.cha, 12);
  assert.equal(scores.dex, 10);
});

test("a non-replacing subrace adds its Fixed Increases to its race's", () => {
  const held = applyAncestrySelection(makeChar(), dwarf, dwarf.subraces[0], catalogs);
  const { scores } = effectiveScores(held);
  assert.equal(scores.con, 12);
  assert.equal(scores.wis, 11);
});
