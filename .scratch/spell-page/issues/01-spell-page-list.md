# 01: Spell Page, the spell list

**What to build:**

1. Add the glossary term **Spell Page** to `GLOSSARY.md`, after **Spell Owner**: "What the Spells tab shows for one Spell Owner, together with the character's spell resources and granted spells; one rules function answers it." Avoid: spell tab state, spell view model.
2. Create `src/rules/spellPage.ts` with `spellPage(character, catalogs, ownerKey?)`. Use the `CharacterCatalogs` type the other readers use; check `evaluateCharacter`'s options. In this ticket it returns:
   - **`owners`:** one pill per class spell profile, with `ownerKey`, `label` (today's `"Cleric (WIS DC 13 / +5)"` text) and `selected`.
   - **`owner`:** the open owner: the given key, else the first. `null` when there is no class spell profile.
   - **`header`:** ability, class name, save DC, attack bonus.
   - **`prepared`:** `{ count, limit, alwaysPrepared }` when the profile has a `preparedLimit`, plus the counter text: `"3 / 5 Prepared"`, or `"3 / 5 prepared (+ 2 always prepared)"` when the always-prepared count is above 0.
   - **`listTitle` and `listSubtitle`:** today's `"CLERIC SPELLBOOK & CANTRIPS"` / `"MONK KI SPELLS"`, and the count line (~1402-1420). Keep the Monk wording; it is a class name, not rule text.
   - **`canAddSpells`:** today it is false for Monk.
   - **`levels`:** for spell levels 0 to 9, `{ level, title, rows }`, empty levels omitted.
     - `title`: `"CANTRIPS & AT-WILL"` when level 0 holds an at-will invocation, else today's level name.
     - Each row: `name`, `source`, `ownerKey`, `level`, `details`, a `subtitle` (school • casting time • source), and `badges: { label, tone: "accent" | "secondary" | "surface" }[]`.
     - Prepare control: `prepare: "toggle" | "locked" | "none"` and `prepared: boolean`.
     - `canForget`.
     - `swap: { canSwap, canReset, originalName } | null`.
   - **Rows:** move the merge from `groupedSpells` (`src/components/tabs/SpellsTab.tsx` ~254-370), with the at-will rule (Warlock, or the first profile when no Warlock). Move the badge and control rules from ~1440-1630.
     - **Always-prepared badge:** the granting feat or race when there is one (`grantedPreparedSources`, as today), else the profile's subclass name.
     - **Pact of the Tome:** the owner key test moves here, so the UI no longer names `"Warlock__Tome"`.
     - **"Any school" badge** (tone secondary): on a levelled spell whose school is not in the restricted schools that `learnableSpells` returns for this owner. Shown only when that list is non-empty.
     - **Eldritch Blast:** keep today's Agonizing Blast badge and subtitle text exactly. Ticket 03 replaces it.
3. Make `SpellsTab.tsx` read the page for the class pills, the header, the prepared card and badge, the list header and the level groups. Key the selected owner by `ownerKey` state instead of an index.
4. Delete:
   - `isEldritchKnight` and `isArcaneTrickster`
   - the Eldritch Knight and Arcane Trickster banners (~981-1010) and the restriction box in the Add Spells modal (~1644-1656)
   - the Monk Ki banner (~1011-1025)
   - `getSubclassPreparedBadgeLabel` and `getSubclassPreparedCounterSuffix`
   - `groupedSpells`

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merge 3f8f0fe (eabd0b9, dab08ef). `src/rules/spellPage.ts` (380 lines) returns owners, owner, header, prepared (with `overLimit`), list title/subtitle, `canAddSpells`, levels of rows; `SPELL_LEVEL_NAMES` shared with `SpellLearnList`. SpellsTab keys the open owner by `ownerKey`; banners, EK/AT detection, class-name badge tables and `groupedSpells` deleted. `spellPage` runs its own evaluation beside the tab's until ticket 02 moves the remaining reads. 7 tests in `checks/spellPage.test.ts`; `ONLY=Spells` green at 320 and 393; check:all passed.

- [x] `checks/spellPage.test.ts` (node:test, `makeChar()` from `checks/testUtils.ts`) covers:
  - A Cleric 3 / Wizard 3: two owners. The Cleric page shows a domain spell with a badge naming the subclass, locked, not forgettable. The Wizard page lists only Wizard spells. The prepared counter text is correct for both.
  - Choosing the Wizard by key while the Wizard is the second profile gives the Wizard page. An unknown key gives the first.
  - A Warlock with Pact of the Tome cantrips: the Tome rows carry the Pact of the Tome badge and `canForget` is false. An at-will invocation spell appears under level 0 with the `"CANTRIPS & AT-WILL"` title.
  - An Eldritch Knight (or Arcane Trickster) knowing one spell inside its schools and one outside: only the outside one has "Any school". A Wizard never has it.
  - A subclass spell that is replaceable has `swap.canSwap`; after a swap, `canReset` and `originalName`.
- [x] `grep -n "Eldritch Knight\|Arcane Trickster\|Warlock__Tome\|getSubclassPrepared" src/components/tabs/SpellsTab.tsx` prints nothing (paste it).
- [x] `npm run check:all` passes.
- [x] Scoped layout: `ONLY=Spells WIDTHS=320,393 npm run layout:check` is green (paste the summary line).
