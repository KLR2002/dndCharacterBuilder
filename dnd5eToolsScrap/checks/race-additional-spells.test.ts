import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeRaces } from "../src/scrapers/races.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Invented races and subraces in the raw 5e.tools shape. The scraper keeps a race's and a subrace's structured spell grants
// (ADR 0017) as the source gives them, with each spell name normalised the way the subclass and feat grants are, and leaves a
// record without any alone. A subrace that copies another keeps the copied grants.

const raw = {
  race: [
    {
      name: "Sample Kin",
      source: "AAA",
      entries: ["Placeholder text."],
      additionalSpells: [
        {
          ability: "cha",
          known: { "1": ["sample ember#c"] },
          innate: { "3": { daily: { "1": ["sample pulse|aaa"] } } },
        },
      ],
    },
    { name: "Sample Plain", source: "AAA", entries: ["Placeholder text."] },
    {
      name: "Sample Caster",
      source: "AAA",
      entries: ["Placeholder text."],
      additionalSpells: [
        {
          ability: "cha",
          known: { "1": ["sample ember#c"] },
          innate: { "3": { daily: { "1": ["sample pulse#2"] } } },
        },
      ],
    },
  ],
  subrace: [
    {
      name: "Sample Line",
      source: "AAA",
      raceName: "Sample Kin",
      raceSource: "AAA",
      entries: ["Placeholder text."],
      additionalSpells: [{ ability: "int", known: { "1": { rest: { "1": ["sample glimmer"] } } } }],
    },
    {
      name: "Sample Copy",
      source: "AAA",
      raceName: "Sample Kin",
      raceSource: "AAA",
      _copy: { name: "Sample Line", source: "AAA", raceName: "Sample Kin", raceSource: "AAA" },
    },
  ],
};

const client = { fetchJson: async () => raw } as unknown as ToolsClient;

test("a race's spell grants are copied onto the race, with the ability and the names normalised", async () => {
  const races = await scrapeRaces(client, newProficiencyReport());
  const kin = races.find((race) => race.name === "Sample Kin");
  assert.deepEqual(kin?.additionalSpells, [
    {
      ability: "cha",
      known: { "1": ["sample ember"] },
      innate: { "3": { daily: { "1": ["sample pulse"] } } },
    },
  ]);
});

test("a subrace's spell grants are copied onto the subrace, and a subrace that copies another keeps the copied grants", async () => {
  const races = await scrapeRaces(client, newProficiencyReport());
  const subraces = races.find((race) => race.name === "Sample Kin")?.subraces ?? [];
  const line = subraces.find((subrace) => subrace.name === "Sample Line");
  const copy = subraces.find((subrace) => subrace.name === "Sample Copy");
  const expected = [{ ability: "int", known: { "1": { rest: { "1": ["sample glimmer"] } } } }];
  assert.deepEqual(line?.additionalSpells, expected);
  assert.deepEqual(copy?.additionalSpells, expected);
});

test("a spell the source casts at a level keeps that cast level beside the grant; a spell with no suffix has none", async () => {
  const races = await scrapeRaces(client, newProficiencyReport());
  const caster = races.find((race) => race.name === "Sample Caster");
  assert.deepEqual(caster?.additionalSpells, [
    {
      ability: "cha",
      known: { "1": ["sample ember"] },
      innate: { "3": { daily: { "1": ["sample pulse"] } } },
      castLevels: { "sample pulse": 2 },
    },
  ]);
  const kin = races.find((race) => race.name === "Sample Kin");
  assert.equal("castLevels" in (kin?.additionalSpells?.[0] ?? {}), false, "no suffix, no cast level");
});

test("a race with no spell grants has no additionalSpells field", async () => {
  const races = await scrapeRaces(client, newProficiencyReport());
  const plain = races.find((race) => race.name === "Sample Plain");
  assert.equal("additionalSpells" in (plain ?? {}), false);
});
