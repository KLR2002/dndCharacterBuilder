# 05: Split SpellsTab into components

**What to build:** Split `src/components/tabs/SpellsTab.tsx` into components under `src/components/spells/`, beside `SpellLearnList.tsx`:

- **`SpellRow`:** one Spell Page row, with its prepare control, badges, swap/reset and forget.
- **`SpellLevelGroups`.**
- **`SpellResourceCards`:** slots, pact slots, sorcery points and Metamagic, Mystic Arcanum.
- **`RitualBookCard`.**
- **`GrantedSpellCard`:** the innate, locked and at-will cards (today `renderInnateCard`, `renderLockedCards`, `renderAtWillInvocationsCard`).
- **The modals:** `MetamagicModal`, `SubclassSwapModal`, `InscribeRitualModal`. The Add Spells modal can stay in the tab or move; say which.

SpellsTab keeps the page call, the open owner, the modal visibility state and the handlers that call the Ledger's write functions. Props carry Spell Page data and callbacks; components do not call `useCharacter` or write the character. Move the styles with the components. The rendered output must not change: same testIDs, same text, same order.

Before splitting, remove the tab's remaining catalog reads:
- The Add Spells list (`learnableSpells` plus the known spells looked up in `getSpells`, today `pickerLearnable` / `pickerSpells`) becomes `addSpellsOffer(character, ownerKey, catalogs)` in `src/rules/spellPage.ts`, returning `{ spells, restrictedSchools, knownNames }`.
- The `findSpell` fallbacks (detail opener, swap target, ritual book rows) read the details the page rows already carry. Add `details` to ritual book entries and to the swap offer's original spell where they are missing.

Add a guard test, `checks/spellsTabComponents.test.ts` (follow `checks/builderStepComponents.test.ts`):
- `SpellsTab.tsx` and every file in `src/components/spells/` import from `src/rules/` only `spellPage.ts`, the Ledger write functions in `characterSpells.ts`, and types, and none imports `services/dataService`.
- No file in `src/components/spells/` imports `useCharacter`.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `wc -l src/components/tabs/SpellsTab.tsx src/components/spells/*.tsx` (paste it). SpellsTab is under 600 lines.
- [ ] `npm run check:all` passes.
- [ ] Scoped layout: `ONLY=Spells WIDTHS=320,393,1280 npm run layout:check` is green (paste the summary line).
