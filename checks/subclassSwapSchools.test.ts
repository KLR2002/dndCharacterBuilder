import { test } from "node:test";
import assert from "node:assert/strict";
import { getSubclassAllowedSwapSchools, isSubclassSpellReplaceable } from "../src/rules/subclassSpells.ts";
import { integratedTestCompendium } from "./testUtils.ts";

/**
 * The Sorcerer subclasses whose spells may be swapped carry their allowed schools in a curated
 * table. The swap is available only for the subclasses listed here. Nothing reads the subclass
 * text at runtime.
 */
const SWAPPING_SUBCLASSES = ["Clockwork Soul", "Aberrant Mind"];

const compendium = integratedTestCompendium();
const sorcerer = compendium.for().classes().find((c) => c.name === "Sorcerer");
const sorcererSubclasses = sorcerer?.subclasses ?? [];
const catalogSchools = new Set(
  compendium
    .for()
    .spells()
    .map((s) => (s.school ?? "").toLowerCase())
    .filter(Boolean),
);

test("Clockwork Soul and Aberrant Mind are Sorcerer subclasses in the default test catalog", () => {
  assert.ok(sorcerer, "the catalog has a Sorcerer class");
  const names = sorcererSubclasses.map((sc) => sc.name);
  for (const subclass of SWAPPING_SUBCLASSES) {
    assert.ok(names.includes(subclass), `${subclass} is a Sorcerer subclass`);
  }
});

test("each swapping subclass allows at least one spell school, and every allowed school is a catalog school", () => {
  for (const subclass of SWAPPING_SUBCLASSES) {
    const schools = getSubclassAllowedSwapSchools(subclass);
    assert.ok(schools.length > 0, `${subclass} allows at least one school`);
    assert.ok(isSubclassSpellReplaceable("Sorcerer", subclass, 1), `${subclass} is replaceable`);
    for (const school of schools) {
      assert.ok(catalogSchools.has(school.toLowerCase()), `${subclass} school "${school}" is in the catalog`);
    }
  }
});

test("no other Sorcerer subclass in the default test catalog is replaceable", () => {
  const others = sorcererSubclasses.map((sc) => sc.name).filter((name) => !SWAPPING_SUBCLASSES.includes(name));
  assert.ok(others.length > 0, "the catalog has other Sorcerer subclasses to check");
  for (const name of others) {
    assert.equal(isSubclassSpellReplaceable("Sorcerer", name, 1), false, `${name} is not replaceable`);
    assert.deepEqual(getSubclassAllowedSwapSchools(name), [], `${name} allows no swap school`);
  }
});
