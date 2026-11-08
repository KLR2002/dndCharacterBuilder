import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { __setKvForTests, loadAll } from "../src/services/storage.ts";
import { __setCompendiumKvForTests, loadCompendiumData, type CompendiumCollections } from "../src/services/compendiumStorage.ts";
import { E2E_SEED_FILE_NAME, __setE2eSeedFsForTests, importE2eSeed, parseE2eSeed } from "../src/services/e2eSeedImport.ts";
import { runE2eSeedHook } from "../src/services/e2eSeedHook.ts";
import { makeChar, defaultSettings } from "./testUtils.ts";

const SEED_DIR = "file:///data/user/0/com.anonymous.dnd5e2014CharacterBuilder/files/";
const SEED_URI = `${SEED_DIR}${E2E_SEED_FILE_NAME}`;
const CHARACTERS_KEY = "@dnd5e_characters";
const FOLDERS_KEY = "@dnd5e_folders";
const SETTINGS_KEY = "@dnd5e_app_settings";
const COMPENDIUM_KEY = "@dnd5e_integrated_compendium";

function makeFs(files: Map<string, string>) {
  return {
    documentDirectory: SEED_DIR,
    getInfoAsync: async (uri: string) => ({ exists: files.has(uri) }),
    readAsStringAsync: async (uri: string) => {
      const content = files.get(uri);
      if (content === undefined) throw new Error("ENOENT");
      return content;
    },
    writeAsStringAsync: async (uri: string, content: string) => { files.set(uri, content); },
    deleteAsync: async (uri: string) => { files.delete(uri); },
  };
}

function inventedIntegrated(): CompendiumCollections {
  return {
    hasIntegratedCatalog: true,
    integratedAt: "2026-03-04T05:06:07Z",
    races: [{ name: "Bramfolk", source: "TST", speed: { walk: 30 }, traits: [] } as any],
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
}

function inventedSeed(overrides: Record<string, unknown> = {}) {
  return {
    characters: [makeChar({ id: "char_seed_1", name: "Vex Thornhollow", createdAt: 11, updatedAt: 12 })],
    folders: [{ id: "fold_seed_1", name: "Hollow Road Crew", createdAt: 13 }],
    settings: { ...defaultSettings(), hasCompletedFirstRun: true, themeAccentId: "teal" },
    integrated: null as CompendiumCollections | null,
    ...overrides,
  };
}

let savedFlag: string | undefined;

beforeEach(() => { savedFlag = process.env.EXPO_PUBLIC_E2E; });

afterEach(() => {
  if (savedFlag === undefined) delete process.env.EXPO_PUBLIC_E2E;
  else process.env.EXPO_PUBLIC_E2E = savedFlag;
  __setKvForTests(new Map());
  __setCompendiumKvForTests(undefined);
  __setE2eSeedFsForTests(undefined);
});

function setup(files: Map<string, string>) {
  const kv = new Map<string, string>();
  const compKv = new Map<string, string>();
  __setKvForTests(kv);
  __setCompendiumKvForTests(compKv);
  __setE2eSeedFsForTests(makeFs(files));
  return { kv, compKv };
}

async function emptyAppState() {
  return { ok: true as const, data: { characters: [], folders: [], settings: defaultSettings() } };
}

test("without the flag the hook imports nothing and leaves the seed file untouched", async () => {
  const files = new Map([[SEED_URI, JSON.stringify(inventedSeed({ integrated: inventedIntegrated() }))]]);
  const { kv, compKv } = setup(files);
  delete process.env.EXPO_PUBLIC_E2E;

  await runE2eSeedHook();

  assert.equal(files.has(SEED_URI), true, "the seed file must be untouched without the flag");
  assert.equal(kv.size, 0, "nothing is written to app storage");
  assert.equal(compKv.size, 0, "nothing is written to the catalog");
  assert.deepEqual(await loadAll(), await emptyAppState());
  assert.equal(await loadCompendiumData(), null);
});

test("with the flag, a valid seed is saved through the app's writers and the file is deleted", async () => {
  const seed = inventedSeed({ integrated: inventedIntegrated() });
  const files = new Map([[SEED_URI, JSON.stringify(seed)]]);
  const { kv, compKv } = setup(files);
  process.env.EXPO_PUBLIC_E2E = "1";

  await runE2eSeedHook();

  assert.equal(files.has(SEED_URI), false, "the seed file is deleted after import");
  assert.ok(kv.has(CHARACTERS_KEY) && kv.has(FOLDERS_KEY) && kv.has(SETTINGS_KEY), "written through storage.ts keys");
  assert.ok(compKv.has(COMPENDIUM_KEY), "the catalog went through saveCompendiumData");
  assert.equal(files.size, 0, "the catalog is not written as a file in the test KV seam");

  const loaded = await loadAll();
  assert.ok(loaded.ok);
  assert.deepEqual(loaded.data.characters, seed.characters);
  assert.deepEqual(loaded.data.folders, seed.folders);
  assert.equal(loaded.data.settings.themeAccentId, "teal");
  assert.equal(loaded.data.settings.hasCompletedFirstRun, true);
  assert.deepEqual(loaded.data.settings.activeResourceBooks, defaultSettings().activeResourceBooks);

  const comp = await loadCompendiumData();
  assert.equal(comp?.hasIntegratedCatalog, true);
  assert.deepEqual(comp?.races, inventedIntegrated().races);
});

test("with the flag, a seed whose integrated is null leaves the catalog empty", async () => {
  const seed = inventedSeed();
  const files = new Map([[SEED_URI, JSON.stringify(seed)]]);
  const { kv, compKv } = setup(files);
  process.env.EXPO_PUBLIC_E2E = "1";

  await runE2eSeedHook();

  assert.equal(files.has(SEED_URI), false);
  assert.equal(compKv.size, 0, "no catalog is written when integrated is null");
  assert.equal(await loadCompendiumData(), null);
  const loaded = await loadAll();
  assert.ok(loaded.ok);
  assert.deepEqual(loaded.data.characters, seed.characters);
  assert.deepEqual(loaded.data.folders, seed.folders);
  assert.ok(kv.has(CHARACTERS_KEY));
});

test("broken seeds write nothing, start empty, and are still deleted", async () => {
  const broken: [string, string][] = [
    ["not valid JSON", "{not json"],
    ["missing settings key", JSON.stringify((() => { const s = inventedSeed() as any; delete s.settings; return s; })())],
    ["missing integrated key", JSON.stringify((() => { const s = inventedSeed() as any; delete s.integrated; return s; })())],
    ["missing characters key", JSON.stringify((() => { const s = inventedSeed() as any; delete s.characters; return s; })())],
    ["integrated of the wrong type", JSON.stringify(inventedSeed({ integrated: 42 }))],
    ["integrated without its collections", JSON.stringify(inventedSeed({ integrated: { hasIntegratedCatalog: true } }))],
    ["characters the migration rejects", JSON.stringify(inventedSeed({ characters: [{ name: "No Id" }] }))],
  ];
  for (const [label, raw] of broken) {
    const files = new Map([[SEED_URI, raw]]);
    const { kv, compKv } = setup(files);
    process.env.EXPO_PUBLIC_E2E = "1";

    await runE2eSeedHook();

    assert.equal(files.has(SEED_URI), false, `${label}: the seed file is deleted`);
    assert.equal(kv.size, 0, `${label}: nothing is written to app storage`);
    assert.equal(compKv.size, 0, `${label}: nothing is written to the catalog`);
    assert.deepEqual(await loadAll(), await emptyAppState(), `${label}: the app starts with empty state`);
    assert.equal(await loadCompendiumData(), null, `${label}: no catalog`);
  }
});

test("importer: no seed file present is a no-op", async () => {
  const files = new Map<string, string>();
  const { kv, compKv } = setup(files);

  assert.equal(await importE2eSeed(), false);

  assert.equal(kv.size, 0);
  assert.equal(compKv.size, 0);
  assert.deepEqual(await loadAll(), await emptyAppState());
});

test("importer: a seed file that cannot be read leaves no partial state and is not deleted", async () => {
  const files = new Map([[SEED_URI, JSON.stringify(inventedSeed())]]);
  const { kv, compKv } = setup(files);
  const fs = makeFs(files);
  fs.readAsStringAsync = async () => { throw new Error("disk unavailable"); };
  __setE2eSeedFsForTests(fs);

  assert.equal(await importE2eSeed(), false);

  assert.equal(kv.size, 0, "nothing is written");
  assert.equal(compKv.size, 0, "nothing is written");
  assert.equal(files.has(SEED_URI), true, "a seed that cannot be read is left alone");
  assert.deepEqual(await loadAll(), await emptyAppState());
});

test("importer: parseE2eSeed validates the envelope before any write", () => {
  assert.equal(parseE2eSeed("nope"), null);
  assert.equal(parseE2eSeed("null"), null);
  assert.equal(parseE2eSeed("[]"), null);
  const seed = inventedSeed();
  assert.deepEqual(parseE2eSeed(JSON.stringify(seed))?.characters, seed.characters);
  assert.equal(parseE2eSeed(JSON.stringify(inventedSeed({ integrated: inventedIntegrated() })))?.integrated?.hasIntegratedCatalog, true);
});
