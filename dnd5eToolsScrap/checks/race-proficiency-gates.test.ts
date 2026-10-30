import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gateSubraceGrants } from "../src/scrapers/races.ts";
import { PROFICIENCY_GRANT_GATES, type ProficiencyGrantGate } from "../src/overrides/proficiency-grants.ts";
import type { ProficiencyGrant } from "../src/types/proficiency.ts";

/** The part of a tracked race this check reads: its subraces' proficiency grants and their gates. */
interface TrackedRaceGrants {
  name: string;
  subraces: {
    name: string;
    source: string;
    grants?: ProficiencyGrant[];
    traits: { name: string; choice?: { options: { name: string }[] } }[];
  }[];
}

// Every name and sentence in this file is invented. A reviewed proficiency gate says which subrace grant waits on which
// option of a Rule Choice the subrace holds (ADR 0015), so the reader gives the grant only while the option is picked.

const gate: ProficiencyGrantGate = {
  race: "Sample Kin",
  subrace: "Sample Line",
  subraceSource: "AAA",
  trait: "Sample Option (Choose 1)",
  option: "Sample Blade",
  category: "weapons",
};

const grants: ProficiencyGrant[] = [
  {
    id: "AAA/Subrace/Sample Kin (Sample Line)@0#weapons:fixed:sample blade",
    aliases: ["AAA/Subrace/Sample Kin (Sample Line)@0#0"],
    kind: "fixed",
    category: "weapons",
    names: ["sample blade", "sample bow"],
  },
  {
    id: "AAA/Subrace/Sample Kin (Sample Line)@0#languages:fixed:Sample Tongue",
    aliases: ["AAA/Subrace/Sample Kin (Sample Line)@0#1"],
    kind: "fixed",
    category: "languages",
    names: ["Sample Tongue"],
  },
  {
    id: "AAA/Subrace/Sample Kin (Sample Line)@0#weapons:choice:names",
    aliases: ["AAA/Subrace/Sample Kin (Sample Line)@0#2"],
    kind: "choice",
    category: "weapons",
    count: 1,
    pool: { kind: "names", names: ["sample blade", "sample bow"] },
  },
];

test("a fixed grant of the gate's category carries the Rule Choice id and option that open it, and nothing else changes", () => {
  const gated = gateSubraceGrants(grants, "Sample Kin", "Sample Line", "AAA", [gate]);
  const blade = { ...grants[0], gatedBy: { choiceId: "AAA__Sample Kin__Sample Line__Sample Option (Choose 1)", option: "Sample Blade" } };
  assert.deepEqual(gated, [blade, grants[1], grants[2]], "only the fixed weapons grant is gated; its id and aliases are kept");
});

test("a subrace no gate names, and a fixed grant of another category, keep their grants as they are", () => {
  assert.equal(gateSubraceGrants(grants, "Sample Kin", "Sample Plain", "AAA", [gate]), grants, "the subrace without a gate is unchanged");
  const languageGate: ProficiencyGrantGate = { ...gate, category: "languages" };
  const languageOnly = gateSubraceGrants(grants, "Sample Kin", "Sample Line", "AAA", [languageGate]);
  assert.equal("gatedBy" in languageOnly[0], false, "the weapons grant is not gated by a languages gate");
  assert.equal("gatedBy" in languageOnly[1], true, "the languages grant is gated by a languages gate");
});

test("every reviewed proficiency gate names a tracked subrace whose fixed grants of its category carry the gate", () => {
  const races = JSON.parse(readFileSync(new URL("../data/races.json", import.meta.url), "utf8")) as TrackedRaceGrants[];
  for (const reviewed of PROFICIENCY_GRANT_GATES) {
    const subrace = races
      .find((race) => race.name === reviewed.race)
      ?.subraces.find((sub) => sub.name === reviewed.subrace && sub.source === reviewed.subraceSource);
    assert.ok(subrace, `${reviewed.subrace} is a tracked subrace of ${reviewed.race}`);
    const trait = subrace.traits.find((candidate) => candidate.name === reviewed.trait);
    assert.ok(trait?.choice?.options.some((option) => option.name === reviewed.option), `${reviewed.option} is an option of ${reviewed.trait}`);
    const choiceId = [reviewed.subraceSource, reviewed.race, reviewed.subrace, reviewed.trait].join("__");
    const fixed = (subrace.grants ?? []).filter((grant) => grant.kind === "fixed" && grant.category === reviewed.category);
    assert.ok(fixed.length > 0, `${reviewed.subrace} holds a fixed ${reviewed.category} grant`);
    assert.ok(
      fixed.every((grant) => grant.gatedBy?.choiceId === choiceId && grant.gatedBy.option === reviewed.option),
      `${reviewed.subrace}'s fixed ${reviewed.category} grants carry the gate`,
    );
  }
});
