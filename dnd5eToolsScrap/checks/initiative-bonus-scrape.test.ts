import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Invented class, subclass and sentences in the raw 5e.tools shape. The scraper reads the Initiative Bonus of each
// class and subclass feature from its prose, and reports a candidate sentence it cannot read.

const QUICK = "Placeholder text. You add your Wisdom modifier to your initiative rolls.";
const GAMBIT = "Placeholder text. You can give yourself a bonus to your initiative rolls equal to your Charisma modifier.";
const BANNER = "Placeholder text. Each ally within 30 feet gains a +2 bonus to initiative rolls.";

const raw = {
  class: [{ name: "Sample Artificer", source: "AAA", hd: { number: 1, faces: 8 }, proficiency: ["int", "con"], entries: [] }],
  classFeature: [
    { name: "Quick Sense", source: "AAA", className: "Sample Artificer", classSource: "AAA", level: 1, entries: [QUICK] },
    { name: "Ally Banner", source: "AAA", className: "Sample Artificer", classSource: "AAA", level: 2, entries: [BANNER] },
    { name: "Plain Step", source: "AAA", className: "Sample Artificer", classSource: "AAA", level: 2, entries: ["Placeholder text."] },
  ],
  subclass: [{ name: "Sample Path", shortName: "Sample Path", source: "AAA", className: "Sample Artificer", classSource: "AAA" }],
  subclassFeature: [
    {
      name: "Sample Gambit",
      source: "AAA",
      className: "Sample Artificer",
      classSource: "AAA",
      subclassShortName: "Sample Path",
      subclassSource: "AAA",
      level: 3,
      entries: [GAMBIT],
    },
  ],
};

const client = {
  fetchJson: async (endpoint: string) => {
    if (endpoint === "data/class/index.json") return { sample: "class-sample.json" };
    if (endpoint === "data/class/class-sample.json") return raw;
    throw new Error(`unexpected endpoint ${endpoint}`);
  },
} as unknown as ToolsClient;

test("a class feature and a subclass feature carry the Initiative Bonus their prose gives, and no others do", async () => {
  const report = newProficiencyReport();
  const [sample] = await scrapeClasses(client, report);
  const quick = sample.features.find((feature) => feature.name === "Quick Sense");
  const banner = sample.features.find((feature) => feature.name === "Ally Banner");
  const plain = sample.features.find((feature) => feature.name === "Plain Step");
  const gambit = sample.subclasses[0].features.find((feature) => feature.name === "Sample Gambit");

  assert.deepEqual(quick?.initiativeBonus, { kind: "ability", ability: "wis" });
  assert.deepEqual(gambit?.initiativeBonus, { kind: "ability", ability: "cha" });
  assert.equal(banner && "initiativeBonus" in banner, false, "a flat bonus is not extracted yet");
  assert.equal(plain && "initiativeBonus" in plain, false, "a feature with no initiative sentence carries none");
});

test("a candidate initiative sentence the scraper cannot read is reported for review, not dropped", async () => {
  const report = newProficiencyReport();
  await scrapeClasses(client, report);
  assert.deepEqual(report.unparsed, [
    { owner: "Sample Artificer", feature: "Ally Banner", level: 2, unparsed: ["Each ally within 30 feet gains a +2 bonus to initiative rolls"] },
  ]);
});
