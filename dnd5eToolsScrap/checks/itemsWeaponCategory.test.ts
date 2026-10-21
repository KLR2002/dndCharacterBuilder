import test from "node:test";
import assert from "node:assert/strict";
import { scrapeItems } from "../src/scrapers/items.js";
import type { ToolsClient } from "../src/client.js";

/**
 * Invented base items from an invented book. The base list carries each weapon's simple or martial
 * category; the magic list carries a weapon category too, as the source data does for magic weapons,
 * and the scraper must not take those for base weapons.
 */
const BASE_ITEMS = [
  { name: "Thornwhip", source: "OTB", type: "M", weight: 2, weaponCategory: "martial", property: ["F|OTB"], dmg1: "1d6", dmgType: "P", weapon: true },
  { name: "Brightsling", source: "OTB", type: "R", weight: 0, weaponCategory: "simple", range: "30/120", dmg1: "1d4", dmgType: "B", weapon: true },
  { name: "Ember Lantern", source: "OTB", type: "G", weight: 1 },
  { name: "Glimmer Plate", source: "OTB", type: "HA", weight: 65, ac: 18, strength: 15 },
];

const MAGIC_ITEMS = [
  {
    name: "Thornwhip of Ash",
    source: "OTB",
    type: "M",
    weaponCategory: "martial",
    baseItem: "thornwhip|OTB",
    rarity: "rare",
    entries: ["Invented magic text for the scraper test."],
  },
];

const mockClient = {
  fetchJson: async (endpoint: string) => {
    if (endpoint === "data/items-base.json") return { baseitem: BASE_ITEMS };
    if (endpoint === "data/items.json") return { item: MAGIC_ITEMS };
    throw new Error(`unexpected endpoint ${endpoint}`);
  },
} as unknown as ToolsClient;

test("a base weapon carries its simple or martial category, from any book", async () => {
  const items = await scrapeItems(mockClient);
  const thornwhip = items.find((i) => i.name === "Thornwhip" && i.source === "OTB");
  assert.ok(thornwhip, "the invented base weapon is scraped");
  assert.equal(thornwhip.itemCategory, "Weapon");
  assert.equal(thornwhip.weaponCategory, "martial");

  const brightsling = items.find((i) => i.name === "Brightsling");
  assert.equal(brightsling?.weaponCategory, "simple");
});

test("items that are not base weapons carry no weapon category", async () => {
  const items = await scrapeItems(mockClient);
  const lantern = items.find((i) => i.name === "Ember Lantern");
  assert.ok(lantern, "the invented gear is scraped");
  assert.equal("weaponCategory" in lantern, false);

  const plate = items.find((i) => i.name === "Glimmer Plate");
  assert.equal("weaponCategory" in plate, false);
});

test("a magic weapon carries no category, even when its source data gives it one", async () => {
  const items = await scrapeItems(mockClient);
  const magic = items.find((i) => i.name === "Thornwhip of Ash");
  assert.ok(magic, "the invented magic weapon is scraped");
  assert.equal(magic.itemCategory, "Weapon");
  assert.equal("weaponCategory" in magic, false, "the magic weapon is not a base weapon");
});
