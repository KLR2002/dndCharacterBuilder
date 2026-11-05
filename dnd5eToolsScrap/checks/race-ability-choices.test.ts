import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeRaces } from "../src/scrapers/races.ts";
import type { ToolsClient } from "../src/types/models.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";

// Every name and sentence in this file is invented.

function fakeClient(payloads: Record<string, unknown>): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in payloads)) throw new Error(`no fixture for ${endpoint}`);
      return payloads[endpoint];
    },
  } as unknown as ToolsClient;
}

test("a race's fixed scores stay fixed and its choose block becomes one ability score choice with defaults", async () => {
  const race = {
    name: "Sample Folk",
    source: "TST",
    entries: [],
    ability: [{ int: 1, choose: { from: ["dex", "cha"], count: 1, amount: 2 } }],
  };
  const [scraped] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), newProficiencyReport());
  assert.deepEqual(scraped.abilityScoreIncrease, [{ int: 1 }]);
  assert.deepEqual(scraped.abilityScoreChoices, [{ from: ["dex", "cha"], count: 1, amount: 2 }]);
});

test("a choose block that omits count and amount defaults both to 1", async () => {
  const race = {
    name: "Sample Folk",
    source: "TST",
    entries: [],
    ability: [{ choose: { from: ["str", "dex", "con"] } }],
  };
  const [scraped] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), newProficiencyReport());
  assert.deepEqual(scraped.abilityScoreChoices, [{ from: ["str", "dex", "con"], count: 1, amount: 1 }]);
});

test("a record with no choose block carries no abilityScoreChoices field", async () => {
  const race = { name: "Sample Folk", source: "TST", entries: [], ability: [{ wis: 2 }] };
  const [scraped] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), newProficiencyReport());
  assert.equal("abilityScoreChoices" in scraped, false);
});

test("a subrace whose record overwrites its race's ability scores is marked, and one that does not is not", async () => {
  const race = { name: "Sample Folk", source: "TST", entries: [], ability: [{ con: 2 }] };
  const replacing = {
    name: "Replacer",
    source: "TST",
    raceName: "Sample Folk",
    raceSource: "TST",
    entries: [],
    ability: [{ dex: 1 }],
    overwrite: { ability: true },
  };
  const adding = {
    name: "Adder",
    source: "TST",
    raceName: "Sample Folk",
    raceSource: "TST",
    entries: [],
    ability: [{ wis: 1 }],
  };
  const [scraped] = await scrapeRaces(
    fakeClient({ "data/races.json": { race: [race], subrace: [replacing, adding] } }),
    newProficiencyReport(),
  );
  const [replacer, adder] = scraped.subraces;
  assert.equal(replacer.replacesRaceAbilityScores, true);
  assert.equal("replacesRaceAbilityScores" in adder, false);
  // Neither subrace takes its race's increase into its own.
  assert.deepEqual(replacer.abilityScoreIncrease, [{ dex: 1 }]);
  assert.deepEqual(adder.abilityScoreIncrease, [{ wis: 1 }]);
  assert.deepEqual(scraped.abilityScoreIncrease, [{ con: 2 }]);
});

test("a choose block with a key the scraper does not know is reported and writes no choice", async () => {
  const race = {
    name: "Odd Folk",
    source: "TST",
    entries: [],
    ability: [{ choose: { from: ["str", "dex"], count: 1, amount: 1, weight: 2 } }],
  };
  const report = newProficiencyReport();
  const [scraped] = await scrapeRaces(fakeClient({ "data/races.json": { race: [race] } }), report);
  assert.equal("abilityScoreChoices" in scraped, false);
  assert.equal(report.unparsed.length, 1);
  assert.equal(report.unparsed[0].owner, "Race");
  assert.equal(report.unparsed[0].feature, "Odd Folk");
});
