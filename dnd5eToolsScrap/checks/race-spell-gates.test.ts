import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { additionalSpellsByRace, raceKey, subraceKey } from "../src/scrapers/races.ts";
import { SPELL_GRANT_GATES, type SpellGrantGate } from "../src/overrides/granted-spells.ts";

/** The part of a tracked race this check reads: its subraces' spell grants and their gates. */
interface TrackedRaceSpells {
  name: string;
  subraces: Array<{ name: string; source: string; additionalSpells?: Array<{ gatedBy?: { choiceId: string; option: string } }> }>;
}

// Every name and sentence in this file is invented. A reviewed gate says which subrace grant waits on which option of a
// Rule Choice the subrace holds (ADR 0017), so the reader reads the grant only while the option is picked.

const gate: SpellGrantGate = {
  race: "Sample Kin",
  subrace: "Sample Line",
  subraceSource: "AAA",
  trait: "Sample Option (Choose 1)",
  option: "Sample Cantrip",
};

const raw = {
  race: [{ name: "Sample Kin", source: "AAA", additionalSpells: [{ ability: "cha", known: { "1": ["sample ember"] } }] }],
  subrace: [
    {
      name: "Sample Line",
      source: "AAA",
      raceName: "Sample Kin",
      raceSource: "AAA",
      additionalSpells: [{ ability: "int", known: { _: [{ choose: "level=0|class=Sample Mage" }] } }],
    },
    {
      name: "Sample Plain",
      source: "AAA",
      raceName: "Sample Kin",
      raceSource: "AAA",
      additionalSpells: [{ ability: "int", known: { "1": ["sample glimmer"] } }],
    },
  ],
};

test("a subrace grant a reviewed gate names carries the Rule Choice id it waits on and the option that opens it", () => {
  const grants = additionalSpellsByRace(raw, [gate]);
  const line = grants.get(subraceKey("Sample Kin", "AAA", "Sample Line", "AAA"));
  assert.deepEqual(line?.[0].gatedBy, { choiceId: "AAA__Sample Kin__Sample Line__Sample Option (Choose 1)", option: "Sample Cantrip" });
});

test("a grant no gate names carries no gate, and neither does a race's grant", () => {
  const grants = additionalSpellsByRace(raw, [gate]);
  const plain = grants.get(subraceKey("Sample Kin", "AAA", "Sample Plain", "AAA"));
  assert.equal("gatedBy" in (plain?.[0] ?? {}), false, "the subrace without a gate is read as before");
  assert.equal("gatedBy" in (grants.get(raceKey("Sample Kin", "AAA"))?.[0] ?? {}), false, "the race's grant is never gated here");
});

test("every reviewed gate names a tracked subrace that gives spells, whose grants carry the gate, so a stale gate fails", () => {
  const races = JSON.parse(readFileSync(new URL("../data/races.json", import.meta.url), "utf8")) as TrackedRaceSpells[];
  for (const reviewed of SPELL_GRANT_GATES) {
    const subrace = races.find((r) => r.name === reviewed.race)?.subraces.find((s) => s.name === reviewed.subrace && s.source === reviewed.subraceSource);
    const grants = subrace?.additionalSpells ?? [];
    assert.ok(grants.length > 0, `${reviewed.subrace} gives spells in the tracked races`);
    const choiceId = [reviewed.subraceSource, reviewed.race, reviewed.subrace, reviewed.trait].join("__");
    assert.ok(
      grants.every((grant) => grant.gatedBy?.choiceId === choiceId && grant.gatedBy.option === reviewed.option),
      `${reviewed.subrace}'s grants carry the gate`,
    );
  }
});
