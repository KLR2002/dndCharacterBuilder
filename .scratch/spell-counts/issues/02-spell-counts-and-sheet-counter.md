# 02: `spellCounts`, the Spells tab counter and the creation step

**What to build:**

1. **`src/rules/spellCounts.ts`** with `spellCounts(character, profile, catalogs)`. It returns `{ cantrips: { known, due } | null, spells: { known, due, kind: "known" | "spellbook" } | null }` for one class Spell Owner (`ClassSpellProfile`).
   - **`due`:** read from the owner's class record, or from its subclass record for an Eldritch Knight or Arcane Trickster (ticket 01's fields), at the class's level. `spells.kind` is `"spellbook"` when the class has `spellbookSpellsGained`, and `due` is then the sum of the gains up to the level.
   - **`known`:** the owner's own known spells, split by spell level 0 and above. Leave out:
     - Pact of the Tome (`ownerKey` `"Warlock__Tome"`, which the Warlock profile's `knownSpells` includes; see `src/rules/spellcasting.ts` ~228-233)
     - subclass and always-prepared spells
     - feat and race spells
   - A part is `null` when the record has no number for it, or when the compendium is stale (`compendium.stale`).
2. **Sheet counter.** `spellPage` (`src/rules/spellPage.ts`) adds `counts` for the open owner:
   - `{ cantrips, spells }` from `spellCounts`
   - display text, for example `"Cantrips 3/3"`, `"Spells 5/6"`, `"Spellbook 8/8"`
   - a `warn` flag: cantrips and known spells warn when not equal; a spellbook warns only when below

   SpellsTab shows the counts in the list header (beside today's subtitle) as `Badge`s, tone `danger` when `warn`, else `secondary`. Nothing is blocked.
3. **Creation step check.** `isCreationStepValid` "spells" (`src/rules/creationFlow.ts` ~206) is true only when, for the creation's class owner, every non-null count has `known === due`. A spellbook counts too, so it must equal `due` at creation. With no counts (stale catalog, or no numbers), it stays true.

**Blocked by:** 01

**Status:** done

**Landed:** merge of e41518c, e3f1183; follow-up dbb733a. `spellCounts(character, profile, catalogs?)` reads the class record through `heldClass` (subclass record for third casters), the level from the class entry; `spellPage.counts` gives `{ text, warn }` per part (`Cantrips 3/3`, `Spells 5/6`, `Spellbook 8/10`), rendered as badges under the list subtitle; `isCreationStepValid("spells")` requires every count met. Review fixes: the count matched only the owner's exact key, so a single caster's legacy spells (no key, or another book's key for the class) went uncounted; it now counts those and still leaves out feat spells and Pact of the Tome; the Wizard subtitle's "N in spellbook" no longer counts cantrips. Fixture changed: `checks/creationFlowChanges.test.ts` background-release Cleric got its 3 cantrips. Spells layout green at 320 and 393; check:all passed.

- [x] `checks/spellCounts.test.ts` (SRD compendium from ticket 01, `makeChar()`) covers:
  - A Wizard 1 with 3 cantrips and 6 spellbook spells: both met. A Wizard 3 with 8 spellbook spells: due 10, not met.
  - A Sorcerer 1 with 4 cantrips and 2 spells: met. With a feat spell added: still met.
  - A Warlock 3 with Pact of the Tome cantrips: the Tome cantrips are not counted.
  - A Cleric 1: cantrips due 3, `spells` null.
  - A Paladin: both null.
  - A Wizard 3 / Sorcerer 1: each counts by its own level.
  - A stale compendium: both null.
  - An Eldritch Knight 3, with the integrated test compendium: cantrips due 2, spells due 3.
- [x] Creation: a Wizard 1 draft with 5 spellbook spells has the Spells step incomplete; with 6, complete.
- [x] `npm run check:all` passes.
- [x] Scoped layout: `ONLY=Spells WIDTHS=320,393 npm run layout:check` green. Add a `texts` expectation for the counter to the `Builder Spells step` scenario (a Wizard). Open its screenshot at 393 and describe the counter.
