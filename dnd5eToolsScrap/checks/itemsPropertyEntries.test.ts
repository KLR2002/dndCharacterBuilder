import test from "node:test";
import assert from "node:assert/strict";
import { scrapeItems } from "../src/scrapers/items.js";
import type { ToolsClient } from "../src/client.js";

/**
 * Invented weapons from an invented book. The source data gives a weapon's properties as a list whose entries
 * are a code with an optional book suffix ("F|OTB"), a bare code ("T"), or an object whose uid names the
 * property and whose note is free text. The scraper must turn every entry into a property name.
 */
const BASE_ITEMS = [
  {
    name: "Gleamcleaver",
    source: "OTB",
    type: "M",
    weight: 3,
    weaponCategory: "martial",
    dmg1: "1d8",
    dmgType: "S",
    weapon: true,
    property: ["F|OTB", { uid: "2H|XPHB", note: "unless mounted" }, "T"],
  },
  {
    // Magic variants are generated from the base weapons of the PHB, so this one carries the same object form.
    name: "Sunlit Pike",
    source: "PHB",
    type: "M",
    weight: 18,
    weaponCategory: "martial",
    dmg1: "1d10",
    dmgType: "P",
    weapon: true,
    property: [{ uid: "H|XPHB", note: "invented note" }, "R"],
  },
];

const mockClient = {
  fetchJson: async (endpoint: string) => {
    if (endpoint === "data/items-base.json") return { baseitem: BASE_ITEMS };
    if (endpoint === "data/items.json") return { item: [] };
    throw new Error(`unexpected endpoint ${endpoint}`);
  },
} as unknown as ToolsClient;

test("a property written as a string, an object with a uid, or a bare code becomes a property name", async () => {
  const items = await scrapeItems(mockClient);
  const gleamcleaver = items.find((i) => i.name === "Gleamcleaver" && i.source === "OTB");
  assert.ok(gleamcleaver, "the invented weapon is scraped");
  assert.deepEqual(gleamcleaver.properties, ["Finesse", "Two-Handed", "Thrown"]);
});

test("a magic variant of a weapon whose property is an object carries the property name", async () => {
  const items = await scrapeItems(mockClient);
  const variant = items.find((i) => i.name === "Sunlit Pike, +1");
  assert.ok(variant, "the invented magic variant is generated");
  assert.deepEqual(variant.properties, ["Heavy", "Reach"]);
});
