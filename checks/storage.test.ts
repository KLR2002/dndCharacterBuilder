import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __setKvForTests, loadAll, saveAll, updateSettings, loadCharacters,
  loadFolders, loadSettings, saveCharacters, saveFolders, saveSettings,
  DEFAULT_SETTINGS, migrateIfNeeded,
} from "../src/services/storage.ts";
import { makeChar, defaultSettings } from "./testUtils.ts";

const CHARACTERS = "@dnd5e_characters";
const FOLDERS = "@dnd5e_folders";
const SETTINGS = "@dnd5e_app_settings";
const BACKUP = "@dnd5e_backup_pre_v2";
const state = (name = "A") => ({ characters: [makeChar({ name })], folders: [], settings: defaultSettings() });

test("legacy payload without schemaVersion migrates and backs up original", async () => {
  const kv = new Map<string, string>();
  kv.set("@dnd5e_characters", JSON.stringify([makeChar({ name: "Legacy" })]));
  __setKvForTests(kv);
  const res = await loadAll();
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.characters[0].name, "Legacy");
  assert.ok(kv.get("@dnd5e_backup_pre_v2")?.includes("Legacy"));
  assert.equal(kv.get(BACKUP), JSON.stringify([makeChar({ name: "Legacy" })]));
  assert.equal(JSON.parse(kv.get(SETTINGS)!).schemaVersion, 2);
});

test("corrupt payload returns ok:false with error, never empty array", async () => {
  const kv = new Map([["@dnd5e_characters", "{not json"]]);
  __setKvForTests(kv);
  const res = await loadAll();
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.error, /parse/i);
    assert.equal(res.raw, "{not json");
  }
  assert.equal("data" in res, false);
  await assert.rejects(saveAll(state()), /parse/i);
  await assert.rejects(loadCharacters(), /parse/i);
  assert.deepEqual([...kv], [[CHARACTERS, "{not json"]]);
});

test("saveAll serializes concurrent writes; last wins without loss", async () => {
  const kv = new Map<string, string>();
  __setKvForTests(kv);
  await saveAll({ characters: [makeChar({ name: "A" })], folders: [], settings: defaultSettings() });
  await Promise.all([
    saveAll({ characters: [makeChar({ name: "B" })], folders: [], settings: defaultSettings() }),
    saveAll({ characters: [makeChar({ name: "C" })], folders: [], settings: defaultSettings() }),
  ]);
  const raw = JSON.parse(kv.get("@dnd5e_characters")!);
  assert.ok(raw.length === 1);
  assert.equal(raw[0].name, "C");
  assert.deepEqual(await loadAll(), { ok: true, data: state("C") });
});

test("absent save is distinct from corrupt and returns independent defaults", async () => {
  const kv = new Map<string, string>();
  __setKvForTests(kv);
  const res = await loadAll();
  assert.deepEqual(res, { ok: true, data: { characters: [], folders: [], settings: defaultSettings() } });
  if (res.ok) res.data.settings.activeResourceBooks.length = 0;
  assert.deepEqual(await loadSettings(), defaultSettings());
  assert.equal(kv.size, 0);
});

test("migration preserves all original strings before changing any payload", async () => {
  const writes: string[] = [];
  class TrackedMap extends Map<string, string> {
    set(key: string, value: string) { writes.push(key); return super.set(key, value); }
  }
  const kv = new TrackedMap();
  const originals = {
    [CHARACTERS]: '  ' + JSON.stringify([makeChar({ notes: "Journal", items: [{ id: "i", name: "Sword", source: "PHB", quantity: 1, isEquipped: true, section: "equipped" }] })]),
    [FOLDERS]: '[ {"id":"f","name":"Party","createdAt":1} ]',
    [SETTINGS]: '{ "themeAccentId":"blue", "activeResourceBooks":["PHB"], "hasCompletedFirstRun":true }',
  };
  for (const [key, value] of Object.entries(originals)) kv.set(key, value);
  writes.length = 0;
  __setKvForTests(kv);
  const result = await loadAll();
  assert.equal(result.ok, true);
  const firstPayloadWrite = writes.findIndex(key => key in originals);
  assert.ok(firstPayloadWrite >= 0);
  assert.equal(writes[0], BACKUP);
  for (const raw of Object.values(originals)) {
    assert.ok(writes.slice(0, firstPayloadWrite).some(key => kv.get(key) === raw));
  }
  assert.deepEqual(JSON.parse(kv.get(CHARACTERS)!), JSON.parse(originals[CHARACTERS]));
  assert.deepEqual(JSON.parse(kv.get(FOLDERS)!), JSON.parse(originals[FOLDERS]));
  assert.equal((await loadSettings()).themeAccentId, "blue");
  writes.length = 0;
  await loadAll();
  assert.deepEqual(writes, []);
});

test("invalid envelopes and unsupported versions are errors without writes", async () => {
  for (const [key, raw] of [
    [CHARACTERS, '{}'], [FOLDERS, 'null'], [SETTINGS, '[]'],
    [SETTINGS, '{"schemaVersion":3}'], [SETTINGS, '{"activeResourceBooks":"PHB"}'],
    [SETTINGS, '{"hasCompletedFirstRun":"false"}'], [SETTINGS, '{"themeAccentId":8}'],
    [CHARACTERS, '[null]'], [FOLDERS, '[{"id":3}]'],
  ]) {
    const kv = new Map([[key, raw]]);
    __setKvForTests(kv);
    const res = await loadAll();
    assert.equal(res.ok, false, `${key}: ${raw}`);
    if (!res.ok) assert.equal(res.raw, raw);
    assert.deepEqual([...kv], [[key, raw]]);
  }
});

test("read failures surface; successful retry permits saving", async () => {
  let fail = true;
  class ReadFailMap extends Map<string, string> {
    get(key: string) { if (fail) throw new Error("disk unavailable"); return super.get(key); }
  }
  const kv = new ReadFailMap();
  __setKvForTests(kv);
  assert.deepEqual(await loadAll(), { ok: false, error: "disk unavailable", raw: null });
  await assert.rejects(saveAll(state()), /disk unavailable/);
  fail = false;
  assert.equal((await loadAll()).ok, true);
  await saveAll(state(), { requireLoaded: true });
});

test("backup failure never modifies original, including saves before explicit load", async () => {
  class BackupFailMap extends Map<string, string> {
    set(key: string, value: string) {
      if (key.startsWith(BACKUP)) throw new Error("backup failed");
      return super.set(key, value);
    }
  }
  const raw = JSON.stringify([makeChar({ name: "Legacy" })]);
  const kv = new BackupFailMap([[CHARACTERS, raw]]);
  __setKvForTests(kv);
  const res = await loadAll();
  assert.equal(res.ok, false);
  if (!res.ok) { assert.match(res.error, /backup failed/); assert.equal(res.raw, raw); }
  await assert.rejects(saveAll(state()), /backup failed/);
  assert.deepEqual([...kv], [[CHARACTERS, raw]]);
});

test("failed write rejects its caller but does not poison the queue", async () => {
  let fail = false;
  class WriteFailMap extends Map<string, string> {
    set(key: string, value: string) { if (fail) { fail = false; throw new Error("quota exceeded"); } return super.set(key, value); }
  }
  const kv = new WriteFailMap();
  __setKvForTests(kv);
  await saveAll(state());
  fail = true;
  await assert.rejects(saveAll(state("B")), /quota exceeded/);
  await saveAll(state("C"));
  assert.equal((await loadCharacters())[0].name, "C");
});

test("settings patches and legacy slice saves preserve unrelated updates", async () => {
  __setKvForTests(new Map());
  await saveAll(state());
  const folder = { id: "f", name: "Party", createdAt: 1 };
  await Promise.all([
    updateSettings({ themeAccentId: "blue" }),
    updateSettings({ activeResourceBooks: ["PHB"], hasCompletedFirstRun: true }),
    saveCharacters([makeChar({ name: "B" })]),
    saveFolders([folder]),
  ]);
  assert.deepEqual(await loadSettings(), { ...defaultSettings(), themeAccentId: "blue", activeResourceBooks: ["PHB"], hasCompletedFirstRun: true });
  assert.equal((await loadCharacters())[0].name, "B");
  assert.deepEqual(await loadFolders(), [folder]);
  await saveSettings(defaultSettings());
  assert.deepEqual(await loadSettings(), defaultSettings());
  assert.equal((await loadCharacters())[0].name, "B");
});

test("requireLoaded blocks unresolved initialization", async () => {
  const kv = new Map<string, string>();
  __setKvForTests(kv);
  await assert.rejects(saveAll(state(), { requireLoaded: true }), /load/i);
  assert.equal(kv.size, 0);
  await loadAll();
  await saveAll(state(), { requireLoaded: true });
});

test("fullHealOnLevelUp defaults to on, and settings saved before it existed load with it on", () => {
  assert.equal(DEFAULT_SETTINGS.fullHealOnLevelUp, true);
  for (const schemaVersion of [1, 2]) {
    const migrated = migrateIfNeeded({ characters: [], folders: [], settings: { schemaVersion, hasCompletedFirstRun: true } });
    assert.equal(migrated.settings.fullHealOnLevelUp, true);
  }
});

test("fullHealOnLevelUp keeps an explicit off and rejects a non-boolean value", () => {
  const off = migrateIfNeeded({ characters: [], folders: [], settings: { fullHealOnLevelUp: false } });
  assert.equal(off.settings.fullHealOnLevelUp, false);
  assert.throws(() => migrateIfNeeded({ characters: [], folders: [], settings: { fullHealOnLevelUp: "yes" } }), /fullHealOnLevelUp/);
});

test("catalogFormatInformed is absent in settings saved before it existed and survives a reload", async () => {
  const kv = new Map([[SETTINGS, JSON.stringify({ schemaVersion: 2, hasCompletedFirstRun: true })]]);
  __setKvForTests(kv);
  assert.equal((await loadSettings()).catalogFormatInformed, undefined);
  await updateSettings({ catalogFormatInformed: 11 });
  __setKvForTests(kv);
  assert.equal((await loadSettings()).catalogFormatInformed, 11);
  assert.equal((await loadSettings()).hasCompletedFirstRun, true);
});

test("catalogFormatInformed rejects a non-number value", () => {
  assert.throws(() => migrateIfNeeded({ characters: [], folders: [], settings: { catalogFormatInformed: "11" } }), /catalogFormatInformed/);
});
