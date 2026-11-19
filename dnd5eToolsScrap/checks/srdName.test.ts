import test from "node:test";
import assert from "node:assert/strict";
import { scrapeItems } from "../src/scrapers/items.ts";
import { scrapeSpells } from "../src/scrapers/spells.ts";
import type { ToolsClient } from "../src/types/models.ts";

// Every name and sentence in this file is invented. The `srd` field is the 5e.tools shape: `true`, or a string naming the SRD record.

const mockSpellClient = {
  fetchJson: async (endpoint: string) => {
    if (endpoint === "data/spells/index.json") return { PHB: "spells-phb.json" };
    if (endpoint === "data/spells/spells-phb.json") {
      return {
        spell: [
          {
            name: "Sample Bolt",
            source: "OTB",
            level: 2,
            school: "V",
            srd: "Plain Bolt",
            time: [{ number: 1, unit: "action" }],
            range: { type: "point", distance: { type: "feet", amount: 60 } },
            components: { v: true, s: true },
            duration: [{ type: "instant" }],
            entries: ["Invented spell text for the scraper test."],
          },
          {
            name: "Sample Ward",
            source: "OTB",
            level: 1,
            school: "A",
            srd: true,
            time: [{ number: 1, unit: "action" }],
            range: { type: "point", distance: { type: "self" } },
            components: { v: true, s: true },
            duration: [{ type: "instant" }],
            entries: ["Invented spell text for the scraper test."],
          },
        ],
      };
    }
    if (endpoint === "data/spells/sources.json") return {};
    throw new Error(`unexpected endpoint ${endpoint}`);
  },
} as unknown as ToolsClient;

const mockItemClient = {
  fetchJson: async (endpoint: string) => {
    if (endpoint === "data/items-base.json") return { baseitem: [] };
    if (endpoint === "data/items.json") {
      return {
        item: [
          { name: "Sample Satchel", source: "OTB", type: "W", rarity: "rare", srd: "Plain Satchel", entries: ["Invented item text."] },
          { name: "Sample Lantern", source: "OTB", type: "W", rarity: "rare", srd: true, entries: ["Invented item text."] },
        ],
      };
    }
    if (endpoint === "data/magicvariants.json") throw new Error("not available");
    throw new Error(`unexpected endpoint ${endpoint}`);
  },
} as unknown as ToolsClient;

test("a spell whose srd field names an SRD record carries that name as srdName", async () => {
  const spells = await scrapeSpells(mockSpellClient);
  const bolt = spells.find((s) => s.name === "Sample Bolt");
  assert.ok(bolt, "the invented spell is scraped");
  assert.equal(bolt.srdName, "Plain Bolt");
});

test("a spell whose srd field is true carries no srdName", async () => {
  const spells = await scrapeSpells(mockSpellClient);
  const ward = spells.find((s) => s.name === "Sample Ward");
  assert.ok(ward, "the invented spell is scraped");
  assert.equal("srdName" in ward, false);
});

test("an item whose srd field names an SRD record carries that name as srdName", async () => {
  const items = await scrapeItems(mockItemClient);
  const satchel = items.find((i) => i.name === "Sample Satchel");
  assert.ok(satchel, "the invented item is scraped");
  assert.equal(satchel.srdName, "Plain Satchel");
});

test("an item whose srd field is true carries no srdName", async () => {
  const items = await scrapeItems(mockItemClient);
  const lantern = items.find((i) => i.name === "Sample Lantern");
  assert.ok(lantern, "the invented item is scraped");
  assert.equal("srdName" in lantern, false);
});
