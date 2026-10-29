import test from "node:test";
import assert from "node:assert/strict";
import { BrowserToolsClient } from "../src/services/scraper/browserClient.ts";
import { runInAppIntegration } from "../src/services/scraper/runner.ts";
import {
  __setCompendiumKvForTests,
  loadCompendiumData,
  clearCompendiumData,
  REQUIRED_CATALOG_FORMAT,
} from "../src/services/compendiumStorage.ts";
import { isCompendiumIntegrated } from "../src/services/dataService.ts";
import { resetTestCompendium } from "./testUtils.ts";

test("BrowserToolsClient: constructs endpoints and fetches JSON", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let requestedUrl = "";
    globalThis.fetch = (async (url: string | URL | Request) => {
      requestedUrl = String(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ test: 123 }),
      } as any;
    }) as any;

    const client = new BrowserToolsClient("https://raw.githubusercontent.com/test-owner/test-repo/master/");
    const res = await client.fetchJson<{ test: number }>("/data/spells.json");

    assert.equal(requestedUrl, "https://raw.githubusercontent.com/test-owner/test-repo/master/data/spells.json");
    assert.deepEqual(res, { test: 123 });

    // Full URL support
    const fullRes = await client.fetchJson<{ test: number }>("https://custom-domain.com/data/spells.json");
    assert.equal(requestedUrl, "https://custom-domain.com/data/spells.json");
    assert.deepEqual(fullRes, { test: 123 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("BrowserToolsClient: throws descriptive error on HTTP failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as any;

    const client = new BrowserToolsClient();
    await assert.rejects(
      async () => {
        await client.fetchJson("data/missing.json");
      },
      {
        message: /Failed to fetch data\/missing.json \(HTTP 404\)/,
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runInAppIntegration: orchestrates 10 scrapers, reports progress, and hydrates CompendiumStorage", async () => {
  const testKv = new Map<string, string>();
  __setCompendiumKvForTests(testKv);

  const originalFetch = globalThis.fetch;
  try {
    // Provide minimal mock payloads for each scrapers' endpoints
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);

      if (urlStr.includes("data/races.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ race: [{ name: "Elf", source: "PHB", speed: 30, size: ["M"] }] }),
        } as any;
      }
      if (urlStr.includes("data/class/index.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ wizard: "class-wizard.json" }),
        } as any;
      }
      if (urlStr.includes("data/class/class-wizard.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            class: [{ name: "Wizard", source: "PHB", hd: { faces: 6 } }],
            subclass: [],
            classFeature: [],
            subclassFeature: [],
          }),
        } as any;
      }
      if (urlStr.includes("data/feats.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ feat: [{ name: "Alert", source: "PHB" }] }),
        } as any;
      }
      if (urlStr.includes("data/optionalfeatures.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ optionalfeature: [{ name: "Agonizing Blast", source: "PHB", featureType: ["EI"] }] }),
        } as any;
      }
      if (urlStr.includes("data/charcreationoptions.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ charoption: [] }),
        } as any;
      }
      if (urlStr.includes("data/backgrounds.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ background: [{ name: "Acolyte", source: "PHB" }] }),
        } as any;
      }
      if (urlStr.includes("data/items-base.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ baseitem: [{ name: "Dagger", source: "PHB", type: "M" }] }),
        } as any;
      }
      if (urlStr.includes("data/items.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ item: [] }),
        } as any;
      }
      if (urlStr.includes("data/magicvariants.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ magicvariant: [] }),
        } as any;
      }
      if (urlStr.includes("data/spells/index.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ phb: "spells-phb.json" }),
        } as any;
      }
      if (urlStr.includes("data/spells/sources.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as any;
      }
      if (urlStr.includes("data/spells/spells-phb.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            spell: [{
              name: "Fireball",
              source: "PHB",
              level: 3,
              school: "V",
              time: [{ number: 1, unit: "action" }],
              range: { type: "point", distance: { type: "feet", amount: 150 } },
              components: { v: true, s: true, m: "bat guano" },
              duration: [{ type: "instant" }],
              entries: ["A bright streak flashes..."],
            }],
          }),
        } as any;
      }
      if (urlStr.includes("data/bestiary/index.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ mm: "bestiary-mm.json" }),
        } as any;
      }
      if (urlStr.includes("data/bestiary/bestiary-mm.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            monster: [{
              name: "Wolf",
              source: "MM",
              size: "M",
              type: "beast",
              cr: "1/4",
              ac: [13],
              hp: { average: 11, formula: "2d8 + 2" },
              speed: { walk: 40 },
              str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6,
            }],
          }),
        } as any;
      }
      if (urlStr.includes("data/conditionsdiseases.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            condition: [{ name: "Blinded", source: "PHB", entries: ["A blinded creature can't see."] }],
          }),
        } as any;
      }
      if (urlStr.includes("data/books.json")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            book: [{ name: "Player's Handbook", id: "PHB", source: "PHB", group: "core" }],
          }),
        } as any;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as any;
    }) as any;

    const progressReports: { category: string; step: number; total: number }[] = [];
    const result = await runInAppIntegration((category, step, total) => {
      progressReports.push({ category, step, total });
    });

    assert.equal(progressReports.length, 10);
    assert.equal(progressReports[0].category, "Races");
    assert.equal(progressReports[9].category, "Books");
    assert.equal(result.hasIntegratedCatalog, true);
    assert.ok(result.integratedAt);
    assert.equal(result.catalogFormat, REQUIRED_CATALOG_FORMAT, "the synced catalog is current, so the context clears the stale flag");

    // Verify storage has been written
    const stored = await loadCompendiumData();
    assert.ok(stored);
    assert.equal(stored?.hasIntegratedCatalog, true);
    assert.equal(stored?.catalogFormat, REQUIRED_CATALOG_FORMAT, "a sync stamps the required catalog format");
    assert.equal(stored?.races.length, 1);
    assert.equal(stored?.races[0].name, "Elf");
    assert.equal(stored?.classes.length, 1);
    assert.equal(stored?.classes[0].name, "Wizard");

    // Verify dataService activeCompendiumStore cutover
    assert.equal(isCompendiumIntegrated(), true);
  } finally {
    globalThis.fetch = originalFetch;
    await clearCompendiumData();
    __setCompendiumKvForTests(undefined);
    resetTestCompendium();
  }
});

test("scrapeOptions: handles non-string spell, item, and feature prerequisites without crashing", async () => {
  const { scrapeOptions } = await import("../dnd5eToolsScrap/src/scrapers/options.ts");
  const mockClient = {
    fetchJson: async (endpoint: string) => {
      if (endpoint === "data/optionalfeatures.json") {
        return {
          optionalfeature: [
            {
              name: "Agonizing Blast",
              source: "PHB",
              featureType: ["EI"],
              prerequisite: [
                {
                  spell: [{ choose: "level=0|class=Warlock" }],
                },
              ],
            },
            {
              name: "Eldritch Smite",
              source: "XGE",
              featureType: ["EI"],
              prerequisite: [
                {
                  level: 5,
                  pact: "Blade",
                  item: [{ name: "pact weapon#phb" }],
                  feature: [{ name: "Pact of the Blade#phb" }],
                },
              ],
            },
            {
              name: "Pact Magic Feature Required",
              source: "TCE",
              featureType: ["EI"],
              prerequisite: [
                {
                  spell: true,
                },
              ],
            },
            {
              name: "Single Spell Object",
              source: "TCE",
              featureType: ["EI"],
              prerequisite: [
                {
                  spell: { choose: "level=1" },
                },
              ],
            },
          ],
        };
      }
      return { charoption: [] };
    },
  };

  const results = await scrapeOptions(mockClient as any);
  assert.equal(results.length, 4);
  assert.equal(results[0].name, "Agonizing Blast");
  assert.ok(results[0].prerequisite?.includes("a level=0|class=Warlock spell"));
  assert.equal(results[1].name, "Eldritch Smite");
  assert.ok(results[1].prerequisite?.includes("Pact of the Blade"));
  assert.equal(results[2].name, "Pact Magic Feature Required");
  assert.ok(results[2].prerequisite?.includes("Spellcasting or Pact Magic feature"));
  assert.equal(results[3].name, "Single Spell Object");
  assert.ok(results[3].prerequisite?.includes("a level=1 spell"));
});

test("scrapeBackgrounds: handles entries without string names without crashing", async () => {
  const { scrapeBackgrounds } = await import("../dnd5eToolsScrap/src/scrapers/backgrounds.ts");
  const mockClient = {
    fetchJson: async (endpoint: string) => {
      if (endpoint === "data/backgrounds.json") {
        return {
          background: [
            {
              name: "Custom Background",
              source: "PHB",
              entries: [
                {
                  type: "entries",
                  name: "Feature: Custom Shelter",
                  entries: ["You have shelter."],
                  data: { isFeature: true },
                },
                {
                  type: "entries",
                  // No name property, or non-feature
                  entries: ["Plain entry."],
                },
              ],
            },
          ],
        };
      }
      return {};
    },
  };

  const results = await scrapeBackgrounds(mockClient as any);
  assert.equal(results.length, 1);
  assert.equal(results[0].name, "Custom Background");
  assert.equal(results[0].feature?.name, "Custom Shelter");
});


