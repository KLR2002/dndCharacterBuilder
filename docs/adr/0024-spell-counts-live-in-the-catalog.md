# 0024 Spell Counts Live in the Catalog

## Context
The class and subclass records state how many cantrips and spells a caster learns at each class level: `cantripProgression` and `spellsKnownProgression` for the classes and the Eldritch Knight and Arcane Trickster subclasses, and `spellsKnownProgressionFixed` for the spells a Wizard adds to its spellbook. The scraper dropped all three. Neither the Creation Flow nor the Level-Up Flow said how many spells to learn, and either one accepted any number.

## Decision
- The Catalog states the counts as data. A class's spellcasting gives `cantripsKnown`, `spellsKnown` and `spellbookSpellsGained`, one number per class level. An Eldritch Knight or Arcane Trickster subclass gives `cantripsKnown` and `spellsKnown`. The Catalog Format is raised. No count table lives in `src/`.
- Only spells a class learns through its own Spellcasting count toward it. Subclass and always-prepared spells, Pact of the Tome, feat and race spells, and Mystic Arcanum do not count. In a multiclass, each class counts by its own level.
- The Creation Flow and the Level-Up Flow require exactly the cantrips and spells due. The character sheet shows the counts but blocks nothing, because a table may rule otherwise and a Wizard may copy spells into its spellbook. A Wizard's spellbook count is a minimum on the sheet. Removing a class level removes no spell.
- With a stale catalog, no count is shown and nothing is required.
- The Eldritch Knight and Arcane Trickster picks from any school (one each at 3rd, 8th, 14th and 20th level) are not counted. That table comes from a non-SRD book and the records do not state it as data (ADR 0014).

## Considered Options
Writing the counts for the SRD classes in code was rejected: the integrated classes would still need the Catalog, and two sources would disagree. Blocking Add on the sheet was rejected for the reasons above. Parsing the any-school milestones from the feature text was rejected as fragile.
