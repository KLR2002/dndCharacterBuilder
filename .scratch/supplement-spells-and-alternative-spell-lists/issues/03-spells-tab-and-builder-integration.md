# 03: SpellsTab and Builder UI Integration

**What to build:**
Refactor `SpellsTab.tsx` and builder spell selection components to use `isSpellAvailableForClass` and `getAvailableSpellsForClass`. Verify end-to-end in character management and sheet viewing.

**Blocked by:** 02: Pure Spell Rules Resolution Engine.

**Status:** done

- [x] In `src/components/tabs/SpellsTab.tsx`, update `filteredPickerSpells` to use `isSpellAvailableForClass(s, targetCastingClass, activeBooks)`.
- [x] In `src/components/tabs/SpellsTab.tsx`, ensure spell learning and preparation validation respects active books and alternative spell lists.
- [x] In `src/components/builder/AncestrySection.tsx`, ensure wizard cantrip selection uses `isSpellAvailableForClass(s, "Wizard", activeBooks)`.
- [x] Verify that selecting different active resource books on a character dynamically shows and hides XGE spells and TCE alternative spell lists in the Spells tab.
- [x] Run full test suite (`npm test`), type check (`npx tsc --noEmit`), and linter (`EXPO_NO_TELEMETRY=1 npm run lint`) to ensure 0 errors.
