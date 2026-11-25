import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS, ALL_RESOURCE_BOOKS } from "../src/constants/books.ts";
import { reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { inMemoryCompendium, loadTestCatalog, loadTestCatalogs, makeChar, srdBaselineCompendium } from "./testUtils.ts";
import type { BeastData } from "../src/types/dnd5e.ts";

const { activeBooks: _allBooks, ...collections } = loadTestCatalogs();

/** Every book code, for `reconcileForActiveBooks`, which takes a list rather than the unscoped `ALL_BOOKS`. */
const EVERY_BOOK = ALL_RESOURCE_BOOKS.map((b) => b.code);

/** An Integrated Catalog holding the given beasts; every other collection comes from the test catalog. */
const integratedWith = (beasts: BeastData[]) => inMemoryCompendium({ ...collections, beasts }, { integrated: true });

const withoutGiantBadger = loadTestCatalog<BeastData[]>("beasts").filter((b) => b.name !== "Giant Badger");

const badgerForm = { name: "Giant Badger", source: "MM", ac: 11, currentHp: 13, maxHp: 13, tempHp: 5 };

/** A Druid in the Giant Badger form: 20 HP, 2 temp HP of its own, one Wild Shape use spent of two. */
const druidInBadger = (overrides = {}) =>
  makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 5 }],
    currentHp: 20,
    tempHp: 2,
    activeWildShape: badgerForm,
    resourceCounters: {
      wild_shape: { id: "wild_shape", name: "Wild Shape", current: 1, max: 2, resetOn: "short" },
    },
    ...overrides,
  });

const BADGER_NOTICE = "Giant Badger form ended: Giant Badger is no longer in the catalog";

// The form ends like Revert. Temp HP goes back (the larger of the two), HP and the spent use stay.
for (const [label, compendium] of [
  ["the SRD Baseline (revert)", srdBaselineCompendium()],
  ["an Integrated Catalog with no beasts", integratedWith([])],
  ["an Integrated Catalog whose beasts lack Giant Badger", integratedWith(withoutGiantBadger)],
] as const) {
  test(`a Giant Badger form ends on ${label}, like Revert`, () => {
    const result = reconcileForActiveBooks(druidInBadger(), compendium, EVERY_BOOK);

    assert.equal(result.activeWildShape, null);
    assert.equal(result.tempHp, 5);
    assert.equal(result.currentHp, 20);
    assert.equal(result.resourceCounters.wild_shape.current, 1);
    assert.deepEqual(result.needsReview, [BADGER_NOTICE]);
  });
}

// A form whose beast is still there, or whose book is inactive, stays with no notice.
test("an SRD-sourced Brown Bear form stays on an Integrated Catalog that prints Brown Bear under MM", () => {
  const brownBear = { name: "Brown Bear", source: "SRD", ac: 11, currentHp: 34, maxHp: 34, tempHp: 5 };
  const character = druidInBadger({ activeWildShape: brownBear });
  const result = reconcileForActiveBooks(character, integratedWith(loadTestCatalog<BeastData[]>("beasts")), EVERY_BOOK);

  assert.deepEqual(result.activeWildShape, brownBear);
  assert.equal(result.needsReview, undefined);
});

test("an SRD-sourced Brown Bear form stays on an Integrated Catalog with no beasts (the SRD beasts remain)", () => {
  const brownBear = { name: "Brown Bear", source: "SRD", ac: 11, currentHp: 34, maxHp: 34, tempHp: 5 };
  const character = druidInBadger({ activeWildShape: brownBear });
  const result = reconcileForActiveBooks(character, integratedWith([]), EVERY_BOOK);

  assert.deepEqual(result.activeWildShape, brownBear);
  assert.equal(result.needsReview, undefined);
});

test("a Giant Badger form stays when its book is turned off in Active Books", () => {
  const character = druidInBadger();
  const result = reconcileForActiveBooks(character, integratedWith(loadTestCatalog<BeastData[]>("beasts")), ["PHB"]);

  assert.deepEqual(result.activeWildShape, badgerForm);
  assert.equal(result.needsReview, undefined);
});

// Favourites are saved, hidden while their beast is absent, and listed again with it.
const FAVOURITE = "Giant Badger__MM";

test("a favourite MM beast is kept in the save and hidden while its beast is absent", () => {
  const character = druidInBadger({ activeWildShape: null, favoriteWildShapes: [FAVOURITE] });
  const compendium = srdBaselineCompendium();
  const result = reconcileForActiveBooks(character, compendium, EVERY_BOOK);

  assert.deepEqual(result.favoriteWildShapes, [FAVOURITE]);
  assert.equal(
    compendium.for(ALL_BOOKS).beasts().some((b) => b.name === "Giant Badger" && b.source === "MM"),
    false,
  );
});

test("a favourite MM beast is listed again once a catalog with the beast is active", () => {
  const character = druidInBadger({ activeWildShape: null, favoriteWildShapes: [FAVOURITE] });
  const compendium = integratedWith(loadTestCatalog<BeastData[]>("beasts"));
  const result = reconcileForActiveBooks(character, compendium, EVERY_BOOK);

  assert.deepEqual(result.favoriteWildShapes, [FAVOURITE]);
  assert.ok(compendium.for(ALL_BOOKS).beasts().some((b) => b.name === "Giant Badger" && b.source === "MM"));
});
