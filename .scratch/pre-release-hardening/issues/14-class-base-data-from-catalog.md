# 14: Class base data from the Catalog class

**What to build:** A class's saving throws, hit die, caster kind and spell ability are read from the Catalog class the character holds (by name and source), and the name-keyed constant tables for them are removed once nothing reads them. Hit points, hit dice, spell slots and spellcasting stay identical for every existing character.

**Blocked by:** 08

**Status:** done

**Landed:** merged from `pr/14-class-base-data` (37c9c51). `check:all` passes (1035 app tests, 106 scraper tests, 323 known type errors none new). Saves, hit die, caster kind and spell ability come from the held Catalog class (name and source, SRD Baseline fallback, existing source-less fallback); `CLASS_DATA` and `ClassRules` are deleted. The saving-throw baseline was re-recorded: 72 rows are integrated Artificer scenarios where Constitution and Intelligence are now proficient (the old table had no Artificer); 102 rows are saves the sheet already added through grants (Monk Diamond Soul, Rogue Wisdom), now recorded as baseline rows, so the allowlist is empty (it has no recorder variable; emptied as the test's own rule requires). HP, hit dice, spell slots and spellcasting profiles are identical across 3,810 old-vs-new cases. Open items: UA Mystic gains Int/Wis saves with no baseline scenario; `classBaseProficiencies` still lists active-books classes while saves/hit die/caster kind resolve across all books; `checks/monkKiSpells.test.ts` fails when run alone (also at the base commit).

- [x] Saves, hit die, caster kind and spell ability come from the held Catalog class, with the existing fallback for a saved class that has no source.
- [x] The name-keyed tables for them are deleted.
- [x] A test with two invented same-named classes from different sources proves each character gets its own class's values.
- [x] The saving-throw characterization baseline is re-recorded only through its recorder; every changed row is reviewed and explained in the Landed note.
- [x] Hit points, hit dice and spell slots for existing characters do not change.
- [x] `npm run check:all` passes.
