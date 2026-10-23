import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import type { Compendium } from "../src/services/compendium.ts";
import { MODES, SCENARIOS, LEVELS, BOOK_SETS, inMode } from "./proficiencyScenarios.ts";

/**
 * Regression net for the tools and languages a character shows. Every representative character,
 * level and active book set is recorded in SRD and integrated modes, so a change to what the
 * card lists fails here. Lists are compared sorted, because the question is what the character
 * has, not the order the readers happen to produce it in.
 *
 * The baseline records the lists before the Proficiency Sheet. Nothing in it is removed, and every
 * entry the sheet adds must be on the allowlist (checks/fixtures/proficiencySheetAllowlist.json) as a
 * (scenario, entry) pair that names the Catalog grant behind it.
 *
 * The baseline is never edited by hand. To re-record it deliberately (which replaces the pre-sheet
 * record, so the allowlist must then be reviewed again):
 *   UPDATE_PROFICIENCY_SHEET_BASELINE=1 node --test checks/proficiencySheetCharacterization.test.ts
 */

const BASELINE_PATH = new URL("./fixtures/proficiencySheetBaseline.json", import.meta.url);

interface Recorded {
  tools: string[];
  expertise: string[];
  languages: string[];
}

function captureAll(): Record<string, Recorded> {
  const out: Record<string, Recorded> = {};
  for (const [mode, compendium] of MODES) {
    const comp = compendium();
    for (const { label, build } of SCENARIOS) {
      for (const level of LEVELS) {
        for (const books of BOOK_SETS) {
          const character = inMode(build(level), mode);
          const key = `${mode} | ${label} | L${level} | books=${books ? books.join("+") : "all"}`;
          const evaluated = evaluateCharacter(character, { compendium: comp, activeBooks: books });
          out[key] = {
            tools: [...evaluated.proficiencies.tools].sort(),
            expertise: evaluated.tools.filter((t) => t.isExpertise).map((t) => t.name).sort(),
            languages: [...evaluated.proficiencies.languages].sort(),
          };
        }
      }
    }
  }
  return out;
}

/**
 * The Proficiency Sheet's allowlist: each (scenario, entry) pair the sheet adds to the recorded
 * baseline, with the Catalog grant that adds it. A scenario is a mode and a label; the pair covers
 * every level and book set of that scenario.
 */
const ALLOWLIST_PATH = new URL("./fixtures/proficiencySheetAllowlist.json", import.meta.url);
interface AllowedEntry {
  scenario: string;
  entry: string;
  grant: string;
}
const ALLOWLIST = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as AllowedEntry[];

const CATEGORIES = ["tools", "expertise", "languages"] as const;
const scenarioOf = (key: string) => key.split(" | ").slice(0, 2).join(" | ");
const pairKey = (scenario: string, entry: string) => JSON.stringify([scenario, entry]);

/** The sweep is the slow part of these tests, so it is computed once: both tests read the same record. */
let recorded: Record<string, Recorded> | undefined;
const sweep = (): Record<string, Recorded> => (recorded ??= captureAll());

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
  const carriers: { grants?: { id: string; aliases?: string[] }[] }[] = [
    ...listings.classes().flatMap((c) => [...c.features, ...c.subclasses.flatMap((s) => s.features)]),
    ...listings.feats(),
  ];
  return new Set(carriers.flatMap((carrier) => (carrier.grants ?? []).flatMap((grant) => [grant.id, ...(grant.aliases ?? [])])));
}

test("every tool, Expertise tool and language in the baseline is still shown", () => {
  const actual = sweep();
  if (process.env.UPDATE_PROFICIENCY_SHEET_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(actual, null, 1)}\n`);
  }
  const expected = loadBaseline();
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), "the same rows are recorded");
  assert.deepEqual(removedEntries(expected, actual), []);
});

test("every new tool, Expertise tool or language is allowlisted, and every allowlisted entry is shown", () => {
  const added = new Set(addedPairs(loadBaseline(), sweep()));
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
  const keys = Object.keys(JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, Recorded>);
  for (const mode of ["srd", "integrated"]) {
    for (const { label } of SCENARIOS) {
      assert.ok(
        keys.some((key) => key.startsWith(`${mode} | ${label} | `)),
        `baseline has no ${mode} rows for "${label}"`,
      );
    }
  }
});
