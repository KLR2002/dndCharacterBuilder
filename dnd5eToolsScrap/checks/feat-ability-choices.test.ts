import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeFeats } from "../src/scrapers/feats.ts";
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

async function scrapeOne(feat: Record<string, unknown>, report = newProficiencyReport()) {
  const [scraped] = await scrapeFeats(fakeClient({ "data/feats.json": { feat: [feat] } }), report);
  return scraped;
}

test("a feat whose only increase is a choose block of all six scores gives an Increase Choice and no fixed increase", async () => {
  const scraped = await scrapeOne({
    name: "Sample Steadfast",
    source: "AAA",
    entries: ["Placeholder text."],
    ability: [{ choose: { from: ["str", "dex", "con", "int", "wis", "cha"] } }],
  });
  assert.equal(scraped.abilityScoreIncrease, null);
  assert.deepEqual(scraped.abilityScoreChoices, [{ from: ["str", "dex", "con", "int", "wis", "cha"], count: 1, amount: 1 }]);
});

test("a choose block that carries its own sentence in entry gives the choice and reports nothing", async () => {
  const report = newProficiencyReport();
  const scraped = await scrapeOne(
    {
      name: "Sample Sentence",
      source: "AAA",
      entries: ["Placeholder text."],
      ability: [{ choose: { from: ["str", "dex"], amount: 1, entry: "Sample sentence about the chosen score." } }],
    },
    report,
  );
  assert.deepEqual(scraped.abilityScoreChoices, [{ from: ["str", "dex"], count: 1, amount: 1 }]);
  assert.equal(report.unparsed.length, 0);
});

test("a feat with a fixed score keeps it under its full name and carries no choices", async () => {
  const scraped = await scrapeOne({
    name: "Sample Sturdy",
    source: "AAA",
    entries: ["Placeholder text."],
    ability: [{ con: 1 }],
  });
  assert.deepEqual(scraped.abilityScoreIncrease, [{ Constitution: 1 }]);
  assert.equal("abilityScoreChoices" in scraped, false);
});

test("a choose block of two scores gives the scraper's raw keys, with the default count and amount", async () => {
  const scraped = await scrapeOne({
    name: "Sample Runner",
    source: "AAA",
    entries: ["Placeholder text."],
    ability: [{ choose: { from: ["str", "dex"] } }],
  });
  assert.equal(scraped.abilityScoreIncrease, null);
  assert.deepEqual(scraped.abilityScoreChoices, [{ from: ["str", "dex"], count: 1, amount: 1 }]);
});

test("a feat with a fixed score and a choose block keeps both, each in its own field", async () => {
  const scraped = await scrapeOne({
    name: "Sample Mixed",
    source: "AAA",
    entries: ["Placeholder text."],
    ability: [{ wis: 1 }, { choose: { from: ["int", "cha"], count: 2, amount: 1 } }],
  });
  assert.deepEqual(scraped.abilityScoreIncrease, [{ Wisdom: 1 }]);
  assert.deepEqual(scraped.abilityScoreChoices, [{ from: ["int", "cha"], count: 2, amount: 1 }]);
});

test("a choose block with a key the scraper does not know is reported and writes no choice", async () => {
  const report = newProficiencyReport();
  const scraped = await scrapeOne(
    {
      name: "Sample Odd",
      source: "AAA",
      entries: ["Placeholder text."],
      ability: [{ choose: { from: ["str", "dex"], count: 1, amount: 1, weight: 2 } }],
    },
    report,
  );
  assert.equal("abilityScoreChoices" in scraped, false);
  assert.equal(report.unparsed.length, 1);
  assert.equal(report.unparsed[0].owner, "Feat");
  assert.equal(report.unparsed[0].feature, "Sample Odd");
});

test("a feat with no ability entry has a null increase and no choices", async () => {
  const scraped = await scrapeOne({ name: "Sample Plain", source: "AAA", entries: ["Placeholder text."] });
  assert.equal(scraped.abilityScoreIncrease, null);
  assert.equal("abilityScoreChoices" in scraped, false);
});
