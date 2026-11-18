# Spec: One reader of spell-grant owners, one learnable-spell list per Spell Owner

**Status:** done (pending the full layout gate)

Decided with the user on 2026-11-18 (architecture review candidates 5 and 2). Builds on `.scratch/feat-slot/` and `.scratch/class-choices-view/`.

## Problem

- Which spell-granting owners a character holds (race or subrace with open gates, held feats, background) is re-derived in seven loops: `grantedSpellSources` and `grantedPreparedSpells` (`src/rules/grantedSpells.ts` ~77-86, ~146-149), `heldExpandedSources` (`src/rules/backgroundSpells.ts` ~55-72, the only one with the background), `heldGrantsOf`, `featSpellRuleChoices`, `raceSpellRuleChoices`, `pruneReleasedFeatCounters` (`src/rules/choices/featSpells.ts` ~690-720, ~957), plus the legacy High Elf cantrip migration (~1067). `heldFeatsOf` (`featSpells.ts:231`) resolves feat records its own way, beside `findFeat` (`src/rules/featIncrease.ts`).
- `newSpellsForLevelUp` (`src/rules/levelUpFlow.ts`) hides every spell known under any Spell Owner by name, so a Wizard/Sorcerer cannot learn Shield for the second class (glossary **Spell Owner**). The builder's Add Spells picker (`src/components/tabs/SpellsTab.tsx` ~451-490) builds its list separately: Fighter/Rogue read the Wizard list, Eldritch Knight and Arcane Trickster get a school filter keyed on subclass names (~231-240, ~474-480). The level-up Spells step has neither.

## Decisions

1. `heldSpellGrants(character, catalogs)` in `src/rules/spellGrants.ts` returns every held owner that grants spells (race or subrace grants whose gate is open, each held feat with its selection, the background), with its record and grants. The seven loops and the migration read it. Only owner discovery moves out of `featSpells.ts`.
2. `learnableSpells(character, profile, opts)` returns what one class Spell Owner may learn: its class list (Wizard's for Fighter and Rogue third casters), subclass and expanded lists, up to its maximum spell level, minus what that owner already knows; and the owner's restricted schools as data. Only class spellcasting owners; Pact of the Tome, Ancient Secrets and Giant Power keep their pickers.
3. One `SpellLearnList` component (search, spell-level filter, restricted-schools toggle on by default, rows) serves the builder's Add Spells modal and the Level-Up Spells step; each keeps its frame and action.
4. How many spells to learn is a separate spec (`.scratch/spell-counts/spec.md`).

## Tickets

1. `01-held-spell-grants.md`
2. `02-learnable-spells-per-owner.md`
3. `03-spell-learn-list.md`
