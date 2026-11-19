# 02: Spell Page, resource cards and offers

**What to build:** Extend `spellPage` (`src/rules/spellPage.ts`) with the resource cards, built from `getSpellSlotLedger` (`src/rules/characterSpells.ts`).

- **`slots`:** the Ledger's `standardSlots` (clamped `used`/`remaining`). `null` when there are none.
- **`pactSlots`:** the Ledger's `pactSlots`.
- **`sorceryPoints`:** the Ledger's (from Sorcerer 2). The SpellsTab card shows from level 2 with only the points. The Metamagic part of the card (button, chosen list) shows from Sorcerer 3.
- **`metamagic`:** `{ allowance, chosen }` from Sorcerer 3, with allowance 2/3/4 at 3/10/17 (today ~803). `chosen` reads `chosenMetamagic`, falling back to `metamagicOptions` as today. Ticket 04 moves the write.
- **`mysticArcanum`:** the Ledger's tiers. Each tier adds `dc` and `attackBonus` from the Warlock spell profile, whichever owner is open, plus its spell's details. Today this is ~1170-1175 (the fallback that ignores bonuses).
- **`ritualBook`:** when the character has Book of Ancient Secrets: `{ maxLevel, entries }`. Also an `inscribeOffer` (eligible spells not yet inscribed, sorted, with no search). Today this is ~397-430.
- **`subclassSwapOffer(character, ownerKey, originalSpellName, catalogs)`:** a separate export, beside `spellPage` or in `subclassSpells.ts`. It returns the eligible replacements and the allowed schools. Today this is `eligibleSwaps` and `swapAllowedSchools` (~451-465).
- **`grantedCards`, `lockedCards`, `atWillCards`:** from the evaluation, as today. Return them even when there is no class spell profile, so the tab's empty-state branch also reads the page.

SpellsTab reads all of these, keeping search and filter state in the tab. Delete `multiclassSlotsResult`, the tab's sorcery maths, the tab's `mysticArcanumTiers`, `eligibleInscribeSpells`'s non-search filtering, and the `calculateMulticlassSpellSlots` import.

Add two layout scenarios in `scripts/lib/scenarios.mjs` and the fixtures `checks/fixtures/scenarioNamesSrd.json` and `scenarioNamesIntegrated.json` (follow the `Spells sorcery card` scenario):
- **`Spells sorcery points level 2`:** a Sorcerer 2. The sorcery points card is visible and has no Metamagic button.
- **`Spells mystic arcanum on another class page`:** a Warlock 11 / Wizard 1 (or another class) with an arcanum chosen and the other class's page open. The arcanum row shows the Warlock's DC.

**Blocked by:** 01

**Status:** done

**Landed:** merge 21fc024 (ef4e379, 35bf472). `spellPage` adds `profile` (the open owner's profile, for the write calls), `slots`, `pactSlots`, `sorceryPoints` (from Sorcerer 2), `metamagic` (from 3), `mysticArcanum` with the Warlock profile's `dc`/`attackBonus`, `ritualBook` with `inscribeOffer`, and the granted/locked/at-will cards; `subclassSwapOffer` is a separate export in `spellPage.ts`. SpellsTab no longer calls `evaluateCharacter` or `getSpellSlotLedger`. Finding: the Warlock profile's DC is 8 + proficiency + Charisma, the same formula as the old fallback, so the arcanum figures do not change today; the source is now the profile. New scenarios `Spells sorcery points level 2` and `Spells mystic arcanum on another class page`. `ONLY=Spells` green at 320 and 393, and integrated at 320; check:all passed.

- [x] `checks/spellPage.test.ts` adds:
  - A Sorcerer 2: `sorceryPoints.max` is 2 and `metamagic` is null. A Sorcerer 10: allowance 3.
  - A Warlock 11 / Cleric 1 with a +1 spell DC item (or another DC bonus the profile counts; say which): the arcanum `dc` equals the Warlock profile's save DC while the Cleric page is open.
  - `usedSpellSlots` above the total is clamped.
  - The inscribe offer excludes inscribed rituals and spells above `maxLevel`.
- [x] `grep -n "calculateMulticlassSpellSlots\|proficiencyBonus(\|sorcererLevel >= " src/components/tabs/SpellsTab.tsx` prints nothing (paste it).
- [x] `npm run check:all` passes.
- [x] Scoped layout: `ONLY=Spells WIDTHS=320,393 npm run layout:check` is green, including the two new scenarios (paste the summary line). Open the two new screenshots and say what they show.
