import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import type { BackgroundData, ClassData, FeatData, ProficiencyGrant, RaceData } from "../src/types/dnd5e.ts";
import { loadSrdCatalog, loadTestCatalog } from "./testUtils.ts";

/**
 * Proficiency Grant ids are persisted: a saved pick is keyed by the grant id. A grant's id is derived from
 * what the grant is, and the position-based id it had before is kept as its alias. This guard pins two things
 * for the tracked data (the SRD Baseline and the integrated catalog):
 *   - `ids`: every id ever shipped in the position-based form. Each must still resolve, as a grant's id or as one
 *     of its aliases. Dropping one orphans the picks saved under it.
 *   - `resolved`: where each shipped id resolves to. A grant that moves to another id fails the guard, so a
 *     change to what a grant is needs a deliberate, recorded update.
 * Additions are allowed. The record is generated, never edited by hand:
 *   UPDATE_PROFICIENCY_GRANT_IDS=1 node --test checks/proficiencyGrantIds.test.ts
 */

const RECORD_PATH = new URL("./fixtures/proficiencyGrantIds.json", import.meta.url);

interface PinRecord {
  ids: string[];
  resolved: Record<string, string>;
}

interface TrackedGrant {
  id: string;
  aliases: string[];
}

interface TrackedRecords {
  classes: ClassData[];
  feats: FeatData[];
  races: RaceData[];
  backgrounds: BackgroundData[];
}

/** Every grant a rule carries: class and subclass features, their folded options, classes, feats, races, subraces and backgrounds. */
function grantsOf({ classes, feats, races, backgrounds }: TrackedRecords): TrackedGrant[] {
  const granted = (carriers: { grants?: ProficiencyGrant[] }[]): TrackedGrant[] =>
    carriers.flatMap((carrier) => (carrier.grants ?? []).map((grant) => ({ id: grant.id, aliases: grant.aliases ?? [] })));
  const featuresOf = (features: { grants?: ProficiencyGrant[]; choices?: { options?: { grants?: ProficiencyGrant[] }[] } }[]) =>
    granted(features.flatMap((feature) => [feature, ...(feature.choices?.options ?? [])]));
  return [
    ...classes.flatMap((cls) => [
      ...granted([cls]),
      ...featuresOf(cls.features),
      ...cls.subclasses.flatMap((sub) => featuresOf(sub.features)),
    ]),
    ...granted(feats),
    ...races.flatMap((race) => [...granted([race]), ...granted(race.subraces)]),
    ...granted(backgrounds),
  ];
}

/** The grants in the tracked data: the SRD Baseline and the integrated test catalog (scrap data when present). */
function trackedGrants(): TrackedGrant[] {
  const load = (loader: typeof loadSrdCatalog) => ({
    classes: loader<ClassData[]>("classes"),
    feats: loader<FeatData[]>("feats"),
    races: loader<RaceData[]>("races"),
    backgrounds: loader<BackgroundData[]>("backgrounds"),
  });
  const all = [...grantsOf(load(loadSrdCatalog)), ...grantsOf(load(loadTestCatalog))];
  const byId = new Map(all.map((grant) => [grant.id, grant]));
  return [...byId.values()];
}

function readRecord(): PinRecord {
  return JSON.parse(readFileSync(RECORD_PATH, "utf8")) as PinRecord;
}

/** Every alias of the tracked grants, mapped to the id of the grant that carries it. */
function resolutionsOf(grants: TrackedGrant[]): Map<string, string> {
  return new Map(grants.flatMap((grant) => grant.aliases.map((alias) => [alias, grant.id] as const)));
}

test("every recorded grant id still resolves, as a grant's id or as one of its aliases", () => {
  if (process.env.UPDATE_PROFICIENCY_GRANT_IDS === "1") {
    const grants = trackedGrants();
    const ids = [...new Set([...readRecord().ids, ...grants.flatMap((grant) => grant.aliases)])].sort();
    const resolved = Object.fromEntries([...resolutionsOf(grants)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    writeFileSync(RECORD_PATH, `${JSON.stringify({ ids, resolved }, null, 2)}\n`);
  }
  const { ids } = readRecord();
  assert.ok(ids.length > 0, "the record holds ids");

  const grants = trackedGrants();
  const resolvable = new Set(grants.flatMap((grant) => [grant.id, ...grant.aliases]));
  const missing = ids.filter((id) => !resolvable.has(id));
  assert.deepEqual(missing, [], "a recorded grant id disappeared; saved picks depend on it");
});

test("every recorded grant id still resolves to the grant it was recorded against", () => {
  const { resolved } = readRecord();
  const now = resolutionsOf(trackedGrants());
  const moved = Object.entries(resolved)
    .filter(([formerId, id]) => now.get(formerId) !== id)
    .map(([formerId, id]) => ({ formerId, recorded: id, now: now.get(formerId) ?? null }));
  assert.deepEqual(moved, [], "a recorded grant id now resolves to another grant; saved picks would move");
});

test("every tracked grant carries exactly its former position-based id as an alias, and its own id is not positional", () => {
  const positional = /#\d+$/;
  for (const grant of trackedGrants()) {
    assert.equal(grant.aliases.length, 1, `${grant.id} carries one former id`);
    assert.match(grant.aliases[0], positional, `${grant.id} keeps its position as its former id`);
    assert.doesNotMatch(grant.id, positional, `${grant.id} is derived from what the grant is`);
  }
});

test("the record pins the Way of the Kensei brush grant's former id to its current id", () => {
  const { resolved } = readRecord();
  assert.equal(
    resolved["XGE/Monk/Way of the Kensei/Path of the Kensei@3#0"],
    "XGE/Monk/Way of the Kensei/Path of the Kensei@3#tools:choice:from=calligrapher's supplies,painter's supplies",
  );
});
