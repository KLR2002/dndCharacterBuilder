import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { additionalSpellsByRace, raceKey, subraceKey } from "../src/scrapers/races.ts";
import { SPELL_GRANT_CORRECTIONS, type SpellGrantCorrection } from "../src/overrides/granted-spells.ts";
import type { AdditionalSpells } from "../src/types/models.ts";

/** The part of a tracked race this check reads: its own spell grant and its subraces' grants. */
interface TrackedRaceGrants {
  name: string;
  source: string;
  additionalSpells?: AdditionalSpells[];
  subraces: Array<{ name: string; source: string; additionalSpells?: AdditionalSpells[] }>;
}

// Every name and sentence in this file is invented. A reviewed correction replaces the sections of a race's or subrace's
// spell grant that its trait text gives differently (ADR 0017); a section it leaves out stays as the source gives it.

const raw = {
  race: [
    {
      name: "Sample Kin",
      source: "AAA",
      additionalSpells: [{ ability: "int", known: { "1": ["sample ember", "sample spark"] } }],
    },
  ],
  subrace: [
    {
      name: "Sample Line",
      source: "AAA",
      raceName: "Sample Kin",
      raceSource: "AAA",
      additionalSpells: [{ ability: "cha", known: { "1": ["sample pulse"] }, expanded: { s1: ["sample haze"] } }],
    },
  ],
};

const lineCorrection: SpellGrantCorrection = {
  race: "Sample Kin",
  raceSource: "AAA",
  subrace: "Sample Line",
  subraceSource: "AAA",
  reason: "invented: the trait gives a second spell at level 3 and one at will",
  known: { "1": ["sample pulse"], "3": ["sample glow"] },
  innate: { "1": ["sample light"] },
};

test("a reviewed correction replaces the sections it gives of the subrace grant it names, and keeps the ability and the expanded list", () => {
  const grants = additionalSpellsByRace(raw, [], [lineCorrection]);
  const line = grants.get(subraceKey("Sample Kin", "AAA", "Sample Line", "AAA"));
  assert.deepEqual(line, [
    {
      ability: "cha",
      known: { "1": ["sample pulse"], "3": ["sample glow"] },
      expanded: { s1: ["sample haze"] },
      innate: { "1": ["sample light"] },
    },
  ]);
});

test("a correction names one record: the race's own grant, and a subrace it does not name, keep their source's sections", () => {
  const grants = additionalSpellsByRace(raw, [], [lineCorrection]);
  assert.deepEqual(grants.get(raceKey("Sample Kin", "AAA")), [{ ability: "int", known: { "1": ["sample ember", "sample spark"] } }]);
});

test("a reviewed correction's notes are carried on the race's spell grant, and a subrace it does not name keeps none", () => {
  const noteCorrection: SpellGrantCorrection = {
    race: "Sample Kin",
    raceSource: "AAA",
    reason: "invented: the trait limits the second spell to its caster",
    notes: { "sample spark": "self only" },
  };
  const grants = additionalSpellsByRace(raw, [], [noteCorrection]);
  assert.deepEqual(grants.get(raceKey("Sample Kin", "AAA")), [
    { ability: "int", known: { "1": ["sample ember", "sample spark"] }, notes: { "sample spark": "self only" } },
  ]);
  const [line] = grants.get(subraceKey("Sample Kin", "AAA", "Sample Line", "AAA")) ?? [];
  assert.equal("notes" in (line ?? {}), false, "the subrace's grant keeps no note");
});

test("every reviewed correction names a tracked record whose spell grant carries the sections it gives, so a stale correction fails", () => {
  const races = JSON.parse(readFileSync(new URL("../data/races.json", import.meta.url), "utf8")) as TrackedRaceGrants[];
  for (const correction of SPELL_GRANT_CORRECTIONS) {
    const race = races.find((candidate) => candidate.name === correction.race && candidate.source === correction.raceSource);
    const holder = correction.subrace
      ? race?.subraces.find((sub) => sub.name === correction.subrace && sub.source === correction.subraceSource)
      : race;
    const [grant] = holder?.additionalSpells ?? [];
    assert.ok(grant, `${correction.race} (${correction.subrace ?? "race"}) gives spells in the tracked races`);
    if (correction.known) assert.deepEqual(grant.known, correction.known, `${correction.race}'s known spells follow the correction`);
    if (correction.innate) assert.deepEqual(grant.innate, correction.innate, `${correction.race}'s innate spells follow the correction`);
    if (correction.notes) assert.deepEqual(grant.notes, correction.notes, `${correction.race}'s spell notes follow the correction`);
  }
});
