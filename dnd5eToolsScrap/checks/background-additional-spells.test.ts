import { test } from "node:test";
import assert from "node:assert/strict";
import { scrapeBackgrounds } from "../src/scrapers/backgrounds.ts";
import { newProficiencyReport } from "../src/parser/proficiency-grants.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Invented backgrounds in the raw 5e.tools shape. The scraper keeps a background's expanded spell lists (ADR 0017), keyed by
// spell level as the source gives them (s0 is cantrips), with each spell name normalised the way the subclass grants are.

const raw = {
  background: [
    {
      name: "Sample Scholar",
      source: "AAA",
      entries: ["Placeholder text."],
      additionalSpells: [
        {
          expanded: {
            s0: ["sample ember#c", "sample glimmer#c"],
            s1: ["sample pulse|aaa"],
            s5: ["sample veil"],
          },
        },
      ],
    },
    { name: "Sample Plain", source: "AAA", entries: ["Placeholder text."] },
  ],
};

const client = { fetchJson: async () => raw } as unknown as ToolsClient;

test("a background's expanded spell lists are kept by spell level, with the names normalised", async () => {
  const backgrounds = await scrapeBackgrounds(client, newProficiencyReport());
  const scholar = backgrounds.find((background) => background.name === "Sample Scholar");
  assert.deepEqual(scholar?.additionalSpells, [
    {
      expanded: {
        s0: ["sample ember", "sample glimmer"],
        s1: ["sample pulse"],
        s5: ["sample veil"],
      },
    },
  ]);
});

test("a background with no spell grants has no additionalSpells field", async () => {
  const backgrounds = await scrapeBackgrounds(client, newProficiencyReport());
  const plain = backgrounds.find((background) => background.name === "Sample Plain");
  assert.equal("additionalSpells" in (plain ?? {}), false);
});
