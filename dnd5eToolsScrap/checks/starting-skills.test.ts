import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeClasses } from "../src/scrapers/classes.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Every name and sentence in this file is invented. The skill entries are in the raw 5e.tools shape.

const SAMPLE_CLASSES = {
  class: [
    {
      name: "Sample Minstrel",
      source: "AAA",
      hd: { number: 1, faces: 8 },
      proficiency: ["dex", "cha"],
      startingProficiencies: { skills: [{ any: 3 }] },
    },
    {
      name: "Sample Scout",
      source: "AAA",
      hd: { number: 1, faces: 8 },
      proficiency: ["dex", "int"],
      startingProficiencies: {
        skills: [{ choose: { count: 4, from: ["Stealth", "Perception"] } }],
      },
    },
  ],
  subclass: [],
};

const payloads: Record<string, unknown> = {
  "data/class/index.json": { sample: "class-sample.json" },
  "data/class/class-sample.json": SAMPLE_CLASSES,
  "data/class/fluff-index.json": {},
};

function clientWith(): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      if (!(endpoint in payloads)) throw new Error(`unexpected endpoint ${endpoint}`);
      return payloads[endpoint];
    },
  } as unknown as ToolsClient;
}

test("a class whose starting skills are any three gives a choice of three from any skill", async () => {
  const classes = await scrapeClasses(clientWith(), newProficiencyReport());
  const minstrel = classes.find((cls) => cls.name === "Sample Minstrel");
  assert.deepEqual(minstrel?.skillProficiencies, { choose: 3, from: [] });
});

test("a class whose starting skills are a named pool keeps its count and pool", async () => {
  const classes = await scrapeClasses(clientWith(), newProficiencyReport());
  const scout = classes.find((cls) => cls.name === "Sample Scout");
  assert.deepEqual(scout?.skillProficiencies, { choose: 4, from: ["Stealth", "Perception"] });
});
