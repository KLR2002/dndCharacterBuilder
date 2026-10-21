import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import type { BackgroundData, ClassData, FeatData, ProficiencyGrant, RaceData } from "../src/types/dnd5e.ts";
import { loadSrdCatalog, loadTestCatalog } from "./testUtils.ts";

/**
 * Proficiency Grant ids are persisted: a saved pick is keyed by the grant id. A recorded id must never
 * disappear or change, so a renamed grant would silently orphan the pick. Additions are allowed.
 *
 * The recorded list is generated, never edited by hand:
 *   UPDATE_PROFICIENCY_GRANT_IDS=1 node --test checks/proficiencyGrantIds.test.ts
 */

const RECORD_PATH = new URL("./fixtures/proficiencyGrantIds.json", import.meta.url);

interface TrackedRecords {
  classes: ClassData[];
  feats: FeatData[];
  races: RaceData[];
  backgrounds: BackgroundData[];
}

/** Every grant id a rule carries: class and subclass features, their folded options, classes, feats, races, subraces and backgrounds. */
function grantIdsOf({ classes, feats, races, backgrounds }: TrackedRecords): string[] {
  const grantsOf = (carriers: { grants?: ProficiencyGrant[] }[]) =>
    carriers.flatMap((carrier) => (carrier.grants ?? []).map((grant) => grant.id));
  const featuresOf = (features: { grants?: ProficiencyGrant[]; choices?: { options?: { grants?: ProficiencyGrant[] }[] } }[]) =>
    grantsOf(features.flatMap((feature) => [feature, ...(feature.choices?.options ?? [])]));
  return [
    ...classes.flatMap((cls) => [
      ...grantsOf([cls]),
      ...featuresOf(cls.features),
      ...cls.subclasses.flatMap((sub) => featuresOf(sub.features)),
    ]),
    ...grantsOf(feats),
    ...races.flatMap((race) => [...grantsOf([race]), ...grantsOf(race.subraces)]),
    ...grantsOf(backgrounds),
  ];
}

/** The ids in the tracked data: the SRD Baseline and the integrated test catalog (scrap data when present). */
function currentGrantIds(): string[] {
  const load = (loader: typeof loadSrdCatalog) => ({
    classes: loader<ClassData[]>("classes"),
    feats: loader<FeatData[]>("feats"),
    races: loader<RaceData[]>("races"),
    backgrounds: loader<BackgroundData[]>("backgrounds"),
  });
  return [...new Set([...grantIdsOf(load(loadSrdCatalog)), ...grantIdsOf(load(loadTestCatalog))])].sort();
}

test("the recorded grant ids are still present in the tracked class and feat data", () => {
  if (process.env.UPDATE_PROFICIENCY_GRANT_IDS === "1") {
    writeFileSync(RECORD_PATH, `${JSON.stringify({ ids: currentGrantIds() }, null, 2)}\n`);
  }
  const recorded: string[] = JSON.parse(readFileSync(RECORD_PATH, "utf8")).ids;
  assert.ok(recorded.length > 0, "the record holds ids");

  const present = new Set(currentGrantIds());
  const missing = recorded.filter((id) => !present.has(id));
  assert.deepEqual(missing, [], "a recorded grant id disappeared or changed; saved picks depend on it");
});

test("the record covers the Way of the Kensei brush grant", () => {
  const recorded: string[] = JSON.parse(readFileSync(RECORD_PATH, "utf8")).ids;
  assert.ok(recorded.includes("XGE/Monk/Way of the Kensei/Path of the Kensei@3#0"));
});
