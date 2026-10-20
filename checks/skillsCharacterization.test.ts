import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { evaluateCharacter } from "../src/rules/characterEvaluation.ts";
import { getAvailableExpertiseMilestones } from "../src/rules/expertise.ts";
import { DND_SKILLS } from "../src/constants/rules.ts";
import type { Compendium } from "../src/services/compendium.ts";
import { MODES, SCENARIOS, SKILLS_ONLY, LEVELS, BOOK_SETS, inMode, type Build } from "./proficiencyScenarios.ts";

/**
 * Regression net for the skills a character shows (the skills card, Expertise, and every reader of
 * skill bonuses). Every representative character, level and active book set is recorded in SRD and
 * integrated modes, so a change to what the character is proficient in, or which skills Expertise can
 * be placed on, fails here unless the change is a newly applied grant.
 *
 * Three things are recorded per skill row: proficient, the Expertise applied, and the skills an
 * Expertise milestone offers (Expertise-eligible). Bonuses are not recorded: they follow from the
 * proficiency and from Jack of All Trades, which a new proficiency legitimately switches off.
 *
 * The baseline records the skills before the Proficiency Sheet reads them. Nothing in it is removed,
 * and every skill the sheet adds must be on the allowlist (checks/fixtures/skillsAllowlist.json) as a
 * (scenario, entry) pair that names the Catalog grant behind it.
 *
 * The baseline is never edited by hand. To re-record it deliberately (which replaces the pre-sheet
 * record, so the allowlist must then be reviewed again):
 *   UPDATE_SKILLS_BASELINE=1 node --test checks/skillsCharacterization.test.ts
 */

const BASELINE_PATH = new URL("./fixtures/skillsBaseline.json", import.meta.url);
const ALLOWLIST_PATH = new URL("./fixtures/skillsAllowlist.json", import.meta.url);

/** The scenarios this test records: every shared scenario, plus the skills-only ones. */
const ALL_SCENARIOS: { label: string; build: Build }[] = [...SCENARIOS, ...SKILLS_ONLY];

interface Recorded {
  /** Skills the character is proficient in, sorted. */
  proficient: string[];
  /** Skills Expertise is placed on, sorted. */
  expertise: string[];
  /** Skills an Expertise milestone offers, sorted. */
  eligible: string[];
}

interface AllowedEntry {
  scenario: string;
  entry: string;
  grant: string;
}

const ALLOWLIST = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as AllowedEntry[];

const CATEGORIES = ["proficient", "expertise", "eligible"] as const;
const LABELS: Record<(typeof CATEGORIES)[number], string> = {
  proficient: "skill",
  expertise: "expertise",
  eligible: "expertise eligible",
};

const scenarioOf = (key: string) => key.split(" | ").slice(0, 2).join(" | ");
const pairKey = (scenario: string, entry: string) => JSON.stringify([scenario, entry]);
const SKILL_NAMES = new Set(DND_SKILLS.map((skill) => skill.name));

function captureAll(): Record<string, Recorded> {
  const out: Record<string, Recorded> = {};
  for (const [mode, compendium] of MODES) {
    const comp = compendium();
    for (const { label, build } of ALL_SCENARIOS) {
      for (const level of LEVELS) {
        for (const books of BOOK_SETS) {
          const character = inMode(build(level), mode);
          const key = `${mode} | ${label} | L${level} | books=${books ? books.join("+") : "all"}`;
          out[key] = recordSkills(character, comp, books);
        }
      }
    }
  }
  return out;
}

function recordSkills(character: Parameters<typeof evaluateCharacter>[0], comp: Compendium, books: string[] | undefined): Recorded {
  const evaluated = evaluateCharacter(character, { compendium: comp, activeBooks: books });
  const milestones = getAvailableExpertiseMilestones(character, { compendium: comp, activeBooks: books });
  const eligible = new Set(
    milestones.flatMap((milestone) => milestone.options).filter((name) => SKILL_NAMES.has(name)),
  );
  return {
    proficient: evaluated.skills.filter((s) => s.isProficient).map((s) => s.name).sort(),
    expertise: evaluated.skills.filter((s) => s.isExpertise).map((s) => s.name).sort(),
    eligible: [...eligible].sort(),
  };
}

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
        if (!have.has(name)) out.push(`${key}: ${LABELS[category]}: ${name}`);
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
        if (!had.has(name)) pairs.add(pairKey(scenarioOf(key), `${LABELS[category]}: ${name}`));
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

test("every skill and Expertise entry in the baseline is still shown", () => {
  const actual = captureAll();
  if (process.env.UPDATE_SKILLS_BASELINE) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(actual, null, 1)}\n`);
  }
  const expected = loadBaseline();
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), "the same rows are recorded");
  assert.deepEqual(removedEntries(expected, actual), []);
});

test("every new skill or Expertise entry is allowlisted, and every allowlisted entry is shown", () => {
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
