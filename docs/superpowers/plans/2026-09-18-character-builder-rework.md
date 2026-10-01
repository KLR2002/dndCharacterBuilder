# D&D 5e 2014 Character Builder Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair and complete the Expo SDK 57 / React Native character builder on Android and web so all tasks and rules in `cb.txt` work reliably without hook violations or lint errors.

**Architecture:** Pure TypeScript rule modules under `src/rules/` (`builderTransitions.ts`, `leveling.ts`, `spellcasting.ts`, `rest.ts`, `attacks.ts`) with unit tests in `checks/`. UI tabs call pure transitions and derived calculators. All React hooks moved to component tops before early returns.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, TypeScript 6 strict, Expo Router, AsyncStorage, Node built-in test runner (`node --experimental-strip-types --test`).

**Spec:** `docs/superpowers/specs/2026-09-18-character-builder-rework-design.md`

## Global Constraints

- Target 2014 rules strictly; do not blend 2024 revisions.
- No new runtime dependencies. Tests use Node's built-in `node:test` runner.
- Never commit, push, or reset; never discard the user's uncommitted work or scraped data.
- Fix all 19 ESLint errors (no conditional hooks, no impure functions in render, no bad effect setState).
- Every rule step follows RED (failing check) → GREEN (pass) → `npx tsc --noEmit` clean.

---

### Task 1: Complete `src/rules/builderTransitions.ts` & Tests

**Files:**
- Modify: `src/rules/builderTransitions.ts`
- Create: `checks/builderTransitions.test.ts`

**Interfaces:**
- Produces:
  - `setChoiceRacialBonus(character: Character, picks: { key: AbilityKey; amount: number }[]): Character`
  - `validateMulticlass(character: Character, targetClassName: string, effectiveScores: Record<AbilityKey, number>): { ok: boolean; reason?: string }`
  - `addMulticlassLevel(character: Character, className: string, source: string): Character`
  - `applyStartingGrants(character: Character, mode: "gold" | "equipment", options?: { goldAmount?: number; equipmentItems?: InventoryItem[] }): Character`
  - `setCustomBackground(character: Character, name: string, skills: string[]): Character`

- [ ] **Step 1: Write failing tests** in `checks/builderTransitions.test.ts`:
  - Test choice racial bonuses preserve fixed racial bonuses.
  - Test multiclass validation requires prerequisites for both existing classes and new class (e.g. Paladin 13 STR and 13 CHA).
  - Test `addMulticlassLevel` awards multiclass proficiencies.
  - Test `applyStartingGrants` is idempotent (sets `startingGrantsApplied: true`).
  - Test `setCustomBackground` sets background and chosen skills.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL (missing transition exports)

- [ ] **Step 3: Implement minimal code in `src/rules/builderTransitions.ts`**
  Implement the 5 functions cleanly without React or DOM dependencies.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS

- [ ] **Step 5: Verify types**
  Run: `npx tsc --noEmit`
  Expected: 0 errors

---

### Task 2: Level-Up Logic `src/rules/leveling.ts` & Tests

**Files:**
- Create: `src/rules/leveling.ts`
- Create: `checks/leveling.test.ts`

**Interfaces:**
- Produces:
  - `getPendingLevelChoices(character: Character, classDataCatalog?: any[]): { pendingAsi: { className: string; classLevel: number }[]; pendingSubclasses: { className: string; classLevel: number }[] }`
  - `applyAsiSelection(character: Character, selection: AsiSelection): Character`
  - `removeAsiSelection(character: Character, className: string, classLevel: number): Character`

- [ ] **Step 1: Write failing tests** in `checks/leveling.test.ts`:
  - Test Fighter gets ASI at 4, 6, 8, 12, 14, 16, 19.
  - Test Rogue gets ASI at 4, 8, 10, 12, 16, 19.
  - Test other classes get ASI at 4, 8, 12, 16, 19.
  - Test `applyAsiSelection` adds to `character.asiSelections`.
  - Test `getPendingLevelChoices` accurately flags missing ASI or subclass selections.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL

- [ ] **Step 3: Implement minimal code in `src/rules/leveling.ts`**
  Implement `getPendingLevelChoices`, `applyAsiSelection`, `removeAsiSelection`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS

- [ ] **Step 5: Verify types**
  Run: `npx tsc --noEmit`
  Expected: 0 errors

---

### Task 3: Spellcasting Rules `src/rules/spellcasting.ts` & Tests

**Files:**
- Create: `src/rules/spellcasting.ts`
- Create: `checks/spellcasting.test.ts`

**Interfaces:**
- Produces:
  - `getClassSpellProfiles(character: Character): ClassSpellProfile[]`
    where `ClassSpellProfile = { className: string; source: string; level: number; ability: AbilityKey; spellSaveDc: number; spellAttackBonus: number; maxSpellLevel: number; preparedLimit?: number; knownSpells: KnownSpell[]; preparedSpells: string[] }`
  - `calculateWarlockPactSlots(character: Character): { count: number; level: number } | null`

- [ ] **Step 1: Write failing tests** in `checks/spellcasting.test.ts`:
  - Test Wizard 3 / Ranger 4 generates two separate spell profiles (Wizard INT DC and Ranger WIS DC).
  - Test max spell level is computed based on individual class level (Wizard 3 -> 2nd level spells, Ranger 4 -> 1st level spells).
  - Test Warlock pact slots are separated from regular spell slots.
  - Test Cleric/Druid/Wizard preparation limit formula: ability mod + level (min 1).

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL

- [ ] **Step 3: Implement minimal code in `src/rules/spellcasting.ts`**
  Implement profile generation and pact slot calculation.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS

- [ ] **Step 5: Verify types**
  Run: `npx tsc --noEmit`
  Expected: 0 errors

---

### Task 4: Rest Rules `src/rules/rest.ts` & Tests

**Files:**
- Create: `src/rules/rest.ts`
- Create: `checks/rest.test.ts`

**Interfaces:**
- Produces:
  - `applyShortRest(character: Character, healedHp: number, spentDice: Record<string, number>): Character`
  - `applyLongRest(character: Character): Character`

- [x] **Step 1: Write failing tests** in `checks/rest.test.ts`:
  - Test short rest resets pact slots and `short` reset counters.
  - Test long rest restores HP to max, clears temp HP.
  - Test long rest recovers at most `floor(totalLevel / 2)` (min 1) hit dice.
  - Test long rest reduces Exhaustion condition level by 1.

- [x] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL

- [x] **Step 3: Implement minimal code in `src/rules/rest.ts`**
  Implement `applyShortRest` and `applyLongRest`.

- [x] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS

- [x] **Step 5: Verify types**
  Run: `npx tsc --noEmit`
  Expected: 0 errors

---

### Task 5: Attack Calculation `src/rules/attacks.ts` & Tests

**Files:**
- Create: `src/rules/attacks.ts`
- Create: `checks/attacks.test.ts`

**Interfaces:**
- Produces:
  - `getWeaponAttacks(character: Character): WeaponAttackOption[]`
  - `checkDualWielding(character: Character): { isDualWielding: boolean; mainHand?: WeaponAttackOption; offHand?: WeaponAttackOption }`

- [x] **Step 1: Write failing tests** in `checks/attacks.test.ts`:
  - Test finesse weapon uses higher of STR or DEX modifier.
  - Test ranged weapon uses DEX modifier.
  - Test proficiency bonus added to attack roll if proficient with weapon.
  - Test two light melee weapons equipped triggers `isDualWielding: true`.

- [x] **Step 2: Run test to verify it fails**
  Run: `npm test`
  Expected: FAIL

- [x] **Step 3: Implement minimal code in `src/rules/attacks.ts`**
  Implement weapon attack extraction and dual wielding check.

- [x] **Step 4: Run test to verify it passes**
  Run: `npm test`
  Expected: PASS

- [x] **Step 5: Verify types**
  Run: `npx tsc --noEmit`
  Expected: 0 errors

---

### Task 6: Eliminate All 19 ESLint Errors & Hook Violations

**Files:**
- Modify: `src/hooks/use-color-scheme.web.ts`
- Modify: `src/components/RestModal.tsx`
- Modify: `src/components/tabs/InventoryTab.tsx`
- Modify: `src/components/tabs/FeaturesTab.tsx`
- Modify: `src/components/tabs/ActionsTab.tsx`
- Modify: `src/components/tabs/SpellsTab.tsx`

- [x] **Step 1: Fix `use-color-scheme.web.ts`**
  Remove synchronous `setState` in `useEffect`. Read `useRNColorScheme()` directly.

- [x] **Step 2: Fix `RestModal.tsx`**
  Delegate rest state updates to `src/rules/rest.ts`. Remove impure `Math.random` from render.

- [x] **Step 3: Fix `InventoryTab.tsx`**
  Move all hooks (`useMemo`) above the `if (!currentCharacter) return null;` early return.
  Extract random ID generator to an external pure helper.

- [x] **Step 4: Fix `FeaturesTab.tsx`**
  Move all hooks (`useMemo`) above the `if (!currentCharacter) return null;` early return.

- [x] **Step 5: Fix `ActionsTab.tsx`**
  Move all hooks (`useMemo`) above the `if (!currentCharacter) return null;` early return.

- [x] **Step 6: Fix `SpellsTab.tsx`**
  Move all hooks (`useMemo`) above the `if (!currentCharacter) return null;` early return.

- [x] **Step 7: Run ESLint**
  Run: `npm run lint`
  Expected: 0 errors.

---

### Task 7: BuilderTab UI Wiring (ASI/Feat, Custom BG, Starting Gear, Multiclass Gate)

**Files:**
- Modify: `src/components/tabs/BuilderTab.tsx`

- [x] **Step 1: Custom Background UI**
  Add option to choose "Custom Background", enter custom name, and select 2 skill proficiencies.

- [x] **Step 2: Level-up ASI / Feat UI**
  When character classes reach an ASI level, display an interactive card allowing player to choose:
  - Ability Score Improvement (+2 to one stat or +1 to two stats)
  - Feat (picker modal/dropdown from `feats.json`)
  - Save choice to `character.asiSelections`.

- [x] **Step 3: Starting Equipment & Gold UI**
  Implement action buttons that actually deposit starting gold to `character.pouch` or add starting class equipment to `character.items`.

- [x] **Step 4: Multiclass Gate Enforcement**
  Use `validateMulticlass`. If prerequisites not met, disable "+1 Lvl" / "Add Class" button and display error.

- [x] **Step 5: Test & Verify**
  Run: `npm test && npx tsc --noEmit && npm run lint`
  Expected: PASS

---

### Task 8: SpellsTab UI Wiring (Multiclass Profiles, Warlock Slots, Metamagic)

**Files:**
- Modify: `src/components/tabs/SpellsTab.tsx`

- [x] **Step 1: Multiclass Spell Profiles**
  Use `getClassSpellProfiles(character)`. If character has multiple casting classes, render selector/tabs so the player sees the exact Spell Save DC, Spell Attack Bonus, and Spell List for each class.

- [x] **Step 2: Warlock Pact Slots**
  Display separate Pact Magic slot counter that tracks used pact slots and resets on short rest.

- [x] **Step 3: Sorcerer Metamagic**
  If Sorcerer level ≥ 3, render Sorcery Points counter and allow selecting up to 2 Metamagic options.

- [x] **Step 4: Test & Verify**
  Run: `npm test && npx tsc --noEmit && npm run lint`
  Expected: PASS

---

### Task 9: StatsTab, FeaturesTab, ActionsTab, JournalTab UI Wiring

**Files:**
- Modify: `src/components/tabs/StatsTab.tsx`
- Modify: `src/components/tabs/FeaturesTab.tsx`
- Modify: `src/components/tabs/ActionsTab.tsx`
- Modify: `src/components/tabs/JournalTab.tsx`

- [ ] **Step 1: StatsTab Proficiencies**
  Import `proficiencies` from `src/rules/proficiencies.ts` to compute full combined armor, weapon, and tool proficiencies.

- [ ] **Step 2: FeaturesTab Unified Channel Divinity**
  Unify Channel Divinity into single shared counter with maximum based on highest class threshold. Render `∞` for Barbarian 20 rage.

- [ ] **Step 3: ActionsTab Weapon Attacks**
  Wire `getWeaponAttacks` and `checkDualWielding` from `src/rules/attacks.ts`. Render weapon attack bonus, damage formula, and offhand bonus attack if dual-wielding.

- [ ] **Step 4: JournalTab Editable Name**
  Add TextInput for character name in Journal tab so the player can edit character name anytime.

- [ ] **Step 5: Test & Verify**
  Run: `npm test && npx tsc --noEmit && npm run lint`
  Expected: PASS

---

### Task 10: Complete Verification & Web Export

**Files:**
- Read / verify whole project

- [ ] **Step 1: Run all unit tests**
  Run: `npm test`
  Expected: All tests pass (≥65 tests).

- [ ] **Step 2: Run TypeScript check**
  Run: `npx tsc --noEmit`
  Expected: 0 errors.

- [ ] **Step 3: Run ESLint**
  Run: `npm run lint`
  Expected: 0 errors.

- [ ] **Step 4: Export web bundle**
  Run: `npx expo export --platform web`
  Expected: Success without runtime bundle failures.
