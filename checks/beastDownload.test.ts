import test from "node:test";
import assert from "node:assert/strict";
import type { ToolsClient } from "../dnd5eToolsScrap/src/types/models.ts";
import { downloadBeasts } from "../src/services/scraper/beastDownload.ts";
import {
  __setCompendiumKvForTests,
  loadCompendiumData,
} from "../src/services/compendiumStorage.ts";
import { currentCompendium, integrate, revertToSrd } from "../src/services/compendium.ts";
import { __setKvForTests, loadSettings } from "../src/services/storage.ts";
import { resetTestCompendium } from "./testUtils.ts";

const CATALOG_KEY = "@dnd5e_integrated_compendium";
const SETTINGS_KEY = "@dnd5e_app_settings";
const BESTIARY_FILE = "data/bestiary/bestiary-mm.json";

// A beast at CR 6 or less is kept, a beast over CR 6 and a swarm are dropped, a humanoid is dropped,
// and the MM elementals named in the Wild Shape list are kept.
const MONSTERS = [
  { name: "Brown Bear", source: "MM", type: "beast", cr: "1", size: ["L"], ac: 11, hp: { average: 34, formula: "4d10+12" }, speed: { walk: 40 } },
  { name: "Giant Ape", source: "MM", type: "beast", cr: "7", size: ["H"], ac: 12, hp: { average: 157, formula: "15d12+60" }, speed: { walk: 40 } },
  { name: "Swarm of Rats", source: "MM", type: "beast", cr: "1/4", size: ["M"], ac: 12, hp: { average: 24, formula: "7d8-7" }, speed: { walk: 30 } },
  { name: "Goblin", source: "MM", type: "humanoid", cr: "1/4", size: ["S"], ac: 15, hp: { average: 7, formula: "2d6" }, speed: { walk: 30 } },
  { name: "Fire Elemental", source: "MM", type: "elemental", cr: "5", size: ["L"], ac: 13, hp: { average: 102, formula: "12d10+36" }, speed: { walk: 50 } },
  { name: "Air Elemental", source: "MM", type: "elemental", cr: "5", size: ["L"], ac: 15, hp: { average: 90, formula: "12d10+24" }, speed: { walk: 0, fly: 90 } },
];

const EXPECTED_BEAST_NAMES = ["Air Elemental", "Brown Bear", "Fire Elemental"];

/** A stale Integrated Catalog (format 15) saved with no beasts. */
function savedCatalogWithoutBeasts() {
  return {
    hasIntegratedCatalog: true,
    catalogFormat: 15,
    integratedAt: "2026-03-01T09:00:00.000Z",
    races: [{ name: "Elf", source: "PHB", speed: { walk: 30 }, traits: [] }],
    classes: [{ name: "Wizard", source: "PHB", hitDie: 6, subclasses: [] }],
    feats: [{ name: "Alert", source: "PHB" }],
    backgrounds: [],
    items: [{ name: "Rope", source: "PHB" }],
    spells: [{ name: "Light", source: "PHB", level: 0 }],
    beasts: [],
    conditions: [],
    optionsAndFeatures: [],
    books: [],
    originRules: [],
  };
}

/** A client that serves the bestiary index and every bestiary file. Each request is recorded. */
function bestiaryClient(requests: string[]): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      requests.push(endpoint);
      if (endpoint === "data/bestiary/index.json") return { MM: "bestiary-mm.json" };
      if (endpoint === BESTIARY_FILE) return { monster: MONSTERS };
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  } as ToolsClient;
}

/** A client whose connection drops on the first request. */
function connectionDownClient(requests: string[]): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      requests.push(endpoint);
      throw new Error("connection reset");
    },
  } as ToolsClient;
}

/** A client that serves the index, but every bestiary file fails (the sync warns per file and keeps going). */
function emptyBestiaryClient(requests: string[]): ToolsClient {
  return {
    fetchJson: async (endpoint: string) => {
      requests.push(endpoint);
      if (endpoint === "data/bestiary/index.json") return { MM: "bestiary-mm.json" };
      throw new Error("HTTP 503 from the mirror");
    },
  } as ToolsClient;
}

/** Stores a saved catalog and the app settings in fresh in-memory stores, and makes the Compendium read the catalog. */
function setUpSavedCatalog(settings: object = { skipBeasts: true }) {
  const catalogKv = new Map<string, string>([[CATALOG_KEY, JSON.stringify(savedCatalogWithoutBeasts())]]);
  __setCompendiumKvForTests(catalogKv);
  __setKvForTests(new Map([[SETTINGS_KEY, JSON.stringify(settings)]]));
  integrate(JSON.parse(catalogKv.get(CATALOG_KEY)!));
}

test("downloading beasts into a stale catalog adds only the filtered beasts", async () => {
  setUpSavedCatalog();
  try {
    const before = await loadCompendiumData();
    assert.ok(before);
    assert.equal(currentCompendium().lacksBeasts, true);

    const requests: string[] = [];
    await downloadBeasts(bestiaryClient(requests));

    const after = await loadCompendiumData();
    assert.ok(after);
    assert.equal(after.catalogFormat, 15, "the catalog keeps its saved format, so it stays stale");
    assert.equal(after.integratedAt, "2026-03-01T09:00:00.000Z", "the Last synced date is unchanged");
    assert.equal(currentCompendium().stale, true);

    const { beasts: beastsBefore, ...otherBefore } = before;
    const { beasts: beastsAfter, ...otherAfter } = after;
    assert.deepEqual(otherAfter, otherBefore, "every other collection is unchanged");
    assert.deepEqual(beastsAfter.map((b: { name: string }) => b.name), EXPECTED_BEAST_NAMES);
    assert.deepEqual(beastsBefore, []);

    assert.deepEqual(currentCompendium().for().beasts().map((b) => b.name), EXPECTED_BEAST_NAMES);
    assert.equal(currentCompendium().lacksBeasts, false);
  } finally {
    __setCompendiumKvForTests(undefined);
    __setKvForTests(new Map());
    resetTestCompendium();
  }
});

test("downloading beasts reports one progress step named Beasts", async () => {
  setUpSavedCatalog();
  try {
    const reports: [string, number, number][] = [];
    await downloadBeasts(bestiaryClient([]), (category, step, total) => reports.push([category, step, total]));
    assert.deepEqual(reports, [["Beasts", 1, 1]]);
  } finally {
    __setCompendiumKvForTests(undefined);
    __setKvForTests(new Map());
    resetTestCompendium();
  }
});

test("a successful beast download turns Skip Beasts off after the catalog is saved", async () => {
  setUpSavedCatalog({ skipBeasts: true });
  try {
    assert.equal((await loadSettings()).skipBeasts, true);
    await downloadBeasts(bestiaryClient([]));
    assert.equal((await loadSettings()).skipBeasts, false);
  } finally {
    __setCompendiumKvForTests(undefined);
    __setKvForTests(new Map());
    resetTestCompendium();
  }
});

test("a beast download that throws leaves the catalog, the setting and the listing unchanged", async () => {
  setUpSavedCatalog({ skipBeasts: true });
  try {
    const catalogBefore = await loadCompendiumData();
    const listingBefore = currentCompendium().for().beasts().map((b) => b.name);

    await assert.rejects(downloadBeasts(connectionDownClient([])), /connection reset/);

    assert.deepEqual(await loadCompendiumData(), catalogBefore);
    assert.equal((await loadSettings()).skipBeasts, true);
    assert.equal(currentCompendium().lacksBeasts, true);
    assert.deepEqual(currentCompendium().for().beasts().map((b) => b.name), listingBefore);
    assert.equal(listingBefore.length, 92, "the Compendium still lists the SRD Baseline's beasts");
    assert.ok(currentCompendium().for().beasts().every((b) => b.source === "SRD"));
  } finally {
    __setCompendiumKvForTests(undefined);
    __setKvForTests(new Map());
    resetTestCompendium();
  }
});

test("a beast download whose bestiary yields no beasts is refused and changes nothing", async () => {
  setUpSavedCatalog({ skipBeasts: true });
  try {
    const catalogBefore = await loadCompendiumData();
    const listingBefore = currentCompendium().for().beasts().map((b) => b.name);
    const requests: string[] = [];

    await assert.rejects(downloadBeasts(emptyBestiaryClient(requests)), /no beasts/);

    assert.ok(requests.includes(BESTIARY_FILE), "the bestiary file was requested and failed");
    assert.deepEqual(await loadCompendiumData(), catalogBefore);
    assert.equal((await loadSettings()).skipBeasts, true);
    assert.deepEqual(currentCompendium().for().beasts().map((b) => b.name), listingBefore);
    assert.equal(listingBefore.length, 92);
  } finally {
    __setCompendiumKvForTests(undefined);
    __setKvForTests(new Map());
    resetTestCompendium();
  }
});

test("the SRD Baseline refuses a beast download and saves nothing", async () => {
  __setCompendiumKvForTests(new Map());
  __setKvForTests(new Map([[SETTINGS_KEY, JSON.stringify({ skipBeasts: true })]]));
  revertToSrd();
  try {
    const requests: string[] = [];
    await assert.rejects(downloadBeasts(bestiaryClient(requests)), /Integrated Catalog/);

    assert.deepEqual(requests, [], "no bestiary request is made");
    assert.equal(await loadCompendiumData(), null);
    assert.equal((await loadSettings()).skipBeasts, true);
  } finally {
    __setCompendiumKvForTests(undefined);
    __setKvForTests(new Map());
    resetTestCompendium();
  }
});
