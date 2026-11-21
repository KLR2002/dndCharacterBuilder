# Spec: How many spells a class learns

**Status:** needs-triage

Split from `.scratch/spell-sources/` (2026-11-18). Neither the builder nor the Level-Up Flow says how many cantrips or spells a class learns at a level: the Catalog carries no cantrips-known, spells-known or spellbook progression (`src/data/classes.json` `spellcasting` holds only `ability`, `progression` and `preparedSpells`), and the Level-Up Spells step accepts any number of picks (`levelUpStepComplete` "spells" returns true).

To decide: whether the scraper reads 5etools' `cantripProgression`, `spellsKnownProgression`, `spellsKnownProgressionFixed` (the Wizard's two spellbook spells per level) and subclass equivalents (third casters), with a Catalog Format bump; what the builder shows ("learn N" per owner, over/under notices) and whether it enforces; whether the Level-Up Spells step requires exactly N; how swaps (replace one known spell on level-up) fit; how Eldritch Knight and Arcane Trickster's unrestricted-school picks are counted.
