import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeFeats } from "../src/scrapers/feats.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Invented feats in the raw 5e.tools shape. The scraper keeps a feat's structured spell grants (ADR 0017) as the source
// gives them, with each spell name normalised the way the subclass grants are, and leaves a feat without any alone.

const raw = {
  feat: [
    {
      name: "Sample Cinder",
      source: "AAA",
      entries: ["Placeholder text."],
      additionalSpells: [
        {
          ability: "inherit",
          known: { _: ["sample ember#c"] },
          innate: { _: { daily: { "1": ["sample veil|aaa"] } } },
        },
      ],
    },
    {
      name: "Sample Chooser",
      source: "AAA",
      entries: ["Placeholder text."],
      additionalSpells: [
        {
          ability: { choose: ["int", "wis", "cha"] },
          innate: { _: { daily: { "1e": [{ choose: "level=1|class=Sample Mage" }] } } },
        },
      ],
    },
    { name: "Sample Plain", source: "AAA", entries: ["Placeholder text."] },
  ],
};

const client = { fetchJson: async () => raw } as unknown as ToolsClient;

test("a feat's spell grants are copied onto the feat, with the ability and the names normalised", async () => {
  const feats = await scrapeFeats(client, newProficiencyReport());
  const cinder = feats.find((feat) => feat.name === "Sample Cinder");
  assert.deepEqual(cinder?.additionalSpells, [
    {
      ability: "inherit",
      known: { _: ["sample ember"] },
      innate: { _: { daily: { "1": ["sample veil"] } } },
    },
  ]);
});

test("a feat's ability pick and its spell picks are kept as they are, for the picker to read", async () => {
  const feats = await scrapeFeats(client, newProficiencyReport());
  const chooser = feats.find((feat) => feat.name === "Sample Chooser");
  assert.deepEqual(chooser?.additionalSpells, [
    {
      ability: { choose: ["int", "wis", "cha"] },
      innate: { _: { daily: { "1e": [{ choose: "level=1|class=Sample Mage" }] } } },
    },
  ]);
});

test("a feat with no spell grants has no additionalSpells field", async () => {
  const feats = await scrapeFeats(client, newProficiencyReport());
  const plain = feats.find((feat) => feat.name === "Sample Plain");
  assert.equal("additionalSpells" in (plain ?? {}), false);
});
