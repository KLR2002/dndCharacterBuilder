# 03: One spell list component for the builder and the Level-Up Flow

**What to build:** Create `src/components/spells/SpellLearnList.tsx`: search, spell-level filter, the restricted-schools toggle (shown only when `learnableSpells` reports restricted schools; on by default: cantrips and the restricted schools shown; off: all), and the spell rows with their selected state; props are the learnable list, the selected names, `onToggle(spell)`, and optional `onViewDetail`. The builder's Add Spells modal (`src/components/tabs/SpellsTab.tsx` ~1688, list from `filteredPickerSpells` ~451-490 and its level/school filter state) and the Level-Up Spells step (`src/components/levelUpFlow/SpellsStep.tsx`) render it; each keeps its frame and its action (learn now; add to the plan). `SpellsTab` gets the list from `learnableSpells` (ticket 02), and its `isEldritchKnight` / `isArcaneTrickster` checks (~231-240) and the Fighter/Rogue → Wizard swap go if nothing else uses them. Keep existing labels, testIDs and accessibility labels; the Level-Up rows keep `Learn ${spell.name}`.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `grep -n "isEldritchKnight\|isArcaneTrickster\|\"Abjuration\"\|\"Evocation\"" src/components/tabs/SpellsTab.tsx` lists nothing, or only uses unrelated to learning (say which).
- [ ] Layout: the builder's spell picker scenarios and `ONLY="Level-Up"` (including `Level-Up Flow subclass picks spells`) at 320, 393 and 1280 with `-- --integrated`; open the Eldritch Knight Spells step screenshot and describe the filter.
- [ ] `npm run check:all` passes. Last ticket: `npm run check:live` too; the main session runs the full layout gate.
