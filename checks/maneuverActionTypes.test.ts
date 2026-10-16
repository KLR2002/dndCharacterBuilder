import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BONUS_ACTION_MANEUVERS,
  OTHER_MANEUVERS,
  REACTION_MANEUVERS,
  SAVING_THROW_MANEUVERS,
} from "../src/rules/tacticalActions.ts";
import { integratedTestCompendium } from "./testUtils.ts";

/**
 * Every Battle Master maneuver in the default test catalog must sit in exactly one curated set.
 * The three action-type sets are names only. The fourth set holds the attack riders that are none
 * of the other three. Nothing parses the maneuver text at runtime; the text is read here only to
 * classify it.
 */
const SETS: Record<string, ReadonlySet<string>> = {
  SAVING_THROW_MANEUVERS,
  REACTION_MANEUVERS,
  BONUS_ACTION_MANEUVERS,
  OTHER_MANEUVERS,
};

const normalize = (name: string) => name.toLowerCase().trim();

function catalogManeuverNames(): string[] {
  return integratedTestCompendium()
    .for()
    .optionsAndFeatures()
    .filter((o) => (o.featureType ?? []).includes("MV:B"))
    .map((o) => o.name);
}

test("every Battle Master maneuver in the default test catalog is in exactly one set", () => {
  const memberships = new Map<string, string[]>();
  for (const name of catalogManeuverNames()) {
    memberships.set(normalize(name), []);
  }
  for (const [setName, members] of Object.entries(SETS)) {
    for (const member of members) {
      memberships.get(normalize(member))?.push(setName);
    }
  }
  const unclassified = [...memberships].filter(([, sets]) => sets.length === 0).map(([name]) => name);
  const doubled = [...memberships].filter(([, sets]) => sets.length > 1).map(([name, sets]) => `${name} (${sets.join(", ")})`);
  assert.deepEqual(unclassified, [], "catalog maneuvers in no set");
  assert.deepEqual(doubled, [], "catalog maneuvers in more than one set");
});

test("every set member is a Battle Master maneuver in the default test catalog", () => {
  const catalog = new Set(catalogManeuverNames().map(normalize));
  for (const [setName, members] of Object.entries(SETS)) {
    for (const member of members) {
      assert.ok(catalog.has(normalize(member)), `${setName} member "${member}" is not a catalog maneuver`);
    }
  }
});
