# Spec: How many spells a class learns

**Status:** ready-for-agent

Split from `.scratch/spell-sources/` (2026-11-18). Decided with the user on 2026-11-19. Builds on `.scratch/spell-page/`. ADR 0024.

## Problem

- **No counts in the Catalog.** It carries no cantrips-known, spells-known or spellbook progression. `spellcasting` holds only `ability`, `progression` and `preparedSpells` (`dnd5eToolsScrap/src/scrapers/classes.ts` ~252, `src/types/dnd5e.ts` ~189). The 5etools records have `cantripProgression`, `spellsKnownProgression` and `spellsKnownProgressionFixed` (Wizard: 6, then 2 per level), for classes and for the Eldritch Knight and Arcane Trickster subclasses.
- **No counts in either flow.**
  - The creation Spells step is the Spells tab (`src/app/build/[id].tsx` ~149), and its check returns true (`src/rules/creationFlow.ts` ~206).
  - The Level-Up Spells step accepts any number of picks (`levelUpStepComplete` "spells", `src/rules/levelUpFlow.ts` ~797), and it appears for every caster (`wantsSpellsStep` ~430).

## Decisions

1. **The Catalog carries the counts.** Class `spellcasting` gets `cantripsKnown`, `spellsKnown` and `spellbookSpellsGained`; Eldritch Knight and Arcane Trickster subclasses get `cantripsKnown` and `spellsKnown`. Each is 20 numbers, indexed by class level − 1. The Catalog Format goes to 17, and the SRD Baseline is regenerated.
2. **One counting function.** `spellCounts(character, profile, catalogs)` in `src/rules/spellCounts.ts`, per class Spell Owner, returns:
   - `cantrips: { known, due }`
   - `spells: { known, due, kind: "known" | "spellbook" }`

   Each is `null` when the Catalog has no number for it, or when the catalog is stale. Counted: the owner's own known spells only. Not counted: subclass and always-prepared spells, Pact of the Tome (saved under the Warlock with `ownerKey` `"Warlock__Tome"`), feat and race spells, Mystic Arcanum. In a multiclass, each class counts by its own level.
3. **The sheet shows the counts and blocks nothing.**
   - The Spells tab shows a counter per owner.
   - Cantrips and known spells turn red when over or under.
   - A Wizard's spellbook turns red only when below.
   - Removing a level removes no spell.
4. **Creation requires exact counts.** The creation Spells step is incomplete until every count is met exactly, including a Wizard's spellbook: 6 + 2 per level above 1. Add stays enabled; the step gate enforces.
5. **Level-up requires exact counts.**
   - The Level-Up Spells step requires exactly the new cantrips and spells: the difference between the new level and the old.
   - Once full, unpicked rows are disabled.
   - The step appears only when something is due or a replacement is allowed.
   - With a stale catalog: today's behaviour.
6. **Replacing a spell on level-up.** Bard, Ranger, Sorcerer, Warlock, Eldritch Knight and Arcane Trickster may replace one known spell when gaining a level, as an optional pick in the Level-Up Spells step: one to forget, one to learn. Cantrip Versatility is out of scope.
7. **Any-school picks are not counted.** The Eldritch Knight and Arcane Trickster any-school picks stay uncounted (ADR 0014). The school filter and the "Any school" badge stay.

## Tickets

1. `issues/01-counts-in-the-catalog.md`
2. `issues/02-spell-counts-and-sheet-counter.md`
3. `issues/03-level-up-spell-counts.md`
4. `issues/04-replace-a-spell-on-level-up.md`
