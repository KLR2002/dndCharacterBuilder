import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import type { Character, InventoryItem } from "../src/types/character.ts";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { STANDARD_WEAPONS } from "../src/rules/attacks.ts";
import type { Compendium } from "../src/services/compendium.ts";
import { MODES, SCENARIOS, LEVELS, BOOK_SETS, inMode } from "./proficiencyScenarios.ts";
import { makeChar } from "./testUtils.ts";

/**
 * Regression net for the armor and weapon proficiencies a character shows, and for which equipped
 * weapons count as proficient in an attack. Every representative character (the shared scenarios
 * plus the feats that grant armor or weapons) is recorded at every level and book set, in SRD and
 * integrated modes. Lists are compared sorted: the question is what the character has.
 *
 * Every weapon in the Standard Weapons table is equipped on each recorded character, so the
 * `attacks` record shows which of them the character is proficient with.
 *
 * The baseline records the readers before the Proficiency Sheet took over armor and weapons. Nothing
 * in it is removed, and every entry the sheet adds must be on the allowlist
 * (checks/fixtures/weaponsArmorAllowlist.json) as a (scenario, entry) pair that names the Catalog grant
 * behind it.
 *
 * The baseline is never edited by hand. To re-record it deliberately (which replaces the pre-sheet
 * record, so the allowlist must then be reviewed again):
 *   UPDATE_WEAPONS_ARMOR_BASELINE=1 node --test checks/weaponsArmorCharacterization.test.ts
 */

const BASELINE_PATH = new URL("./fixtures/weaponsArmorBaseline.json", import.meta.url);
const ALLOWLIST_PATH = new URL("./fixtures/weaponsArmorAllowlist.json", import.meta.url);

/** Scenarios that only the armor and weapon characterization needs: feats that grant them. */
const FEAT_SCENARIOS: { label: string; build: (level: number) => Character }[] = [
  {
    label: "human fighter with the heavily armored feat from level 4",
    build: (l) =>
      makeChar({
        classes: [{ className: "Fighter", source: "PHB", level: l, subclassName: "Champion", subclassSource: "PHB" }],
        race: { name: "Human", source: "PHB" },
        background: { name: "Acolyte", source: "PHB" },
        asiSelections: l >= 4 ? [{ level: 4, type: "feat", featName: "Heavily Armored", featSource: "PHB" }] : [],
      }),
  },
  {
    label: "human fighter with the tavern brawler feat from level 4",
    build: (l) =>
      makeChar({
        classes: [{ className: "Fighter", source: "PHB", level: l, subclassName: "Champion", subclassSource: "PHB" }],
        race: { name: "Human", source: "PHB" },
        background: { name: "Acolyte", source: "PHB" },
        asiSelections: l >= 4 ? [{ level: 4, type: "feat", featName: "Tavern Brawler", featSource: "PHB" }] : [],
      }),
  },
];

const ALL_SCENARIOS = [...SCENARIOS, ...FEAT_SCENARIOS];

/** One equipped item per Standard Weapons entry, so the attacks record covers every weapon the app knows. */
const PROBE_ITEMS: InventoryItem[] = Object.keys(STANDARD_WEAPONS)
  .filter((name) => name !== "unarmed strike")
  .map((name) => ({
    id: `probe_${name.replace(/\W+/g, "_")}`,
    name,
    source: "PHB",
    quantity: 1,
    isEquipped: true,
    section: "equipped",
  }));

interface Recorded {
  armor: string[];
  weapons: string[];
  /** The names of the probe weapons the character is proficient with. */
  attacks: string[];
}

function captureAll(): Record<string, Recorded> {
  const out: Record<string, Recorded> = {};
  for (const [mode, compendium] of MODES) {
    const comp: Compendium = compendium();
    for (const { label, build } of ALL_SCENARIOS) {
      for (const level of LEVELS) {
        for (const books of BOOK_SETS) {
          const base = inMode(build(level), mode);
          const character: Character = { ...base, items: [...base.items, ...PROBE_ITEMS] };
          const key = `${mode} | ${label} | L${level} | books=${books ? books.join("+") : "all"}`;
          const evaluated = evaluateCharacter(character, { compendium: comp, activeBooks: books });
          out[key] = {
            armor: [...evaluated.proficiencies.armor].sort(),
            weapons: [...evaluated.proficiencies.weapons].sort(),
            attacks: evaluated.weaponAttacks
              .filter((attack) => attack.isProficient)
              .map((attack) => attack.name)
              .sort(),
          };
        }
      }
    }
  }
  return out;
}

/**
 * The allowlist: each (scenario, entry) pair the sheet adds to the recorded baseline, with the Catalog
 * grant that adds it. An entry is `armor: <name>`, `weapons: <name>` or `attacks: <weapon>`.
 */
interface AllowedEntry {
  scenario: string;
  entry: string;
  grant: string;
}
const ALLOWLIST = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as AllowedEntry[];

const CATEGORIES = ["armor", "weapons", "attacks"] as const;
const scenarioOf = (key: string) => key.split(" | ").slice(0, 2).join(" | ");
const pairKey = (scenario: string, entry: string) => JSON.stringify([scenario, entry]);

function loadBaseline(): Record<string, Recorded> {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, Recorded>;
}

/** Entries the baseline records that the current readers no longer show. */
function removedEntries(expected: Record<string, Recorded>, actual: Record<string, Recorded>): string[] {
  const out: string[] = [];
  for (const key of Object.keys(expected)) {
    for (const category of CATEGORIES) {
      const have = new Set(actual[key][category]);
      for (const name of expected[key][category]) {
        if (!have.has(name)) out.push(`${key}: ${category}: ${name}`);
      }
    }
  }
  return out;
}

/** The (scenario, entry) pairs the current readers show that the baseline does not. */
function addedPairs(expected: Record<string, Recorded>, actual: Record<string, Recorded>): string[] {
  const pairs = new Set<string>();
  for (const key of Object.keys(expected)) {
    for (const category of CATEGORIES) {
      const had = new Set(expected[key][category]);
      for (const name of actual[key][category]) {
        if (!had.has(name)) pairs.add(pairKey(scenarioOf(key), `${category}: ${name}`));
      }
    }
  }
  return [...pairs];
}

/** Every grant id the Compendium carries on a class feature, subclass feature or feat. */
function grantIdsOf(compendium: Compendium): Set<string> {
  const listings = compendium.for();
  const carriers: { grants?: { id: string }[] }[] = [
    ...listings.classes().flatMap((c) => [...c.features, ...c.subclasses.flatMap((s) => s.features)]),
    ...listings.feats(),
  ];
  return new Set(carriers.flatMap((carrier) => (carrier.grants ?? []).map((grant) => grant.id)));
}

test("every armor, weapon and weapon attack in the baseline is still shown", () => {
  const actual = captureAll();
  if (process.env.UPDATE_WEAPONS_ARMOR_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(actual, null, 1)}\n`);
  }
  const expected = loadBaseline();
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), "the same rows are recorded");
  assert.deepEqual(removedEntries(expected, actual), []);
});

test("every new armor, weapon or attack proficiency is allowlisted, and every allowlisted entry is shown", () => {
  const added = new Set(addedPairs(loadBaseline(), captureAll()));
  const allowed = new Set(ALLOWLIST.map((p) => pairKey(p.scenario, p.entry)));
  assert.deepEqual(
    [...added].filter((pair) => !allowed.has(pair)).map((pair) => JSON.parse(pair)),
    [],
    "new entries that are not on the allowlist",
  );
  assert.deepEqual(
    [...allowed].filter((pair) => !added.has(pair)).map((pair) => JSON.parse(pair)),
    [],
    "allowlisted entries the sheet no longer adds",
  );
});

test("every allowlisted grant id exists in the Compendium of its scenario's mode", () => {
  const idsByMode = new Map(MODES.map(([mode, compendium]) => [mode, grantIdsOf(compendium())]));
  for (const { scenario, grant } of ALLOWLIST) {
    const mode = scenario.split(" | ")[0];
    assert.ok(idsByMode.get(mode)?.has(grant), `${scenario}: grant "${grant}" is not in the ${mode} Compendium`);
  }
});

test("the baseline records every scenario in both modes", () => {
  const keys = Object.keys(loadBaseline());
  for (const mode of ["srd", "integrated"]) {
    for (const { label } of ALL_SCENARIOS) {
      assert.ok(
        keys.some((key) => key.startsWith(`${mode} | ${label} | `)),
        `baseline has no ${mode} rows for "${label}"`,
      );
    }
  }
});
