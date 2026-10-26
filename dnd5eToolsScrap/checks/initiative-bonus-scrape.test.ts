import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import { scrapeFeats } from "../src/scrapers/feats.ts";
import { scrapeRaces } from "../src/scrapers/races.ts";
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
  assert.equal(banner && "initiativeBonus" in banner, false, "a bonus given only to allies is reported, not given to the holder");
  assert.equal(plain && "initiativeBonus" in plain, false, "a feature with no initiative sentence carries none");
});

test("a feat's flat Initiative Bonus is read from its prose, and a feat with no initiative sentence carries none", async () => {
  const featClient = {
    fetchJson: async (endpoint: string) => {
      if (endpoint === "data/feats.json") {
        return {
          feat: [
            { name: "Sample Sentry", source: "AAA", entries: ["Placeholder text.", "You gain a +3 bonus to initiative."] },
            { name: "Sample Plain", source: "AAA", entries: ["Placeholder text."] },
          ],
        };
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  } as unknown as ToolsClient;
  const [sentry, plain] = await scrapeFeats(featClient, newProficiencyReport());
  assert.deepEqual(sentry.initiativeBonus, { kind: "flat", value: 3 });
  assert.equal("initiativeBonus" in plain, false);
});

test("a candidate initiative sentence the scraper cannot read is reported for review, not dropped", async () => {
  const report = newProficiencyReport();
  await scrapeClasses(client, report);
  assert.deepEqual(report.unparsed, [
    { owner: "Sample Artificer", feature: "Ally Banner", level: 2, unparsed: ["Each ally within 30 feet gains a +2 bonus to initiative rolls"] },
  ]);
});

// A race and a subrace whose traits carry Initiative Bonuses (ADR 0016): the bonus sits on the trait, not the race.
const HOPPER = {
  name: "Sample Hopper",
  source: "TST",
  entries: [
    { type: "entries", name: "Quick Hop", entries: ["Placeholder text.", "You can add your proficiency bonus to your initiative rolls."] },
    { type: "entries", name: "Plain Trait", entries: ["Placeholder text."] },
    { type: "entries", name: "Hop Banner", entries: ["Each ally within 30 feet gains a +2 bonus to initiative rolls."] },
  ],
};

const HOPPER_SUBRACE = {
  name: "Hillward",
  source: "TST",
  raceName: "Sample Hopper",
  raceSource: "TST",
  entries: [{ type: "entries", name: "Sample Gift", entries: ["You add your Wisdom modifier to your initiative rolls."] }],
};

test("a race trait and a subrace trait carry the Initiative Bonus their own prose gives, and no others do", async () => {
  const report = newProficiencyReport();
  const payloads: Record<string, unknown> = { "data/races.json": { race: [HOPPER], subrace: [HOPPER_SUBRACE] } };
  const raceClient = {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in payloads)) throw new Error(`unexpected endpoint ${endpoint}`);
      return payloads[endpoint];
    },
  } as unknown as ToolsClient;
  const [hopper] = await scrapeRaces(raceClient, report);
  const quick = hopper.traits.find((trait) => trait.name === "Quick Hop");
  const plain = hopper.traits.find((trait) => trait.name === "Plain Trait");
  const banner = hopper.traits.find((trait) => trait.name === "Hop Banner");
  const gift = hopper.subraces[0].traits.find((trait) => trait.name === "Sample Gift");

  assert.deepEqual(quick?.initiativeBonus, { kind: "proficiency" });
  assert.deepEqual(gift?.initiativeBonus, { kind: "ability", ability: "wis" });
  assert.equal(banner && "initiativeBonus" in banner, false, "a bonus given only to allies is reported, not given to the holder");
  assert.equal(plain && "initiativeBonus" in plain, false, "a trait with no initiative sentence carries none");
  assert.deepEqual(report.unparsed, [
    { owner: "Sample Hopper", feature: "Hop Banner", level: 0, unparsed: ["Each ally within 30 feet gains a +2 bonus to initiative rolls"] },
  ]);
});
