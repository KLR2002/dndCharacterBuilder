# Spec: The Spellbook Ledger's read side, one Spell Page

**Status:** ready-for-agent

Decided with the user on 2026-11-19 (architecture review candidate 1). Builds on `.scratch/spell-sources/`.

## Problem

`src/components/tabs/SpellsTab.tsx` (2100 lines) derives rules inline:

- It merges the open Spell Owner's known, always-prepared, subclass and at-will invocation spells into level groups (`groupedSpells`, ~254-370). It also decides each row's badges and its prepare, forget and swap controls (~1435-1630), and it reads Pact of the Tome by the `"Warlock__Tome"` owner key.
- It recomputes slots (`calculateMulticlassSpellSlots`, ~235) and Mystic Arcanum tiers (~431) although `getSpellSlotLedger` (`src/rules/characterSpells.ts`) returns both.
- It gates sorcery points at Sorcerer 3 together with Metamagic (~799). The Ledger and the rules (Font of Magic) start them at 2.
- It builds the Agonizing Blast text in five places. With negative Charisma that reads "1d10 + -1"; `getEldritchBlastDamage` (`src/rules/attacks.ts:594`) already formats it correctly.
- When another class's page is open, the Mystic Arcanum DC and attack bonus are recomputed from plain Charisma and proficiency (~1173), so spell DC and attack bonuses are missed.
- The Metamagic allowance (2/3/4 at Sorcerer 3/10/17) exists only in the tab. Picks are written to two fields (`metamagicOptions`, `chosenMetamagic`), and nothing releases extra picks after a level is lost.
- It carries non-SRD rule text: the Eldritch Knight and Arcane Trickster banners, in the tab and in the Add Spells modal (ADR 0014). It also has a Monk Ki banner that only repeats the header figures, and two tables that switch on class names for the always-prepared badge and counter.

## Decisions

1. `spellPage(character, catalogs, ownerKey?)` in `src/rules/spellPage.ts` returns everything the Spells tab shows:
   - the class pills
   - the open owner's header figures and prepared counter
   - the level groups of rows (display-ready badges, prepare control, forget, swap and reset)
   - the resource cards: standard slots, pact slots, sorcery points, Metamagic, Mystic Arcanum, ritual book
   - the granted, locked and at-will cards

   It takes the owner's key, not a list index, and falls back to the first owner. Glossary: **Spell Page**, the one reader of the Spells tab.
2. Sorcery points show from Sorcerer 2, Metamagic from 3. The Mystic Arcanum DC and attack bonus always come from the Warlock owner. Slot counters read the Ledger's clamped values.
3. Every Eldritch Blast line reads one formula. `spellDetailText(spell, character)` builds the detail modal's text, with the Eldritch Blast damage line.
4. Metamagic:
   - A Ledger transition picks or drops an option within the allowance.
   - The Reconciler releases picks over the allowance with a review notice.
   - `chosenMetamagic` is the one saved field; `metamagicOptions` is merged into it on load.
   - Metamagic stays a pick on the sheet, not a Level-Up Flow choice.
5. UI copy:
   - The Eldritch Knight, Arcane Trickster and Monk Ki banners go.
   - The school badges become one "Any school" badge on spells outside the owner's restricted schools, which `learnableSpells` already returns.
   - An always-prepared subclass spell's badge names the subclass, as feat and race grants already name theirs. The counter reads "(+ N always prepared)".
6. The Ritual Book inscribe offer and the subclass-swap offer (the lists before search) move to the Ledger's read side. Search stays in the tab.
7. SpellsTab splits into components last. A guard test checks that the Spells tab components read rules only through `spellPage`, `spellDetailText` and the Ledger's write functions.

## Tickets

1. `01-spell-page-list.md`
2. `02-spell-page-resources.md`
3. `03-one-eldritch-blast-formula.md`
4. `04-metamagic-in-the-ledger.md`
5. `05-split-spells-tab.md`
