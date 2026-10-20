import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import type { Compendium } from "../src/services/compendium.ts";
import {
  BOOK_SETS,
  LEVELS,
  MODES,
  SCENARIOS,
  background,
  cls,
  inMode,
  race,
  withClasses,
  type Build,
} from "./proficiencyScenarios.ts";

/**
 * Regression net for the saving throws a character shows (the saves card and every reader of save
 * bonuses). Every scenario of the proficiency characterization, plus the saves-specific ones below, is
 * recorded in SRD and integrated modes, at every level and book set. A recorded save is proficient or
 * not, and its bonus. A change to a save fails here unless the change is a newly applied grant.
 *
 * The baseline records the saves before the Proficiency Sheet. Nothing in it is removed, and every
 * saving throw the sheet adds must be on the allowlist (checks/fixtures/savingThrowsAllowlist.json) as a
 * (scenario, entry) pair that names the Catalog grant behind it. A bonus may change only for a save that
 * is newly granted.
 *
 * The baseline is never edited by hand. To re-record it deliberately (which replaces the pre-sheet
 * record, so the allowlist must then be reviewed again):
 *   UPDATE_SAVES_BASELINE=1 node --test checks/savingThrowsCharacterization.test.ts
 */

const BASELINE_PATH = new URL("./fixtures/savingThrowsBaseline.json", import.meta.url);
const ALLOWLIST_PATH = new URL("./fixtures/savingThrowsAllowlist.json", import.meta.url);

/** Saves that exist only for the saves test: each names a save-granting feature the proficiency scenarios lack. */
const SAVES_ONLY: { label: string; build: Build }[] = [
  {
    label: "human samurai soldier with elegant courtier",
    build: (l) =>
      withClasses([cls("Fighter", l, "Samurai", "XGE")], { race: race("Human"), background: background("Soldier") }),
  },
  {
    label: "human gloom stalker outlander with iron mind",
    build: (l) =>
      withClasses([cls("Ranger", l, "Gloom Stalker", "XGE")], { race: race("Human"), background: background("Outlander") }),
  },
  {
    label: "multiclass fighter champion and wizard evoker",
    build: (l) =>
      withClasses([cls("Fighter", l, "Champion"), cls("Wizard", 2, "School of Evocation")], {
        race: race("Human"),
        background: background("Soldier"),
      }),
  },
  {
    label: "multiclass wizard evoker and monk",
    build: (l) =>
      withClasses([cls("Wizard", 2, "School of Evocation"), cls("Monk", Math.max(1, l - 2), "Way of the Open Hand")], {
        race: race("Human"),
        background: background("Sage"),
      }),
  },
];

const ALL_SCENARIOS = [...SCENARIOS, ...SAVES_ONLY];

const ABILITY_NAMES: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

interface Recorded {
  /** The abilities whose saving throw the character is proficient in, sorted by name. */
  proficient: string[];
  /** The saving throw bonus for each ability, by name. */
  bonus: Record<string, number>;
}

interface AllowedEntry {
  scenario: string;
  entry: string;
  grant: string;
}

const ALLOWLIST = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as AllowedEntry[];

const scenarioOf = (key: string) => key.split(" | ").slice(0, 2).join(" | ");
const pairKey = (scenario: string, entry: string) => JSON.stringify([scenario, entry]);
const entryOf = (name: string) => `saving throw: ${name}`;

function captureAll(): Record<string, Recorded> {
  const out: Record<string, Recorded> = {};
  for (const [mode, compendium] of MODES) {
    const comp = compendium();
    for (const { label, build } of ALL_SCENARIOS) {
      for (const level of LEVELS) {
        for (const books of BOOK_SETS) {
          const character = inMode(build(level), mode);
          const key = `${mode} | ${label} | L${level} | books=${books ? books.join("+") : "all"}`;
          const evaluated = evaluateCharacter(character, { compendium: comp, activeBooks: books });
          const proficient: string[] = [];
          const bonus: Record<string, number> = {};
          for (const [ability, save] of Object.entries(evaluated.saves)) {
            const name = ABILITY_NAMES[ability];
            bonus[name] = save.bonus;
            if (save.proficient) proficient.push(name);
          }
          out[key] = { proficient: proficient.sort(), bonus };
        }
      }
    }
  }
  return out;
}

function loadBaseline(): Record<string, Recorded> {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, Recorded>;
}

/** Saving throws the baseline records that the current readers no longer show. */
function removedEntries(expected: Record<string, Recorded>, actual: Record<string, Recorded>): string[] {
  const out: string[] = [];
  for (const key of Object.keys(expected)) {
    const have = new Set(actual[key].proficient);
    for (const name of expected[key].proficient) {
      if (!have.has(name)) out.push(`${key}: ${entryOf(name)}`);
    }
  }
  return out;
}

/** Bonuses that changed on a save whose proficiency did not change. Only a newly granted save may change its bonus. */
function unexplainedBonusChanges(expected: Record<string, Recorded>, actual: Record<string, Recorded>): string[] {
  const out: string[] = [];
  for (const key of Object.keys(expected)) {
    const wasProficient = new Set(expected[key].proficient);
    const isProficient = new Set(actual[key].proficient);
    for (const name of Object.keys(expected[key].bonus)) {
      if (wasProficient.has(name) !== isProficient.has(name)) continue;
      if (expected[key].bonus[name] !== actual[key].bonus[name]) {
        out.push(`${key}: ${name} bonus ${expected[key].bonus[name]} -> ${actual[key].bonus[name]}`);
      }
    }
  }
  return out;
}

/** The (scenario, entry) pairs the current readers show that the baseline does not. */
function addedPairs(expected: Record<string, Recorded>, actual: Record<string, Recorded>): string[] {
  const pairs = new Set<string>();
  for (const key of Object.keys(expected)) {
    const had = new Set(expected[key].proficient);
    for (const name of actual[key].proficient) {
      if (!had.has(name)) pairs.add(pairKey(scenarioOf(key), entryOf(name)));
    }
  }
  return [...pairs];
}

test("every saving throw in the baseline is still held, and unchanged saves keep their bonus", () => {
  const actual = captureAll();
  if (process.env.UPDATE_SAVES_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(actual, null, 1)}\n`);
  }
  const expected = loadBaseline();
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), "the same rows are recorded");
  assert.deepEqual(removedEntries(expected, actual), []);
  assert.deepEqual(unexplainedBonusChanges(expected, actual), []);
});

test("every new saving throw is allowlisted, and every allowlisted entry is shown", () => {
  const added = new Set(addedPairs(loadBaseline(), captureAll()));
  const allowed = new Set(ALLOWLIST.map((p) => pairKey(p.scenario, p.entry)));
  assert.deepEqual(
    [...added].filter((pair) => !allowed.has(pair)).map((pair) => JSON.parse(pair)),
    [],
    "new saving throws that are not on the allowlist",
  );
  assert.deepEqual(
    [...allowed].filter((pair) => !added.has(pair)).map((pair) => JSON.parse(pair)),
    [],
    "allowlisted saving throws the sheet no longer adds",
  );
});

test("every allowlisted grant id exists in the Compendium of its scenario's mode", () => {
  const idsByMode = new Map(
    MODES.map(([mode, compendium]) => [mode, grantIdsOf(compendium())]),
  );
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

/** Every grant id the Compendium carries on a class feature, subclass feature or feat. */
function grantIdsOf(compendium: Compendium): Set<string> {
  const listings = compendium.for();
  const carriers: { grants?: { id: string }[] }[] = [
    ...listings.classes().flatMap((c) => [...c.features, ...c.subclasses.flatMap((s) => s.features)]),
    ...listings.feats(),
  ];
  return new Set(carriers.flatMap((carrier) => (carrier.grants ?? []).map((grant) => grant.id)));
}
