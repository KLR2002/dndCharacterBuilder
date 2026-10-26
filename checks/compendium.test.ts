import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_CATALOG_FORMAT, type CompendiumCollections } from "../src/services/compendiumStorage.ts";
import type { RaceData, SpellData, ItemData, ConditionData } from "../src/types/dnd5e.ts";
import { createCompendium, currentCompendium, integrate, revertToSrd } from "../src/services/compendium.ts";
import { getSpells, findSpell, isCompendiumIntegrated } from "../src/services/dataService.ts";

// In-memory collections only: the Compendium is a plain value, so these tests never touch the process default.
function bundle(overrides: Partial<CompendiumCollections> = {}): CompendiumCollections {
  return {
    hasIntegratedCatalog: true,
    races: [],
    classes: [],
    feats: [],
    backgrounds: [],
    items: [],
    spells: [],
    beasts: [],
    conditions: [],
    optionsAndFeatures: [],
    books: [],
    ...overrides,
  };
}

const spell = (name: string, source: string) => ({ name, source, level: 1 }) as unknown as SpellData;
const item = (name: string, source: string) => ({ name, source }) as unknown as ItemData;
const condition = (name: string, source: string) => ({ name, source }) as unknown as ConditionData;
const sub = (name: string, source: string) => ({ name, source });
const race = (name: string, source: string, subraces: { name: string; source: string }[]) =>
  ({ name, source, subraces }) as unknown as RaceData;
const names = (list: { name: string }[]) => list.map((entry) => entry.name);

test("scoped listings follow active books while name lookups resolve every book", () => {
  const integrated = bundle({
    spells: [spell("Fire Bolt", "PHB"), spell("Toll the Dead", "XGE")],
    races: [race("Elf", "PHB", [sub("High Elf", "PHB"), sub("Sea Elf", "XGE")])],
  });
  const compendium = createCompendium(integrated, bundle({ spells: [spell("Magic Missile", "SRD")] }));

  assert.deepEqual(names(compendium.for(["PHB"]).spells()), ["Fire Bolt"]);
  assert.deepEqual(names(compendium.for().spells()), ["Fire Bolt", "Toll the Dead"]);
  assert.deepEqual(names(compendium.for(["PHB"]).races()[0].subraces), ["High Elf"]);
  assert.equal(compendium.findSpell("Toll the Dead")?.source, "XGE", "lookups are not scoped by active books");
  assert.equal(compendium.findSpell("Toll the Dead", "PHB"), undefined, "source filter still applies to lookups");
  assert.equal(integrated.races[0].subraces.length, 2, "scoping must not mutate the bundle");
});

test("the SRD Baseline is not scoped by active books", () => {
  const srd = createCompendium(bundle({ hasIntegratedCatalog: false, spells: [spell("Magic Missile", "SRD")] }));

  assert.equal(srd.integrated, false);
  assert.deepEqual(names(srd.for(["XGE"]).spells()), ["Magic Missile"]);
});

test("dataset swap: an integrated Compendium returns no SRD records", () => {
  const compendium = createCompendium(
    bundle({
      spells: [spell("Magic Missile", "SRD"), spell("Toll the Dead", "XGE")],
      races: [race("Elf", "SRD", []), race("Tabaxi", "VGM", [])],
    }),
    bundle({ hasIntegratedCatalog: false, spells: [spell("Magic Missile", "SRD")], races: [race("Elf", "SRD", [])] }),
  );

  assert.deepEqual(names(compendium.for().spells()), ["Toll the Dead"], "SRD spell must not be listed");
  assert.equal(compendium.findSpell("Magic Missile"), undefined, "SRD spell must not be found by name");
  assert.deepEqual(names(compendium.for().races()), ["Tabaxi"], "SRD race must not be listed");
});

test("per-collection SRD fallback fills collections missing from an integrated catalog", () => {
  const partial: Partial<CompendiumCollections> = bundle({
    spells: [spell("Toll the Dead", "XGE")],
    conditions: [],
  });
  delete partial.items;
  const baseline = bundle({
    hasIntegratedCatalog: false,
    conditions: [condition("Blinded", "SRD")],
    items: [item("Dagger", "SRD")],
    spells: [spell("Magic Missile", "SRD")],
  });
  const compendium = createCompendium(partial as CompendiumCollections, baseline);

  assert.deepEqual(names(compendium.for().conditions()), ["Blinded"], "empty collection falls back");
  assert.equal(compendium.findItem("Dagger")?.source, "SRD", "missing collection falls back");
  assert.deepEqual(names(compendium.for(["XGE"]).items()), ["Dagger"], "fallback SRD records stay visible under book scope");
  assert.deepEqual(names(compendium.for(["XGE"]).spells()), ["Toll the Dead"], "present collection is not replaced");
});

test("integrate and revertToSrd move the process default that dataService reads", () => {
  try {
    integrate(bundle({ spells: [spell("Toll the Dead", "XGE")] }));

    assert.equal(currentCompendium().integrated, true);
    assert.equal(isCompendiumIntegrated(), true);
    assert.deepEqual(names(getSpells(["XGE"])), ["Toll the Dead"]);
    assert.equal(findSpell("Toll the Dead")?.source, "XGE");
  } finally {
    revertToSrd();
  }

  assert.equal(isCompendiumIntegrated(), false);
  assert.ok(getSpells().length > 1, "SRD Baseline spells are back after revertToSrd");
  assert.ok(getSpells().every((s) => s.source === "SRD"), "only SRD records after revertToSrd");
  assert.equal(findSpell("Toll the Dead"), undefined);
});

test("the Compendium reports stale only for an integrated catalog below the required format", () => {
  assert.equal(createCompendium(bundle({ catalogFormat: REQUIRED_CATALOG_FORMAT - 1 })).stale, true, "older format is stale");
  assert.equal(createCompendium(bundle()).stale, true, "a catalog with no format is stale");
  assert.equal(createCompendium(bundle({ catalogFormat: REQUIRED_CATALOG_FORMAT })).stale, false, "required format is current");
  assert.equal(createCompendium(bundle({ hasIntegratedCatalog: false })).stale, false, "the SRD Baseline is never stale");
});

test("the release bumps the catalog format by one: a catalog saved at format 7 is stale, one at 8 is current", () => {
  assert.equal(REQUIRED_CATALOG_FORMAT, 8, "the required format is 8 for this release");
  assert.equal(createCompendium(bundle({ catalogFormat: 7 })).stale, true, "the previous release's catalog must re-sync");
  assert.equal(createCompendium(bundle({ catalogFormat: 8 })).stale, false, "a catalog at the new format is current");
});
