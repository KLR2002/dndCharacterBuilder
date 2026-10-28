import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import * as storage from "../src/services/storage.ts";
const { transpileModule, ModuleKind, JsxEmit } = createRequire(import.meta.url)("typescript");
import assert from "node:assert/strict";
import { inMemoryCompendium, loadTestCatalog, makeChar } from "./testUtils.ts";
import type { AdditionalSpells, BackgroundData, ClassData, FeatData, RaceData } from "../src/types/dnd5e.ts";
import type { Character } from "../src/types/character.ts";
import type { Compendium } from "../src/services/compendium.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { featSpellRuleChoices } from "../src/rules/choices/featSpells.ts";
import { pickRuleChoice } from "../src/rules/ruleChoices.ts";
import { grantedSpellClasses, grantedSpellFeats, grantedSpellSpells } from "./grantedSpellsFixture.ts";
import { reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { applyCharacterUpdate } from "../src/context/characterUpdates.ts";
import { __setKvForTests, loadCharacters, saveCharacters } from "../src/services/storage.ts";
import * as compendiumStorage from "../src/services/compendiumStorage.ts";

// Execute the real provider without RN/a renderer dependency. State updates are
// deferred until render, as in React batching; effects run only after commit.
async function providerHarness(initial: unknown = [makeChar()], options: {
  settings?: object;
  loadAll?: typeof storage.loadAll;
  waitForInit?: boolean;
  races?: any[];
  classes?: any[];
  compendium?: any;
  /** The Compendium the app reads as current (for the open-character reconcile). Defaults to a stub. */
  catalog?: any;
} = {}) {
  const kv = new Map([["@dnd5e_characters", typeof initial === "string" ? initial : JSON.stringify(initial)]]);
  if (options.settings) kv.set("@dnd5e_app_settings", JSON.stringify(options.settings));
  storage.__setKvForTests(kv);
  const slots: any[] = [];
  const setters: any[] = [];
  let cursor = 0;
  let pending: (() => void)[] = [];
  let effects: (() => void)[] = [];
  let value: any;
  // The compendium is stubbed per harness: the real process-wide default would leak into other suites.
  let integrated: any = null;
  const react = {
    createContext: () => ({ Provider: "provider" }),
    createElement: (_: unknown, props: any) => { value = props.value; },
    useContext: () => value,
    useRef: (initial: unknown) => { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState: (initial: unknown) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      setters[i] ??= (update: any) => pending.push(() => {
        slots[i] = typeof update === "function" ? update(slots[i]) : update;
      });
      return [slots[i], setters[i]];
    },
    useEffect: (effect: () => void, deps: unknown[]) => {
      const i = cursor++;
      if (!deps || !slots[i] || deps.some((dep, n) => !Object.is(dep, slots[i][n]))) effects.push(effect);
      slots[i] = deps;
    },
    useCallback: (callback: (...args: unknown[]) => unknown) => {
      const i = cursor++;
      slots[i] ??= { callback };
      return slots[i].callback;
    },
  };
  const exports: any = {};
  const source = readFileSync(new URL("../src/context/CharacterContext.tsx", import.meta.url), "utf8");
  const js = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.React, esModuleInterop: true } }).outputText;
  runInNewContext(js, { exports, console, require: (name: string) => {
    if (name === "react") return react;
    if (name.includes("compendiumStorage")) return {
      ...compendiumStorage,
      hasIntegratedCatalog: async () => false,
      loadCompendiumData: async () => options.compendium ?? null,
      clearCompendiumData: async () => {},
    };
    if (name.includes("runner")) return {
      runInAppIntegration: async () => ({
        hasIntegratedCatalog: true,
        catalogFormat: compendiumStorage.REQUIRED_CATALOG_FORMAT,
        integratedAt: new Date().toISOString(),
      }),
    };
    if (name.includes("storage")) return { ...storage, loadAll: options.loadAll ?? storage.loadAll };
    if (name.includes("characterUpdates")) return { applyCharacterUpdate };
    if (name.includes("migrateCharacter")) return { migrateCharacter };
    if (name.includes("characterReconciler")) return { reconcileForActiveBooks };
    if (name.includes("dataService")) return {
      getRaces: () => options.races ?? [],
      getClasses: () => options.classes ?? [],
    };
    if (name.endsWith("services/compendium")) return {
      integrate: (bundle: any) => { integrated = bundle; },
      revertToSrd: () => { integrated = null; },
      currentCompendium: () => options.catalog ?? { stale: integrated ? compendiumStorage.isCatalogStale(integrated) : false },
    };
    if (name.includes("constants/books")) return { DEFAULT_ACTIVE_BOOK_CODES: [] };
    if (name.includes("builderTransitions")) return { checkActiveBooksIntegrity: () => [] };
    throw new Error(`Unexpected provider import: ${name}`);
  } });
  function commit() {
    const updates = pending; pending = []; updates.forEach(update => update());
    cursor = 0; exports.CharacterProvider({ children: null });
  }
  function flushEffects() {
    const committed = effects; effects = []; committed.forEach(effect => effect());
  }
  function render() { commit(); flushEffects(); }
  commit();
  const mountEffects = [...effects];
  flushEffects();
  if (options.waitForInit !== false) {
    await storage.loadAll(); // Wait for initialization's queued read.
    render();
  }
  return { get value() { return value; }, render, commit, flushEffects, kv,
    replayMountEffects: () => mountEffects.forEach(effect => effect()) };
}

test("provider exposes catalogStale for a stale loaded catalog, and a successful re-sync clears it", async () => {
  try {
    const stale = await providerHarness([], { compendium: { hasIntegratedCatalog: true, races: [], classes: [] } });
    assert.equal(stale.value.isIntegrated, true, "a stale catalog is still loaded");
    assert.equal(stale.value.catalogStale, true);

    const current = await providerHarness([], { compendium: { hasIntegratedCatalog: true, catalogFormat: compendiumStorage.REQUIRED_CATALOG_FORMAT, races: [], classes: [] } });
    assert.equal(current.value.catalogStale, false);

    const srd = await providerHarness([], { compendium: null });
    assert.equal(srd.value.isIntegrated, false);
    assert.equal(srd.value.catalogStale, false, "the SRD Baseline is never stale");

    const resync = await providerHarness([], { compendium: { hasIntegratedCatalog: true, races: [], classes: [] } });
    assert.equal(resync.value.catalogStale, true);
    // The sync's state updates are queued until a render; its settings write is not awaited here.
    resync.value.triggerIntegration();
    await new Promise(resolve => setImmediate(resolve));
    resync.render();
    assert.equal(resync.value.catalogStale, false);
  } finally {
    // Nothing to restore: the compendium is stubbed per harness.
  }
});

test("provider uses latest state, migrates loaded records and persists rapid updates", async () => {
  const h = await providerHarness([makeChar({ knownSpells: [{ name: "Light", source: "PHB", className: "" }] })]);
  assert.equal(h.value.characters[0].knownSpells[0].ownerKey, "unknown__unknown");
  const first = h.value.updateCharacter("char_test", (c: Character) => ({ ...c, tempHp: 5 }));
  const second = h.value.updateCharacter("char_test", (c: Character) => ({ ...c, tempHp: c.tempHp + 3 }));
  h.render();
  await Promise.all([first, second]);
  assert.equal(h.value.characters[0].tempHp, 8);
  assert.equal((await storage.loadCharacters())[0].tempHp, 8);
});

test("provider deleteCharacter/createFolder and old partial updates still work after refactor", async () => {
  const h = await providerHarness();
  const update = h.value.updateCharacter("char_test", { notes: "retained" });
  const folderA = h.value.createFolder(" First ");
  const folderB = h.value.createFolder("Second");
  h.render();
  const [, first] = await Promise.all([update, folderA, folderB]);
  assert.equal(h.value.folders.length, 2);
  assert.equal(first.name, "First");
  assert.equal(h.value.characters[0].notes, "retained");
  const move = h.value.moveCharacterToFolder("char_test", first.id);
  h.render(); await move;
  const removeFolder = h.value.deleteFolder(first.id);
  h.render(); await removeFolder;
  assert.equal(h.value.characters[0].folderId, null);
  assert.equal((await storage.loadCharacters())[0].folderId, null);
  const remove = h.value.deleteCharacter("char_test");
  h.render(); await remove;
  assert.equal(h.value.characters.length, 0);
  assert.equal((await storage.loadCharacters()).length, 0);
  assert.equal((await storage.loadFolders()).length, 1);
  const createA = h.value.createCharacter({ name: " New Hero " });
  const createB = h.value.createCharacter({ name: "Another Hero" });
  h.render();
  const [created] = await Promise.all([createA, createB]);
  assert.equal(created.name, "New Hero");
  assert.equal(created.pactSlotsUsed, 0);
  assert.equal(h.value.characters.length, 2);
  assert.equal((await storage.loadCharacters()).length, 2);
});

test("an update committed after the last save is persisted before its promise resolves", { timeout: 3000 }, async () => {
  const h = await providerHarness();
  // A renders+commits; its persistence effect has not flushed yet.
  const a = h.value.updateCharacter("char_test", { notes: "first" });
  h.commit();
  // Update B is queued in the commit/effect gap, before A's effect runs.
  let bResolved = false;
  const b = h.value.updateCharacter("char_test", { notes: "second" }).then(() => { bResolved = true; });
  h.flushEffects();
  await a;
  // A's save may resolve while B is still queued; B must wait for its own disk write.
  if (bResolved) {
    assert.equal(JSON.parse(h.kv.get("@dnd5e_characters")!)[0].notes, "second",
      "B was acknowledged before its data reached disk");
  }
  assert.equal(bResolved, false, "B must remain pending until its snapshot is saved");
  assert.equal(JSON.parse(h.kv.get("@dnd5e_characters")!)[0].notes, "first");
  h.render();
  await b;
  assert.equal(JSON.parse(h.kv.get("@dnd5e_characters")!)[0].notes, "second");
});

test("a failed folder snapshot does not reject an uncommitted folder mutation", { timeout: 3000 }, async () => {
  const h = await providerHarness();
  const set = h.kv.set.bind(h.kv);
  h.kv.set = () => { throw new Error("disk full"); };
  const a = h.value.createFolder("First");
  const rejected = assert.rejects(a, /disk full/);
  h.commit();
  let bSettled = false;
  const b = h.value.createFolder("Second");
  void b.then(() => { bSettled = true; }, () => { bSettled = true; });
  h.flushEffects();
  await rejected;
  assert.equal(bSettled, false, "A's failure must not settle B");
  h.kv.set = set;
  h.render();
  await b;
  assert.deepEqual((await storage.loadFolders()).map(folder => folder.name), ["First", "Second"]);
});

test("no-op collection mutations settle and later edits survive acknowledgement cleanup", { timeout: 3000 }, async () => {
  const h = await providerHarness();
  const noop = h.value.updateCharacter("missing", (c: Character) => c);
  const remove = h.value.deleteFolder("missing");
  h.render();
  await Promise.all([noop, remove]);
  h.render(); // Apply acknowledgement cleanup without another write.
  const edit = h.value.updateCharacter("char_test", { notes: "after cleanup" });
  const folder = h.value.createFolder("After cleanup");
  h.render();
  await Promise.all([edit, folder]);
  assert.equal((await storage.loadCharacters())[0].notes, "after cleanup");
  assert.equal((await storage.loadFolders())[0].name, "After cleanup");
});

test("provider mutation rejects failed storage writes and a later edit can retry", async () => {
  const h = await providerHarness();
  const set = h.kv.set.bind(h.kv);
  h.kv.set = () => { throw new Error("disk full"); };
  const update = h.value.updateCharacter("char_test", { notes: "not yet saved" });
  const rejected = assert.rejects(update, /disk full/);
  h.render(); await rejected;
  h.kv.set = set;
  const retry = h.value.updateCharacter("char_test", (c: Character) => c);
  h.render(); await retry;
  assert.equal((await storage.loadCharacters())[0].notes, "not yet saved");
});

test("failed init exposes initError and retryInitialization loads characters, settings and unblocks edits", async () => {
  const h = await providerHarness("not json"); // corrupt kv: first loadAll returns ok:false
  assert.equal(h.value.isLoading, false);
  assert.equal(typeof h.value.initError, "string");
  assert.ok(h.value.initError!.includes("@dnd5e_characters"));
  await assert.rejects(h.value.updateCharacter("x", { notes: "blocked" }), /Load characters successfully/);
  const retry = h.value.retryInitialization();
  h.kv.set("@dnd5e_characters", JSON.stringify([makeChar({ notes: "recovered" })]));
  h.kv.set("@dnd5e_app_settings", JSON.stringify({
    schemaVersion: 2, hasCompletedFirstRun: true, activeResourceBooks: ["XPHB"],
  }));
  h.render(); await retry; h.render();
  assert.equal(h.value.initError, null);
  assert.equal(h.value.characters[0].notes, "recovered");
  assert.deepEqual(h.value.activeBooks, ["XPHB"]);
  assert.equal(h.value.hasCompletedFirstRun, true);
  assert.equal(h.value.isLoading, false);
  const edit = h.value.updateCharacter("char_test", { notes: "edited" });
  h.render(); await edit;
  assert.equal((await storage.loadCharacters())[0].notes, "edited");
});

test("retry after success preserves a queued edit and ignores external KV changes", { timeout: 3000 }, async () => {
  const h = await providerHarness();
  const edit = h.value.updateCharacter("char_test", { notes: "unsaved edit" });
  await h.value.retryInitialization();
  h.render(); await edit;
  assert.equal(h.value.characters[0].notes, "unsaved edit");
  assert.equal((await storage.loadCharacters())[0].notes, "unsaved edit");
  const charactersBefore = h.value.characters;
  h.kv.set("@dnd5e_characters", JSON.stringify([makeChar({ notes: "external" })]));
  const retry = h.value.retryInitialization();
  h.render();
  assert.equal(h.value.isLoading, false);
  await retry; h.render();
  assert.equal(h.value.characters, charactersBefore);
  assert.equal(h.value.initError, null);
  assert.equal(JSON.parse(h.kv.get("@dnd5e_characters")!)[0].notes, "external");
});

test("failed migration leaves settings and originals unchanged through retries until repair", { timeout: 3000 }, async () => {
  const settings = { schemaVersion: 2, hasCompletedFirstRun: false, activeResourceBooks: ["XPHB"] };
  const rawCharacters = JSON.stringify([{ ...makeChar(), classes: "bad" }]);
  const originals = [["@dnd5e_characters", rawCharacters], ["@dnd5e_app_settings", JSON.stringify(settings)]];
  const h = await providerHarness(rawCharacters, { settings });
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.match(h.value.initError, /Invalid character: classes must be an array/);
    assert.equal(h.value.isLoading, false);
    assert.equal(h.value.characters.length, 0);
    assert.equal(h.value.folders.length, 0);
    assert.equal(h.value.activeBooks.length, 0); // Harness provider default, not loaded XPHB.
    assert.equal(h.value.hasCompletedFirstRun, true);
    await assert.rejects(h.value.updateCharacter("char_test", { notes: "blocked" }), /Load characters successfully/);
    assert.deepEqual([...h.kv], originals);
    if (attempt === 0) {
      const retry = h.value.retryInitialization();
      h.render();
      assert.equal(h.value.isLoading, true);
      assert.equal(h.value.initError, null);
      await retry; h.render();
    }
  }
  h.kv.set("@dnd5e_characters", JSON.stringify([makeChar({ notes: "repaired" })]));
  await h.value.retryInitialization(); h.render();
  assert.equal(h.value.initError, null);
  assert.equal(h.value.isLoading, false);
  assert.deepEqual(h.value.activeBooks, ["XPHB"]);
  assert.equal(h.value.hasCompletedFirstRun, false);
  assert.equal(h.value.characters[0].notes, "repaired");
  const edit = h.value.updateCharacter("char_test", { notes: "after repair" });
  h.render(); await edit;
  assert.equal((await storage.loadCharacters())[0].notes, "after repair");
});

test("mount replay and concurrent retries share initialization before later edits", { timeout: 3000 }, async () => {
  const releases: (() => void)[] = [];
  let reads = 0;
  const h = await providerHarness(undefined, {
    waitForInit: false,
    loadAll: async () => {
      reads++;
      const snapshot = await storage.loadAll();
      await new Promise<void>(resolve => releases.push(resolve));
      return snapshot;
    },
  });
  h.replayMountEffects(); // Strict Mode's repeated mount effect.
  const first = h.value.retryInitialization();
  const second = h.value.retryInitialization();
  h.render();
  assert.equal(h.value.isLoading, true);
  await assert.rejects(h.value.updateCharacter("char_test", { notes: "blocked" }), /Load characters successfully/);
  await storage.loadAll(); // All started reads have captured their snapshots.
  assert.equal(reads, 1, "mount/replay/retries must not start competing reads");
  releases.forEach(release => release());
  await Promise.all([first, second]); h.render();
  assert.equal(h.value.isLoading, false);
  assert.equal(h.value.initError, null);
  const edit = h.value.updateCharacter("char_test", { notes: "after shared init" });
  h.render(); await edit;
  h.replayMountEffects();
  await h.value.retryInitialization(); h.render();
  assert.equal(reads, 1);
  assert.equal(h.value.characters[0].notes, "after shared init");
  assert.equal((await storage.loadCharacters())[0].notes, "after shared init");
});

test("two rapid updates both persist", async () => {
  const charA = makeChar();
  let characters = [charA];
  let resulting = charA;
  const writes: Promise<void>[] = [];
  __setKvForTests(new Map());
  const applyUpdate = (character: Character, updater: (c: Character) => Character) => {
    characters = applyCharacterUpdate(characters, character.id, updater);
    resulting = characters[0];
    writes.push(saveCharacters(characters));
  };
  // renderHook-less: call context internals via a tiny exported reducer in context module
  applyUpdate(charA, c => ({...c, tempHp: 5}));
  applyUpdate(charA, c => ({...c, tempHp: c.tempHp + 3}));
  // flush queue
  await Promise.all(writes);
  assert.equal(resulting.tempHp, 8); // old code: 3 (lost update from captured state)
  assert.equal((await loadCharacters())[0].tempHp, 8);
});

test("updater applied twice in the same tick preserves nested changes and other characters", () => {
  const charA = makeChar();
  const charB = makeChar({ id: "other" });
  const original = [charA, charB];
  const increment = (c: Character) => ({ ...c, pouch: { ...c.pouch, gp: c.pouch.gp + 1 } });
  const first = applyCharacterUpdate(original, charA.id, increment);
  const second = applyCharacterUpdate(first, charA.id, increment);
  assert.equal(second[0].pouch.gp, 2);
  assert.equal(original[0].pouch.gp, 0);
  assert.equal(second[1], charB);
  assert.deepEqual(applyCharacterUpdate(original, "missing", increment), original);
});

test("legacy spells gain the first spellcasting owner without losing legacy or unknown fields", () => {
  const raw = { ...makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 1 }, { className: "Wizard", source: "PHB", level: 2 }],
    knownSpells: [{ name: "Shield", source: "PHB", className: "Wizard" }],
    preparedSpells: ["Shield__PHB", "Bless__PHB__Cleric__PHB"], usedPactSlots: 2,
  }), customField: { retained: true } };
  const before = structuredClone(raw);
  const migrated = migrateCharacter(raw);
  assert.equal(migrated.knownSpells?.[0].ownerKey, "Wizard__PHB");
  assert.equal(migrated.knownSpells?.[0].className, "Wizard");
  assert.deepEqual(migrated.preparedSpells, ["Shield__PHB__Wizard__PHB", "Bless__PHB__Cleric__PHB"]);
  assert.equal(migrated.pactSlotsUsed, 2);
  assert.equal(migrated.usedPactSlots, 2);
  assert.deepEqual((migrated as typeof raw).customField, raw.customField);
  assert.deepEqual(migrated.standardArrayPicks, {});
  assert.deepEqual(migrated.racialChoiceBonus, []);
  assert.deepEqual(migrated.classChoices, []);
  assert.deepEqual(raw, before);
  assert.deepEqual(migrateCharacter(migrated), migrated);
});

test("spell migration preserves explicit owners and pact usage; no caster uses unknown owner", () => {
  const migrated = migrateCharacter(makeChar({
    knownSpells: [{ name: "Light", source: "PHB", ownerKey: "Cleric__PHB" }, { name: "Shield", source: "PHB", className: "" }],
    preparedSpells: ["Shield__PHB"], pactSlotsUsed: 0, usedPactSlots: 2,
  }));
  assert.equal(migrated.knownSpells?.[0].ownerKey, "Cleric__PHB");
  assert.equal(migrated.knownSpells?.[1].ownerKey, "unknown__unknown");
  assert.deepEqual(migrated.preparedSpells, ["Shield__PHB__unknown__unknown"]);
  assert.equal(migrated.pactSlotsUsed, 0);
  assert.deepEqual(migrateCharacter(makeChar({ knownSpells: undefined, preparedSpells: undefined })).knownSpells, []);
});

test("single-source legacy skill choices gain stable ownership", () => {
  for (const [source, origin, id] of [
    [{ classes: [{ className: "Wizard", source: "PHB", level: 1 }] }, "class", "class__Wizard__PHB__skills"],
    [{ background: { name: "Custom", source: "PHB" } }, "background", "background__Custom__PHB__skills"],
  ] as const) {
    const migrated = migrateCharacter({ ...makeChar(), ...source, chosenSkills: ["Arcana", "History"] });
    assert.deepEqual(migrated.skillChoices, [{ id, origin, choose: 2, from: ["Arcana", "History"], picked: ["Arcana", "History"] }]);
    assert.deepEqual(migrated.chosenSkills, ["Arcana", "History"]);
    assert.deepEqual(migrateCharacter(migrated), migrated);
  }
});

test("ambiguous legacy skills are preserved and flagged, not assigned an invented owner", () => {
  const classes = [{ className: "Wizard", source: "PHB", level: 1 }, { className: "Rogue", source: "PHB", level: 1 }];
  for (const source of [{ classes }, { classes: classes.slice(0, 1), background: { name: "Sage", source: "PHB" } }, {}]) {
    const migrated = migrateCharacter({ ...makeChar(), ...source, chosenSkills: ["Arcana"], needsReview: ["existing warning"] });
    assert.deepEqual(migrated.chosenSkills, ["Arcana"]);
    assert.deepEqual(migrated.skillChoices, []);
    assert.ok(migrated.needsReview?.includes("Some skill picks could not be matched to a class or background. Check them in the Builder."));
    assert.ok(migrated.needsReview?.includes("existing warning"));
    assert.deepEqual(migrateCharacter(migrated), migrated);
  }
});

test("explicit v2 choices are preserved instead of re-inferred", () => {
  const skillChoices = [{ id: "existing", origin: "race", choose: 1, from: ["Arcana"], picked: ["Arcana"] }];
  const raw = { ...makeChar(), chosenSkills: ["Arcana"], skillChoices, standardArrayPicks: { str: 15 }, racialChoiceBonus: [{ key: "con", amount: 1 }], classChoices: [{ id: "feat", classId: "Wizard__PHB", classLevel: 4, kind: "asi", asi: { int: 2 } }] };
  const migrated = migrateCharacter(raw);
  for (const key of ["skillChoices", "standardArrayPicks", "racialChoiceBonus", "classChoices"] as const) assert.deepEqual(migrated[key], raw[key]);
  assert.equal(migrated.needsReview, undefined);
});

test("malformed character records are rejected, not silently replaced", () => {
  for (const raw of [null, [], "broken", { ...makeChar(), knownSpells: "bad" }, { ...makeChar(), preparedSpells: [3] }, { ...makeChar(), classes: null }]) {
    assert.throws(() => migrateCharacter(raw), /Invalid character/);
  }
});

// --- Expertise follows the active books for the open character ---

// Invented background from a sourcebook that can be disabled. Its skill is granted by that book alone.
const classes = loadTestCatalog<ClassData[]>("classes");
const SMUGGLER: BackgroundData = {
  name: "Test Smuggler", source: "TST", skillProficiencies: ["Investigation"], toolProficiencies: [],
  grants: [{ id: "TST/Background/Test Smuggler@0#0", kind: "fixed", category: "skills", names: ["Investigation"] }],
  languages: [], startingEquipment: [], feature: null, characteristics: {}, description: "",
};
const booksCatalog = () => inMemoryCompendium({ classes, backgrounds: [SMUGGLER] }, { integrated: true });
const BOOKS_PHB = { schemaVersion: 2, hasCompletedFirstRun: true, activeResourceBooks: ["PHB"] };
const BOOKS_PHB_TST = { schemaVersion: 2, hasCompletedFirstRun: true, activeResourceBooks: ["PHB", "TST"] };

const rogueWithSmugglerMark = (id: string, expertise: string[]) => makeChar({
  id,
  background: { name: SMUGGLER.name, source: "TST" },
  classes: [{ className: "Rogue", level: 1, source: "PHB" }],
  chosenSkills: ["Stealth"],
  chosenExpertise: expertise,
});

// Lets queued state updates and their saves settle, as the app does between renders.
async function settle(h: { render: () => void }) {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    h.render();
  }
}

test("opening a character releases an Expertise mark only a disabled book grants, and saves the change", { timeout: 3000 }, async () => {
  const h = await providerHarness([rogueWithSmugglerMark("char_a", ["Investigation", "Stealth"])], {
    settings: BOOKS_PHB,
    catalog: booksCatalog(),
  });
  assert.deepEqual(h.value.characters[0].chosenExpertise, ["Investigation", "Stealth"], "nothing changes before the character is opened");
  h.value.selectCharacter("char_a");
  h.render();
  await settle(h);
  assert.deepEqual(h.value.characters[0].chosenExpertise, ["Stealth"]);
  assert.ok(h.value.characters[0].needsReview?.includes("Investigation Expertise removed: Investigation is no longer a proficient skill or tool"));
  assert.deepEqual(JSON.parse(h.kv.get("@dnd5e_characters")!)[0].chosenExpertise, ["Stealth"]);
});

test("opening a character that already fits the active books saves nothing", { timeout: 3000 }, async () => {
  const h = await providerHarness([rogueWithSmugglerMark("char_b", ["Stealth"])], {
    settings: BOOKS_PHB,
    catalog: booksCatalog(),
  });
  const before = h.value.characters[0];
  const set = h.kv.set.bind(h.kv);
  let writes = 0;
  h.kv.set = (key: string, value: string) => { writes++; return set(key, value); };
  h.value.selectCharacter("char_b");
  h.render();
  await settle(h);
  assert.equal(writes, 0, "no save for a character the books do not change");
  assert.strictEqual(h.value.characters[0], before);
});

test("changing the active books reconciles only the open character; a restored book does not bring the mark back", { timeout: 3000 }, async () => {
  const h = await providerHarness([
    rogueWithSmugglerMark("char_a", ["Investigation", "Stealth"]),
    rogueWithSmugglerMark("char_b", ["Investigation", "Stealth"]),
  ], { settings: BOOKS_PHB_TST, catalog: booksCatalog() });
  h.value.selectCharacter("char_a");
  h.render();
  await settle(h);
  assert.deepEqual(h.value.characters[0].chosenExpertise, ["Investigation", "Stealth"], "TST is still active, so the mark stays");

  void h.value.setActiveBooks(["PHB"]);
  await settle(h);
  assert.deepEqual(h.value.characters[0].chosenExpertise, ["Stealth"], "the open character is reconciled");
  assert.deepEqual(h.value.characters[1].chosenExpertise, ["Investigation", "Stealth"], "the unopened character waits until it is opened");

  h.value.selectCharacter("char_b");
  h.render();
  await settle(h);
  assert.deepEqual(h.value.characters[1].chosenExpertise, ["Stealth"]);

  void h.value.setActiveBooks(["PHB", "TST"]);
  await settle(h);
  assert.deepEqual(h.value.characters[0].chosenExpertise, ["Stealth"], "re-enabling the book does not restore the mark");
  assert.deepEqual(h.value.characters[1].chosenExpertise, ["Stealth"], "re-enabling the book does not restore the mark");
});

// --- The books the app opens with decide the records the load and the open character read (CharacterContext) ---

const SETTINGS_ALT_ONLY = { schemaVersion: 2, hasCompletedFirstRun: true, activeResourceBooks: ["ALT"] };
const SETTINGS_TST_ONLY = { schemaVersion: 2, hasCompletedFirstRun: true, activeResourceBooks: ["TST"] };

const giftedRace = (source: string, additionalSpells?: AdditionalSpells[]): RaceData => ({
  name: "Sample Gifted",
  source,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces: [],
  description: "Placeholder description for the race.",
  ...(additionalSpells ? { additionalSpells } : {}),
});

test("the books the app opens with decide the record a legacy racial cantrip is checked against, on load", { timeout: 3000 }, async () => {
  const cantrip: AdditionalSpells[] = [{ ability: "int", known: { "1": { _: [{ choose: "level=0|class=Sample Mage" }] } } }];
  const saved = makeChar({
    classes: [{ className: "Wizard", source: "PHB", level: 1 }],
    race: { name: "Sample Gifted", source: "OLD" },
    ruleChoices: [
      { id: "PHB__Elf__PHB__High Elf__Cantrip", trait: "Cantrip", origin: "race", choose: 1, from: ["Sample Shot"], picked: ["Sample Shot"] },
    ],
  });
  const h = await providerHarness([saved], {
    settings: SETTINGS_ALT_ONLY,
    races: [giftedRace("TST", cantrip), giftedRace("ALT")],
    classes,
  });
  const loaded: Character = h.value.characters[0];
  assert.equal(loaded.ruleChoices?.some((entry) => entry.picked.includes("Sample Shot")), false, "the active book's record grants no cantrip, so none is kept");
  assert.ok(loaded.needsReview?.some((notice) => notice.startsWith("Sample Shot removed")), "the cantrip is released with a notice");
});

/** The character with Sample Ember picked from Sample Initiate's Mage list, with the books given on. */
function pickEmberFromInitiate(character: Character, compendium: Compendium, books: string[]): Character {
  const offer = (current: Character, option: string): Character => {
    const choice = featSpellRuleChoices(current, compendium, books).find((candidate) => candidate.options.some((o) => o.name === option));
    assert.ok(choice, `${option} is offered by the origin feat`);
    return pickRuleChoice(current, choice, option, compendium, books);
  };
  return offer(offer(character, "Sample Mage Spells"), "Sample Ember");
}

test("opening a character whose switched-off book held a feat's spell pick releases the pick, with a notice, through the provider", { timeout: 3000 }, async () => {
  const initiate: FeatData = { ...(grantedSpellFeats().find((feat) => feat.name === "Sample Initiate") as FeatData), source: "ALT" };
  const compendium = inMemoryCompendium({ classes: grantedSpellClasses(), spells: grantedSpellSpells(), feats: [initiate] }, { integrated: true });
  const saved = pickEmberFromInitiate(
    makeChar({
      classes: [{ className: "Sample Mage", source: "TST", level: 4 }],
      originFeats: [{ level: 1, type: "feat", featName: "Sample Initiate", featSource: "ALT" }],
    }),
    compendium,
    ["TST", "ALT"],
  );
  const h = await providerHarness([saved], { settings: SETTINGS_TST_ONLY, catalog: compendium });
  const stored: Character = h.value.characters[0];
  assert.ok(stored.ruleChoices?.some((entry) => entry.picked.includes("Sample Ember")), "saved with the pick");

  h.value.selectCharacter("char_test");
  h.render();
  await settle(h);
  const opened: Character = h.value.characters[0];
  assert.equal(opened.ruleChoices?.some((entry) => entry.picked.includes("Sample Ember")), false, "the pick is released on opening");
  assert.ok(
    opened.needsReview?.includes("Sample Ember removed from Sample Initiate: book switched off"),
    `the release is noticed: ${JSON.stringify(opened.needsReview)}`,
  );
});
