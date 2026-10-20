import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import type { ClassData, FeatData, ProficiencyGrant } from "../src/types/dnd5e.ts";
import { loadSrdCatalog, loadTestCatalog } from "./testUtils.ts";

/**
 * Proficiency Grant ids are persisted: a saved pick is keyed by the grant id. A recorded id must never
 * disappear or change, so a renamed grant would silently orphan the pick. Additions are allowed.
 *
 * The recorded list is generated, never edited by hand:
 *   UPDATE_PROFICIENCY_GRANT_IDS=1 node --test checks/proficiencyGrantIds.test.ts
 */

const RECORD_PATH = new URL("./fixtures/proficiencyGrantIds.json", import.meta.url);

/** Every grant id on a class feature, a subclass feature or a feat: the owners whose grants the sheet carries. */
function grantIdsOf(classes: ClassData[], feats: FeatData[]): string[] {
  const grantsOf = (features: { grants?: ProficiencyGrant[] }[]) =>
    features.flatMap((feature) => (feature.grants ?? []).map((grant) => grant.id));
  return [
    ...classes.flatMap((cls) => [
      ...grantsOf(cls.features),
      ...cls.subclasses.flatMap((sub) => grantsOf(sub.features)),
    ]),
    ...grantsOf(feats),
  ];
}

/** The ids in the tracked data: the SRD Baseline and the integrated test catalog (scrap data when present). */
function currentGrantIds(): string[] {
  const srd = grantIdsOf(loadSrdCatalog<ClassData[]>("classes"), loadSrdCatalog<FeatData[]>("feats"));
  const integrated = grantIdsOf(loadTestCatalog<ClassData[]>("classes"), loadTestCatalog<FeatData[]>("feats"));
  return [...new Set([...srd, ...integrated])].sort();
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
