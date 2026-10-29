import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __setCompendiumKvForTests,
  saveCompendiumData,
  loadCompendiumData,
  clearCompendiumData,
  hasIntegratedCatalog,
  REQUIRED_CATALOG_FORMAT,
  type CompendiumCollections,
} from "../src/services/compendiumStorage.ts";
import {
  isCompendiumIntegrated,
  getRaces,
  getClasses,
  getSpells,
  findClass,
} from "../src/services/dataService.ts";
import { revertToSrd } from "../src/services/compendium.ts";
import { hydrateCompendiumFromStorage } from "./testUtils.ts";

test("compendiumStorage: default state has no integrated catalog and falls back to SRD", async () => {
  const kv = new Map<string, string>();
  __setCompendiumKvForTests(kv);
  revertToSrd();

  assert.equal(await hasIntegratedCatalog(), false);
  const loaded = await loadCompendiumData();
  assert.equal(loaded, null);

  // DataService returns SRD baseline
  const races = getRaces();
  assert.ok(races.length > 0);
  assert.ok(races.every((r) => r.source === "SRD"), "All default races must have source: SRD");

  const classes = getClasses();
  assert.equal(classes.length, 12);
  assert.ok(classes.every((c) => c.source === "SRD"), "All default classes must have source: SRD");
  // Only 1 archetype per class
  for (const c of classes) {
    assert.equal(c.subclasses?.length, 1, `SRD class ${c.name} must have exactly 1 archetype`);
  }
});

test("compendiumStorage: saving data persists and hydrates compendiumStore with dataset swapping", async () => {
  const kv = new Map<string, string>();
  __setCompendiumKvForTests(kv);

  const mockCollections: CompendiumCollections = {
    hasIntegratedCatalog: true,
    integratedAt: new Date().toISOString(),
    races: [
      { name: "High Elf", source: "PHB", speed: { walk: 30 }, traits: [] } as any,
      { name: "Tabaxi", source: "VGM", speed: { walk: 30 }, traits: [] } as any,
      { name: "Old SRD Race", source: "SRD", speed: { walk: 30 }, traits: [] } as any,
    ],
    classes: [
      {
        name: "Fighter",
        source: "PHB",
        hitDie: 10,
        subclasses: [
          { name: "Champion", source: "PHB" },
          { name: "Battle Master", source: "PHB" },
          { name: "Echo Knight", source: "EGW" },
        ],
      } as any,
      {
        name: "Legacy SRD Fighter",
        source: "SRD",
        hitDie: 10,
        subclasses: [{ name: "Champion", source: "SRD" }],
      } as any,
    ],
    feats: [],
    backgrounds: [],
    items: [],
    spells: [
      { name: "Eldritch Blast", source: "PHB", level: 0, school: "V", time: "1 action", range: "120 ft", duration: "Instant" } as any,
    ],
    beasts: [],
    conditions: [],
    optionsAndFeatures: [],
    books: [],
  };

  await saveCompendiumData(mockCollections);
  assert.equal(await hasIntegratedCatalog(), true);

  // Hydrate dataService
  await hydrateCompendiumFromStorage();
  assert.equal(isCompendiumIntegrated(), true);

  // Verification of Dataset Swapping:
  // 1. SRD sources must be completely filtered out
  const activeRaces = getRaces();
  assert.equal(activeRaces.length, 2);
  assert.equal(activeRaces.some((r) => r.source === "SRD"), false, "SRD races must be disabled in memory");
  assert.ok(activeRaces.some((r) => r.name === "Tabaxi"));

  // 2. Active classes reflect integrated catalog
  const activeClasses = getClasses();
  assert.equal(activeClasses.length, 1);
  assert.equal(activeClasses[0].name, "Fighter");
  assert.equal(activeClasses[0].source, "PHB");
  assert.equal(activeClasses[0].subclasses.length, 3);

  // 3. Finding class returns integrated version
  const fighter = findClass("Fighter");
  assert.ok(fighter);
  assert.equal(fighter.subclasses.length, 3);
  assert.ok(fighter.subclasses.some((sc: any) => sc.name === "Echo Knight"));

  // Clear compendium reverts back to SRD cleanly
  await clearCompendiumData();
  assert.equal(await hasIntegratedCatalog(), false);
  await hydrateCompendiumFromStorage();
  assert.equal(isCompendiumIntegrated(), false);

  const revertedClasses = getClasses();
  assert.equal(revertedClasses.length, 12);
  assert.ok(revertedClasses.every((c) => c.source === "SRD"));

  // Restore test compendium so other test suites that follow in process have fixtures
  const { resetTestCompendium } = await import("./testUtils.ts");
  resetTestCompendium();
});

test("compendiumStorage: handles IndexedDB errors gracefully without throwing to caller", async () => {
  __setCompendiumKvForTests(undefined);
  const originalWindow = (globalThis as any).window;
  try {
    (globalThis as any).window = {
      indexedDB: {
        open: () => {
          const req: any = {};
          setTimeout(() => {
            if (req.onerror) {
              req.error = new Error("Mock IndexedDB access denied");
              req.onerror();
            }
          }, 0);
          return req;
        },
      },
    };

    // loadCompendiumData must not throw unhandled exception
    const loaded = await loadCompendiumData();
    assert.equal(loaded, null);

    // hasIntegratedCatalog must not throw
    const hasCatalog = await hasIntegratedCatalog();
    assert.equal(hasCatalog, false);
  } finally {
    (globalThis as any).window = originalWindow;
    __setCompendiumKvForTests(undefined);
  }
});

test("compendiumStorage: saves, loads, and clears large payloads via native FileSystem", async () => {
  __setCompendiumKvForTests(undefined);
  const files = new Map<string, string>();
  const mockFs = {
    documentDirectory: "file:///data/user/0/com.app/files/",
    writeAsStringAsync: async (uri: string, content: string) => {
      files.set(uri, content);
    },
    readAsStringAsync: async (uri: string) => {
      const c = files.get(uri);
      if (c === undefined) throw new Error("File not found");
      return c;
    },
    getInfoAsync: async (uri: string) => ({
      exists: files.has(uri),
    }),
    deleteAsync: async (uri: string) => {
      files.delete(uri);
    },
  };

  const { __setNativeFsForTests } = await import("../src/services/compendiumStorage.ts");
  __setNativeFsForTests(mockFs);

  try {
    assert.equal(await hasIntegratedCatalog(), false);
    const mockData: any = {
      hasIntegratedCatalog: true,
      integratedAt: "2026-10-10T09:00:00Z",
      races: [{ name: "Elf", source: "PHB" }],
      classes: [],
      feats: [],
      backgrounds: [],
      items: [],
      spells: [],
      beasts: [],
      conditions: [],
      optionsAndFeatures: [],
      books: [],
    };

    await saveCompendiumData(mockData);
    assert.equal(await hasIntegratedCatalog(), true);

    const loaded = await loadCompendiumData();
    assert.ok(loaded);
    assert.equal(loaded?.hasIntegratedCatalog, true);
    assert.equal(loaded?.races[0].name, "Elf");

    await clearCompendiumData();
    assert.equal(await hasIntegratedCatalog(), false);
    const afterClear = await loadCompendiumData();
    assert.equal(afterClear, null);
  } finally {
    __setNativeFsForTests(undefined);
    const { resetTestCompendium } = await import("./testUtils.ts");
    resetTestCompendium();
  }
});



test("compendiumStorage: saving stamps the required catalog format and loading returns it", async () => {
  const kv = new Map<string, string>();
  __setCompendiumKvForTests(kv);
  try {
    await saveCompendiumData({
      hasIntegratedCatalog: true,
      races: [],
      classes: [],
      feats: [],
      backgrounds: [],
      items: [],
      spells: [],
      beasts: [],
      conditions: [],
      optionsAndFeatures: [],
      books: [],
    });
    const loaded = await loadCompendiumData();
    assert.equal(loaded?.catalogFormat, REQUIRED_CATALOG_FORMAT);
  } finally {
    __setCompendiumKvForTests(undefined);
  }
});

test("compendiumStorage: origin rules round-trip through storage, and a catalog saved without them loads with none", async () => {
  const { createCompendium } = await import("../src/services/compendium.ts");
  const kv = new Map<string, string>();
  __setCompendiumKvForTests(kv);
  try {
    const originRules = [{ name: "Invented Origin Rule", source: "TCE", proficiencySwaps: [{ from: "tool" as const, to: ["skill" as const] }] }];
    await saveCompendiumData({ hasIntegratedCatalog: true, races: [], classes: [], originRules } as any);
    const saved = await loadCompendiumData();
    assert.deepEqual(saved?.originRules, originRules);

    kv.set("@dnd5e_integrated_compendium", JSON.stringify({ hasIntegratedCatalog: true, catalogFormat: 11, races: [], classes: [] }));
    const older = await loadCompendiumData();
    assert.equal(older?.originRules, undefined, "a catalog saved at format 11 has no origin rules");
    assert.deepEqual(createCompendium(older!).for(["TCE"]).originRules(), []);
  } finally {
    __setCompendiumKvForTests(undefined);
  }
});

test("compendiumStorage: a catalog saved without a format or below the required one loads intact and is stale", async () => {
  const { isCatalogStale } = await import("../src/services/compendiumStorage.ts");
  const kv = new Map<string, string>();
  __setCompendiumKvForTests(kv);
  try {
    const races = [{ name: "Elf", source: "PHB", speed: { walk: 30 }, traits: [] }];
    // Saved by the old app: no catalogFormat key at all.
    kv.set("@dnd5e_integrated_compendium", JSON.stringify({ hasIntegratedCatalog: true, races, classes: [] }));
    const oldApp = await loadCompendiumData();
    assert.equal(oldApp?.catalogFormat, undefined);
    assert.deepEqual(oldApp?.races, races, "a stale catalog keeps every record");
    assert.equal(isCatalogStale(oldApp!), true);

    kv.set("@dnd5e_integrated_compendium", JSON.stringify({ hasIntegratedCatalog: true, catalogFormat: REQUIRED_CATALOG_FORMAT - 1, races, classes: [] }));
    const older = await loadCompendiumData();
    assert.deepEqual(older?.races, races);
    assert.equal(isCatalogStale(older!), true);

    await saveCompendiumData({ hasIntegratedCatalog: true, races, classes: [] } as any);
    const current = await loadCompendiumData();
    assert.equal(isCatalogStale(current!), false);
    assert.equal(isCatalogStale({ hasIntegratedCatalog: false } as any), false, "the SRD Baseline is never stale");
  } finally {
    __setCompendiumKvForTests(undefined);
  }
});
