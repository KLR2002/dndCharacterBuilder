import { ALL_BOOKS } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium, loadSrdCatalog } from "./testUtils.ts";
import { applyAncestrySelection, resolveAncestryState } from "../src/rules/ancestryEngine.ts";
import { changeLineage, changeRace, setSizeChoice } from "../src/rules/builderTransitions.ts";
import { resolvedSize } from "../src/rules/sizeChoice.ts";
import type { RaceData } from "../src/types/dnd5e.ts";

// The Size Choice: the size a race or lineage lists, offered when it lists two or more, and released when the held
// record stops listing it. Every name and size is invented.

const race = (name: string, size: string[], extra: Partial<RaceData> = {}): RaceData => ({
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
  ...extra,
});

const STOUT = "Sample Stout";
const STOUT_KIN = "Sample Stout Kin";
const TALL = "Sample Tall";
const LITTLE_LINEAGE = "Sample Little Lineage";
const TALL_LINEAGE = "Sample Tall Lineage";
const ACTIVE = ["TST"];

const records = [
  race(STOUT, ["Small", "Medium"]),
  race(STOUT_KIN, ["Small", "Medium"]),
  race(TALL, ["Medium"]),
  race(LITTLE_LINEAGE, ["Small", "Medium"]),
  race(TALL_LINEAGE, ["Medium"]),
];

const integrated = { compendium: inMemoryCompendium({ races: records }, { integrated: true }), activeBooks: ALL_BOOKS };
const srdOnly = { compendium: inMemoryCompendium({ races: records }), activeBooks: ALL_BOOKS };

const holding = (name: string, extra: Record<string, unknown> = {}) =>
  makeChar({ race: { name, source: "TST" }, ...extra });

test("a race listing two sizes offers both, with the first shown until the player picks", () => {
  const state = resolveAncestryState(holding(STOUT), integrated);

  assert.deepEqual(state.sizeOptions, ["Small", "Medium"]);
  assert.equal(state.size, "Small");
});

test("the picked size is the one shown when the held race lists it", () => {
  const state = resolveAncestryState(holding(STOUT, { sizeChoice: "Medium" }), integrated);

  assert.equal(state.size, "Medium");
  assert.deepEqual(state.sizeOptions, ["Small", "Medium"]);
});

test("a race listing one size offers no size choice and shows that size", () => {
  const state = resolveAncestryState(holding(TALL), integrated);

  assert.deepEqual(state.sizeOptions, []);
  assert.equal(state.size, "Medium");
});

test("a pick the held race does not list is not applied", () => {
  const state = resolveAncestryState(holding(TALL, { sizeChoice: "Small" }), integrated);

  assert.equal(state.size, "Medium");
});

test("a held lineage's sizes replace the race's", () => {
  const character = makeChar({
    race: { name: TALL, source: "TST" },
    lineageReplacement: LITTLE_LINEAGE,
    sizeChoice: "Small",
  });

  const state = resolveAncestryState(character, integrated);

  assert.deepEqual(state.sizeOptions, ["Small", "Medium"]);
  assert.equal(state.size, "Small");
});

test("the player records a listed size, and no size the held race does not list or a single-size race", () => {
  const stout = holding(STOUT);

  const picked = setSizeChoice(stout, "Medium", integrated);
  assert.equal(picked.sizeChoice, "Medium");
  assert.equal(resolvedSize(picked, integrated), "Medium");

  assert.equal(setSizeChoice(stout, "Tiny", integrated).sizeChoice, undefined, "an unlisted size is refused");
  assert.equal(setSizeChoice(holding(TALL), "Small", integrated).sizeChoice, undefined, "a one-size race offers no choice");
});

test("applying a race that also lists the picked size keeps the pick", () => {
  const before = holding(STOUT, { sizeChoice: "Medium" });

  const after = applyAncestrySelection(before, records[1], undefined, integrated);

  assert.equal(after.sizeChoice, "Medium");
  assert.equal(resolveAncestryState(after, integrated).size, "Medium");
});

test("applying a race that does not list the picked size releases the pick and shows the first size", () => {
  const before = holding(STOUT, { sizeChoice: "Small" });

  const after = applyAncestrySelection(before, records[2], undefined, integrated);

  assert.equal(after.sizeChoice, undefined);
  assert.equal(resolveAncestryState(after, integrated).size, "Medium");
});

test("changing the race away releases the pick", () => {
  const before = holding(STOUT, { sizeChoice: "Small" });

  const after = changeRace(before, integrated.compendium, ALL_BOOKS);

  assert.equal(after.sizeChoice, undefined);
});

test("changing the lineage to one that does not list the picked size releases the pick", () => {
  const before = makeChar({
    race: { name: TALL, source: "TST" },
    lineageReplacement: LITTLE_LINEAGE,
    sizeChoice: "Small",
  });

  const after = changeLineage(before, { kind: "lineage", name: TALL_LINEAGE }, integrated.compendium, ACTIVE);

  assert.equal(after.sizeChoice, undefined);
  assert.equal(resolveAncestryState(after, integrated).size, "Medium");
});

test("the SRD Baseline offers no size choice for any race it holds", () => {
  const srdRaces = loadSrdCatalog<RaceData[]>("races");
  const compendium = inMemoryCompendium({ races: srdRaces });

  for (const srdRace of srdRaces) {
    const state = resolveAncestryState(
      makeChar({ race: { name: srdRace.name, source: srdRace.source } }),
      { compendium, activeBooks: ALL_BOOKS },
    );
    assert.deepEqual(state.sizeOptions, [], `${srdRace.name} offers no size choice`);
  }
});

test("a character saved on the SRD Baseline resolves the same size once the integrated catalog loads", () => {
  const saved = makeChar({ race: { name: TALL, source: "SRD" } });
  const integratedWithSameName = inMemoryCompendium(
    { races: [race(TALL, ["Medium"], { source: "TST" })] },
    { integrated: true },
  );

  const onSrd = resolveAncestryState(saved, { compendium: srdOnly.compendium, activeBooks: ALL_BOOKS }).size;
  const onIntegrated = resolveAncestryState(saved, { compendium: integratedWithSameName, activeBooks: ALL_BOOKS }).size;

  assert.equal(onSrd, "Medium");
  assert.equal(onIntegrated, onSrd);
});
