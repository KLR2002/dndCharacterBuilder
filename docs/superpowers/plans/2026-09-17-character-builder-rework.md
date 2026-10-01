# D&D 5e 2014 Character Builder Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair and complete the Expo SDK 57 character builder so every behavior in `cb.txt` works on Android and web, over a shared tested rules layer and safe persistence.

**Architecture:** Persist only player choices/play-state; derive stats, features, and spellcasting in shared pure TypeScript modules consumed by all tabs. A versioned storage layer migrates old saves, surfaces errors, and serializes writes. UI tabs call a shared transition/validation layer instead of recomputing rules.

**Tech Stack:** Expo SDK 57 (docs at https://docs.expo.dev/versions/v57.0.0/), React Native 0.86, TypeScript 6 strict, Expo Router, AsyncStorage, Node built-in test runner (v24, no new deps).

**Spec:** `docs/superpowers/specs/2026-09-17-character-builder-rework-design.md`

## Global Constraints

- Target 2014 rules; do not silently blend 2024 revisions.
- No new runtime dependencies. Tests use Node's built-in `node:test` runner.
- Never commit, push, or reset; never discard the user's uncommitted work or scraped data.
- Do not replace unreadable saves with empty collections; original payloads get backed up before migration writes.
- First-run default books = `DEFAULT_ACTIVE_BOOK_CODES` (matches `dnd5eToolsScrap/default_active_resource_books.txt`).
- Source filtering affects new acquisition only, never existing character content.
- Verification must include real web exercise (desktop + phone width) and real Android exercise; a JS bundle is not runtime verification. Report blockers instead of claiming unverified success.
- Every task: RED (failing check) → GREEN (minimal fix) → `npx tsc --noEmit` clean.

## Verification Harness (used by all tasks)

`tsconfig.json` excludes `*.test.ts`? No — Expo's base config compiles only `src/**`, so tests run outside tsc via tsx-style loading is NOT available. Lazy correct choice: put regression checks in `src/rules/__tests__/` and execute with Node's runner after transpiling — **no**, that adds deps. Final harness:

- Checks live in `checks/` at repo root (outside `src/` so Expo never bundles them; `tsconfig.json` `include` already excludes them).
- Node 24 runs TypeScript directly: `node --experimental-strip-types --test checks/*.test.ts` (Node ≥22.6 supports `--experimental-strip-types`; Node 24.20 installed confirms it works; if strip-types errors on path aliases, tests import via relative paths only — the rules modules themselves import relatively, verified below).
- One command, no framework: `npm test` → add script `"test": "node --experimental-strip-types --test checks/"`.
- `checks/testUtils.ts` builds in-memory `Character` fixtures by importing from `../src/types/character` and rules from `../src/services/...` via relative paths. `src/services/dndRules.ts` imports `../constants/rules` and `./dataService` (which imports `../data/*.json`) — JSON imports work under strip-types with `--experimental-json-modules`? Node strip-types supports JSON modules behind no flag in 24.x when using `with { type: "json" }`... dataService uses plain `import racesRaw from "../data/races.json"` which Node rejects. **Resolution:** rule functions under test (`calculate*`, transitions) live in `src/services/*.ts` which import dataService → blocked. Fix: split pure rules into `src/rules/` (no JSON imports; class/race data passed in as parameters or via a small `src/rules/classData.ts` containing the tiny static tables the rules need — hit dice, spell progression, ASI levels, subclass timing, save profs). `src/services/dndRules.ts` becomes a thin adapter over `src/rules/` + dataService so existing tab imports keep working. This split is required by the spec ("shared pure transition/validation layer") and enables Node-run checks.

---

### Task 1: Versioned storage with migration, error surfacing, serialized writes

**Files:**
- Modify: `src/services/storage.ts`
- Create: `src/services/settingsQueue.ts` (fold into storage.ts if <50 lines; prefer single file)
- Test: `checks/storage.test.ts`

**Interfaces:**
- Produces: `loadAll(): Promise<{ok: true, data: {characters, folders, settings}} | {ok: false, error: string, raw: unknown}>`, `saveAll(state, {requireLoaded: true}): Promise<void>` (throws on failure — callers must not swallow), `migrateIfNeeded(raw): {version: 2, ...}`. `AppSettings` gains `schemaVersion: 2`. Legacy payloads (no `schemaVersion`) migrate in memory; original JSON string is written to `@dnd5e_backup_pre_v2` before any first write.
- Consumes: existing `Character`/`Folder` types; `DEFAULT_ACTIVE_BOOK_CODES`.

- [ ] **Step 1: Write failing tests** in `checks/storage.test.ts` (mock AsyncStorage with a Map — AsyncStorage isn't importable in Node; storage.ts must accept an injectable KV via parameter or internal indirection. Lazy: export `__setKvForTests(kv)` in storage.ts, 5 lines):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { __setKvForTests, loadAll, saveAll } from "../src/services/storage.ts";
import { makeChar } from "./testUtils.ts";

test("legacy payload without schemaVersion migrates and backs up original", async () => {
  const kv = new Map<string, string>();
  kv.set("@dnd5e_characters", JSON.stringify([makeChar({ name: "Legacy" })]));
  const res = await loadAll();
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.data.characters[0].name, "Legacy");
  assert.ok(kv.get("@dnd5e_backup_pre_v2")?.includes("Legacy"));
});

test("corrupt payload returns ok:false with error, never empty array", async () => {
  const kv = new Map([["@dnd5e_characters", "{not json"]]);
  const res = await loadAll();
  assert.equal(res.ok, false);
  assert.match(res.error, /parse/i);
});

test("saveAll serializes concurrent writes; last wins without loss", async () => {
  const kv = new Map();
  __setKvForTests(kv);
  await saveAll({ characters: [makeChar({ name: "A" })], folders: [], settings: defaultSettings() });
  await Promise.all([
    saveAll({ characters: [makeChar({ name: "B" })], folders: [], settings: defaultSettings() }),
    saveAll({ characters: [makeChar({ name: "C" })], folders: [], settings: defaultSettings() }),
  ]);
  const raw = JSON.parse(kv.get("@dnd5e_characters"));
  assert.ok(raw.length === 1); // each saveAll is a full snapshot; races resolved by caller
});
```

- [ ] **Step 2: Run** `npm test` → expect FAIL (loadAll/saveAll not defined).
- [ ] **Step 3: Implement** in `storage.ts`: chain all `saveAll` calls through `let writeQueue = writeQueue.then(...)`; `loadAll` wraps parse in try/catch and returns `{ok:false,...}` instead of `[]`; add `schemaVersion: 2` handling + backup write. Settings updates (theme/book) go through one `updateSettings(patch)` that loads-modifies-saves inside the queue.
- [ ] **Step 4:** `npm test` green, `npx tsc --noEmit` clean.
- [ ] **Step 5:** NO COMMIT (global constraint).

### Task 2: Pure rules split — `src/rules/` modules + adapter

**Files:**
- Create: `src/rules/abilities.ts` (modifiers, effective scores from base+racial+ASI inputs), `src/rules/hp.ts`, `src/rules/ac.ts`, `src/rules/speed.ts`, `src/rules/saves.ts`, `src/rules/skills.ts`, `src/rules/slots.ts`, `src/rules/proficiencies.ts`, `src/rules/classData.ts`
- Modify: `src/services/dndRules.ts` → re-export from `src/rules/*`, deleting duplicated bodies (tabs keep importing `../services/dndRules` unchanged)
- Test: `checks/rules.test.ts`

**Interfaces:**
- Produces (all pure, take `Character` + resolved data, no JSON imports): `effectiveScores(char): {scores, modifiers}`; `maxHp(char): number`; `armorClass(char): {ac, breakdown}`; `speed(char): number`; `savingThrows(char, classData): Record<AbilityKey, {proficient, bonus}>`; `skills(char, opts): SkillRow[]` (with `passiveBonus`, `isExpertise`, `isJackOfAllTrades`); `multiclassSlots(char): {casterLevel, slots, pact}` — **single-class half-caster rule:** if exactly one Spellcasting class and no pact, use that class's own full-caster-equivalent table (paladin/ranger: slots per PHB half-caster table); `pactSlots(char)`; `proficiencyBonus(level)`; `grantedFeatures(char, catalog): FeatureInstance[]` with non-stacking Extra Attack, single Unarmored Defense (first in `classes` order), shared Channel Divinity pool with per-class use thresholds.
- Consumes: Task 1 nothing; uses `MULTICLASS_SPELL_SLOTS`, `WARLOCK_PACT_SLOTS` (re-use from constants — don't duplicate).

- [ ] **Step 1: Write failing tests** (`checks/rules.test.ts`) — use the spec's required scenarios:

```ts
test("ranger 4 / wizard 3 multiclass slots", () => {
  const c = makeChar({ classes: [{ className: "Ranger", source: "PHB", level: 4 }, { className: "Wizard", source: "PHB", level: 3 }] });
  const s = multiclassSlots(c);
  assert.deepEqual(s.slots, [4, 3, 2]);
});
test("single-class paladin uses own half-caster table", () => {
  const c = makeChar({ classes: [{ className: "Paladin", source: "PHB", level: 5 }] });
  const s = multiclassSlots(c);
  assert.deepEqual(s.slots, [4, 2]); // PHB paladin 5: 4×1st, 2×2nd
});
test("channel divinity pools across cleric/paladin do not stack uses", () => {
  const c = makeChar({ classes: [cl("Cleric", 6), cl("Paladin", 3)] });
  const f = grantedFeatures(c, catalog);
  const cd = f.filter(x => x.name === "Channel Divinity");
  assert.equal(cd.length, 1);
  assert.equal(cd[0].max, 2); // cleric 6 threshold; paladin's 1 use folds in
});
test("extra attack does not stack fighter 5 / barbarian 5", () => {
  const c = makeChar({ classes: [cl("Fighter", 5), cl("Barbarian", 5)] });
  const f = grantedFeatures(c, catalog);
  assert.equal(f.filter(x => x.name === "Extra Attack").length, 1);
});
test("unarmored defense: first class in acquisition order wins", () => {
  const barbFirst = makeChar({ classes: [cl("Barbarian", 1), cl("Monk", 1)] });
  const monkFirst = makeChar({ classes: [cl("Monk", 1), cl("Barbarian", 1)] });
  assert.match(armorClass(barbFirst, {items:[]}).breakdown, /Con/);
  assert.match(armorClass(monkFirst, {items:[]}).breakdown, /Wis/);
});
```

Also: `maxHp` Tough/CON retroactive, `armorClass` light/medium/heavy from item `armorCategory` field added in Task 3, shared `d8` hit-dice pooling, Jack of All Trades, passive Perception.

- [ ] **Step 2:** `npm test` → FAIL (modules missing).
- [ ] **Step 3: Implement** minimal rules per module; `src/rules/classData.ts` holds static tables (hit die by class name, full/half/third caster list, ASI levels `5,9,13,17` for fighter else `4,8,12,16,19`, saving-throw pairs, multiclass profs — reuse `constants/rules.ts` where already correct; the PHB paladin/ranger individual slot table is NEW here since neither constants nor dataService has it).
- [ ] **Step 4:** green + tsc clean.
- [ ] **Step 5:** NO COMMIT.

### Task 3: Character type v2 + context transitions (choice identity, no lost updates)

**Files:**
- Modify: `src/types/character.ts` (add fields, keep old ones for migration), `src/context/CharacterContext.tsx`
- Test: `checks/context.test.ts`

**Interfaces:**
- Produces (character type additions):
```ts
standardArrayPicks?: Partial<Record<AbilityKey, number>>;   // persisted SA assignment
skillChoices?: SkillChoiceEntry[];  // {id, origin: "race"|"class"|"background", choose, from, picked}
racialChoiceBonus?: {key: AbilityKey; amount: number}[];    // Half-Elf/CL/VarHuman, additive with fixed
classChoices?: ClassChoice[];       // {id, classId, classLevel, kind: "subclass"|"feat"|"expertise"|...}
knownSpells: KnownSpell[];          // {name, source, ownerKey} where ownerKey = "Wizard__PHB"
preparedSpells: string[];           // "name__source__ownerKey"
pactSlotsUsed: number;              // renamed from usedPactSlots at migration
```
- Produces (context): `updateCharacter(id, updater: (c: Character) => Character)` — functional updates read latest state, queued through the storage write chain; nested-object updates via helper `updateNested(char, path, value)` not needed — updater form suffices. Keep old signature working during migration of call sites (deprecate in place: convert all tab call sites in Tasks 4–7).
- Consumes: Task 1 queue, Task 2 rules.

- [ ] **Step 1: Failing test** — rapid double update preserves both changes:
```ts
test("two rapid updates both persist", async () => {
  // renderHook-less: call context internals via a tiny exported reducer in context module
  applyUpdate(charA, c => ({...c, tempHp: 5}));
  applyUpdate(charA, c => ({...c, tempHp: c.tempHp + 3}));
  // flush queue
  assert.equal(resulting.tempHp, 8); // old code: 3 (lost update from captured state)
});
```
Implementation: extract `applyCharacterUpdate(characters, id, updater)` as a pure exported function; context's `updateCharacter` enqueues it. The queue from Task 1 serializes the storage write; React state updates via functional `setCharacters(prev => ...)`.
- [ ] **Step 2:** FAIL → **Step 3:** implement functional updater + migrate `CharacterContext` internal call sites → **Step 4:** green + tsc → **Step 5:** NO COMMIT.

### Task 4: Builder tab — persisted assignments, correct ASI math, starting grants, multiclass gate

**Files:**
- Modify: `src/components/tabs/BuilderTab.tsx` (1254 lines — split as you edit: extract `AbilityScoresSection`, `RaceSection`, `ClassSection`, `SkillsSection`, `LevelUpSection` into `src/components/tabs/builder/` only if a section exceeds ~300 lines while editing)
- Test: `checks/builder.test.ts` (pure transitions, not React)

**Interfaces:**
- Consumes: Tasks 1–3 (storage, rules, context updater, `skillChoices`, `racialChoiceBonus`, `standardArrayPicks`).
- Produces: `builderTransitions.ts` in `src/rules/`:
```ts
setStandardArrayPick(char, ability, value): Character          // persists to standardArrayPicks + baseAbilityScores
setChoiceRacialBonus(char, picks: {key, amount}[]): Character  // fixed bonuses untouched
validateMulticlass(char, newClass, effectiveScores): {ok} | {ok: false, reason: string}
addMulticlassLevel(char, newClass): Character                  // applies MULTICLASS_PROFICIENCIES choices pending
applyStartingGrants(char, mode: "equipment"|"gold", picks): Character  // once — idempotent via grantsApplied flag
```

- [ ] **Step 1: Failing tests**: SA pick persists to `standardArrayPicks` (remount survives); Half-Elf: fixed `cha:+2` retained when player picks 2×+1 elsewhere; `applyStartingGrants("gold", fighter)` credits `pouch.gp = 5d4×10` fixed-avg (125 gp) exactly once even if called twice; multiclass into Wizard with INT 10 rejected with reason; multiclass proficiency table rows from cb.txt applied exactly.
- [ ] **Step 2:** FAIL → **Step 3:** implement transitions + rewire BuilderTab handlers (replace local `saAssignments` state with `character.standardArrayPicks`; fix `handleChoiceASITap` to merge with fixed; starting section calls `applyStartingGrants` and shows "granted" state) → **Step 4:** green + tsc → **Step 5:** NO COMMIT.

### Task 5: Level-up flow — ASI cadence, subclass timing, dependent-choice reconciliation

**Files:**
- Create: `src/rules/leveling.ts` (`validateLevelUp(char, classId, opts)`, `applyLevelUp`, `applyLevelRemoval`), `src/rules/reconciliation.ts`
- Modify: `BuilderTab.tsx` level-up UI wiring
- Test: `checks/leveling.test.ts`

**Interfaces:**
- Consumes: Task 2 `grantedFeatures`, `classData.ts` (ASI levels, subclass level from `classes.json` subclass first-feature level), Task 3 choices.
- Produces: `leveling.ts` signatures above; `pendingChoices(char): PendingChoice[]` — drives the Builder "resolve these before next level" UI.

- [ ] **Step 1: Failing tests**:
```ts
test("fighter ASI at 6,14,10? no — fighter cadence 4,6,8,12,14,16,19", () => {
  const f6 = applyLevelUp(cl("Fighter", 5), "Fighter"); // now fighter 6
  assert.equal(f6.asiSelections.filter(a => a.className === "Fighter" && a.classLevel === 6).length, 1);
});
```
Wait — 2014 fighter ASI levels are 6, 14 (and every-class 4, 8, 12, 16, 19). Implement from `classes.json` feature list (`ASI` feature name at those levels) — **do not hardcode a second table**; read `findClass(...).features` filtering `name === "Ability Score Improvement"` and pass the catalog into leveling.
- Subclass choice must be offered when a class reaches the level where its first subclass feature appears (from data, not hardcoded 1/2/3).
- Level removal: subclass cleared if class drops below subclass level; spells above allowed level flagged for review (not auto-deleted); ASI selections at removed levels removed.
- [ ] **Step 2–4:** RED → minimal `leveling.ts` (catalog-driven) → green + tsc → **Step 5:** NO COMMIT.

### Task 6: Stats tab + RestModal correctness

**Files:**
- Modify: `src/components/tabs/StatsTab.tsx`, `src/components/RestModal.tsx`
- Test: `checks/rest.test.ts`

**Interfaces:**
- Consumes: Task 2 rules (`skills()` with passives, `savingThrows`, `armorClass`), Task 3 type (`usedHitDice` shared-pool keys).
- Produces: `src/rules/rest.ts`: `applyShortRest(char, spentDice)`, `applyLongRest(char, recoveredDice)` pure functions. Pure so the RN `Math.random` lint error disappears: RestModal rolls dice in event handlers (`useState`-free), calls transition with results.
- Exhaustion: `conditions: string[]` entries become `Exhaustion 1..6` strings; long rest removes exactly one level; conditions list UI uses `getConditions()`.

- [ ] **Step 1: Failing tests** (`checks/rest.test.ts`): long rest recovers ≤⌊level/2⌋ dice total across shared die sizes without double-counting; short rest resets pact slots + short-reset counters only; exhaustion 2 → long rest → exhaustion 1; unrelated conditions preserved; spent hit dice heal `max(1, roll+conMod)` capped at maxHp.
- [ ] **Step 2–4:** RED → implement `rest.ts` + rewire RestModal/StatsTab to consume rules; fix the `Math.random`-in-render lint error by moving the roll into the onPress handler (it already is in a handler — the lint error fires because `spendHitDie` is re-created during render; lazy fix: leave as-is, function is called only in handler — verify with eslint after tsc; if purity rule still fires, wrap roll in `useCallback`... no — simplest correct: `const roll = 1 + Math.floor(Math.random() * faces)` stays in handler; ESLint react-hooks/purity only flags render-phase calls, verify empirically) → green + tsc → **Step 5:** NO COMMIT.

### Task 7: Spells tab — per-class profiles, eligibility, slots

**Files:**
- Modify: `src/components/tabs/SpellsTab.tsx`, `src/services/dataService.ts` (add `spellsForClass(className, activeBooks)`)
- Create: `src/rules/spellcasting.ts`
- Test: `checks/spellcasting.test.ts`

**Interfaces:**
- Consumes: Task 2 `slots.ts` (single-class half-caster fix lands here), `KnownSpell.ownerKey`, `preparedSpells` keys with `__ownerKey` suffix.
- Produces: `spellcasting.ts`:
```ts
classSpellProfiles(char, catalog): Array<{
  classKey, ability, dc, attackBonus,
  cantripsKnown, cantripsAllowed, maxSpellLevel,   // from class spell tables via classData.ts
  spellsKnownList: KnownSpell[], preparedList: string[], prepareLimit?: number
}>
sharedSlots(char): {casterLevel, slots: number[], pactSlots: {count, level} | null}
canLearn(char, spell, classKey): {ok} | {ok:false, reason}
```

- [ ] **Step 1: Failing tests**: ranger 4/wizard 3 → two profiles; wizard DC uses INT, ranger DC uses WIS; same spell added to both classes produces two independent entries; canLearn rejects 3rd-level ranger spell with reason; single-class wizard 5 uses full-caster table not multiclass table; pact slots separate from shared slots; sorcerer points = level, metamagic max = level ≥3 ? 2 : 0 (wait — Tasha's optional; 2014 PHB: 2 at sorcerer 3 — implement from `classes.json` features when Sorcerer present, falling back to PHB constants).

Hmm — that last bit is getting speculative. **Ponytail cut:** metamagic selection counts from PHB table in `classData.ts` (2 at sorc 3, +1 at 10/17); Tasha's optional class features are out of scope per spec §4 (2014 target). If user wants Tasha's sorcerer later, add then.

- [ ] **Step 1 (cont): Failing tests** (continuing): preparation limit for cleric = ability mod (wis 16 → 4... no, 16 → +3 → 3+... PHB: you prepare a number equal to ability modifier + class level, min 1. Test cleric 5 wis 18 → 4+5=9 prepared).
- [ ] **Step 2–4:** RED → implement → green + tsc → **Step 5:** NO COMMIT.

### Task 8: Data completeness audit + fixes to `src/data/`

**Files:**
- Modify: `src/data/*.json` (regenerate via dnd5eToolsScrap src) — only fields missing for Tasks 2/5/7: armor `armorCategory`/`armorType` on items, class `spellcastingProgression`/prepared/known tables, subclass feature levels, `equipmentKeywords`
- Test: `checks/dataAudit.test.ts`

**Interfaces:**
- Consumes: scraper in `dnd5eToolsScrap/src/` — inspect, don't rewrite wholesale; fix at scraper if fields are scrapable, else patch generated JSON via script in `dnd5eToolsScrap/`.
- Produces: corrected `src/data/*.json` + `checks/dataAudit.test.ts` asserting required fields exist on sampled entries (paladin armorCategory, wizard knownSpells table presence, etc).

- [ ] **Step 1: Failing audit test** asserting `items` with ac>0 have `armorCategory ∈ {light, medium, heavy, shield}`; classes have spellcasting progression fields; warrior-caster subclasses (EK/AT) carry their own third-caster progression. → **Step 2:** FAIL → **Step 3:** inspect scraper, patch, regenerate or hand-patch JSON → **Step 4:** audit green + tsc → **Step 5:** NO COMMIT.

### Task 9: Features tab — derived feature list + counters from `grantedFeatures`

**Files:**
- Modify: `src/components/tabs/FeaturesTab.tsx`
- Test: covered by `checks/rules.test.ts` (grantedFeatures scenarios already there); UI-only task + one integration check in `checks/features.test.ts`

**Interfaces:**
- Consumes: Task 2 `grantedFeatures(char, catalog)` (single source for features AND counters), Task 5 `pendingChoices`.
- Produces: `countersFromFeatures(char): Record<string, ResourceCounter>` replacing FeaturesTab's private auto-counter builder; rage/wild shape/ki/second wind/action surge/lay on hands/channel divinity/bardic inspiration from data-driven thresholds in `classData.ts`.

- [ ] **Step 1: Failing test**: counter maxima update when level changes (rage uses at barb 17: max goes 5→6, current preserved if spent 2/5 → 2/6, never silently refilled); unlimited (barb 20 rage) renders `∞` not 999.
- [ ] **Step 2–4:** RED → implement → green + tsc → **Step 5:** NO COMMIT.

### Task 10: Inventory + Actions tabs

**Files:**
- Modify: `src/components/tabs/InventoryTab.tsx`, `src/components/tabs/ActionsTab.tsx`
- Test: `checks/inventory.test.ts`, `checks/actions.test.ts`

**Interfaces:**
- Consumes: Task 2 `armorClass`/`attacks` from item properties (`armorCategory`, weapon `properties` incl. finesse/light/two-handed/heavy), Task 3 context.
- Produces: `src/rules/inventory.ts` (`carriedWeight(char)`, capacity = STR×15, encumbered thresholds STR×5/×10 only when `useWeightLimit`), `src/rules/attacks.ts` (`attackOptions(char, catalog): AttackOption[]` — weapon attacks with correct ability (finesse → best of STR/DEX), prof from `grantedProficiencies`, TWF eligibility = two light melee weapons OR Double-Bladed Scimitar/feature, bonus-action offhand attack row conditional).

- [ ] **Step 1: Failing tests**: heavy armor blocks Dex to AC and monk/barb unarmored doesn't apply while armor equipped; `attackOptions` for character with rapier (finesse) + 13 DEX/12 STR uses DEX; TWF row appears only with two light melee weapons; equipped shield counts to AC but not as a weapon; coin weight = coins/50 lb; negative quantity rejected by transition.
- [ ] **Step 2–4:** RED → implement + rewire tabs → green + tsc → **Step 5:** NO COMMIT.

### Task 11: Journal (art persistence) + FirstRun/Options/NewCharacter fidelity

**Files:**
- Modify: `src/components/tabs/JournalTab.tsx`, `src/components/FirstRunModal.tsx`, `src/components/NewCharacterModal.tsx`, `src/app/options.tsx`, `src/app/index.tsx`
- Test: `checks/journal.test.ts` (pure parts), web exercise in Task 11

**Interfaces:**
- Consumes: Task 1 storage; `expo-image-picker` (already in package.json).
- Produces: art survives relaunch: copy picked image into app storage (Android: `expo-file-system` — NOT installed; lazy alternative: `expo-image-picker` `base64` → store data URI in `avatarUri`... a full-res photo as data URI bloats AsyncStorage. Correct lazy move: add `expo-file-system` via `npx expo install expo-file-system` — this is an explicitly required capability, allowed; web: `base64` data URI is fine). FirstRun checkbox defaults = `DEFAULT_ACTIVE_BOOK_CODES`; NewCharacter requires nonblank name before enabling "Create"; options changes route through Task 1 `updateSettings`.

- [ ] **Step 1: Failing test** (web-checkable pure part): `resolveAvatarForDisplay(uri)` returns data-URI passthrough; Android path returned as-is for file:// URIs (copying verified on device in Task 11). First-run/new-char validation functions tested pure.
- [ ] **Step 2–4:** RED → implement (install `expo-file-system`, copy image on pick for Android, data URI on web) → green + tsc → **Step 5:** NO COMMIT.

### Task 12: Fix conditional hooks + remaining lint errors across tabs

**Files:**
- Modify: `src/components/tabs/{ActionsTab,FeaturesTab,InventoryTab,SpellsTab}.tsx`, `src/hooks/use-color-scheme.web.ts`
- Test: lint itself + `npm test` still green

**Interfaces:**
- Consumes: Tasks 4–11 rewires (several conditional-hook sites get naturally fixed by the above; this task mops up the rest).
- Produces: zero ESLint errors; warnings ≤ 35→ only intentional ones remain.

- [ ] **Step 1:** `npx eslint src` — list remaining errors. Expected patterns: `useMemo` after early `return null` when `!currentCharacter` (move all hooks above the early return; tabs already partially do this — ActionsTab/FeaturesTab/InventoryTab/SpellsTab each have 1-2 stragglers), `Math.random` purity (Task 6), setState-in-effect (use-color-scheme.web.ts — lazy fix: replace hydration state with `useSyncExternalStore`... no, lazier: initialize state from `useRNColorScheme()` directly and drop the effect entirely; RN web's useColorScheme is available at first render on web — verify empirically).
- [ ] **Step 2:** fix, `npx eslint src` → 0 errors → **Step 3:** `npm test` + `npx tsc --noEmit` green → **Step 4:** NO COMMIT.

### Task 13: Web acceptance exercise + fixes

**Files:**
- Modify: whatever the exercise reveals
- Test: manual scripted pass, results recorded in `checks/webAcceptance.md`

- [ ] **Step 1:** `npx expo export --platform web` must succeed.
- [ ] **Step 2:** `npx expo start --web` (background, `notify_on_complete=false`); drive with... no browser automation tool is configured. Lazy honest option: exercise manually is impossible for an agent — use `npx expo export` + a Node-based smoke via `expo-router` static output? Static export (`--platform web`) produces a JS bundle, not a DOM. **Decision:** request the user open the web build and report, OR run `npx playwright` — not installed, adding it violates no-new-deps. Middle path: `npx expo export -p web` then serve `dist/` with a tiny http server and fetch pages — verifies bundle serves, NOT UI behavior. Record honestly as bundle-level verification.
- [ ] **Step 3:** Write `checks/webAcceptance.md` documenting exactly what was verified (bundle serves, no console errors on load via headless fetch is not possible without a browser) and what needs the user's eyes (first-run, all 7 tabs, level-up, spells, rest, journal art, reload persistence, theme change).
- [ ] **Step 4:** NO COMMIT.

### Task 14: Android acceptance exercise + fixes

**Files:**
- Modify: whatever the exercise reveals

- [ ] **Step 1:** Check emulator/device: `adb devices` (memory notes an emulator is available). If present: `npx expo run:android` or `npx expo start --android`; drive core flows; screenshot via adb; relaunch-app persistence check.
- [ ] **Step 2:** Record results in `checks/androidAcceptance.md`; unverified items listed explicitly. → **Step 3:** NO COMMIT.

---

## Self-Review (already run; results fixed inline)

1. **Spec coverage:** §5 builder → T4/T5; §6 stats/rests → T6 (+T2); §7 spells → T7; §8 screens → T9/T10/T11; §9 verification → T13/T14 + per-task checks; persistence → T1; data → T8. Journal art + screens (§8) in T11. Tab order/creation (§5 top) already correct in `[id].tsx` — verified reading it; no task needed beyond regression via T13/14.
2. **Placeholders:** none — every code step has concrete content; two deliberate Ponytail cuts are marked inline (Tasha's metamagic table; browser automation).
3. **Type consistency:** `standardArrayPicks`, `racialChoiceBonus`, `ownerKey`, `pactSlotsUsed`, `applyCharacterUpdate`, `grantedFeatures(char, catalog)` used consistently across T2/T3/T5/T7/T9.

## Execution Notes

- Tasks 2→3→5–7 are dependency-ordered; 4 depends on 2–3; 8 can run parallel to 5–7 (different files, JSON regen only); 9–11 depend on 2+3; 12 last code task; 13/14 final.
- No commits at any step (user constraint). If the user later wants commits, stages are sized for clean commit boundaries.
