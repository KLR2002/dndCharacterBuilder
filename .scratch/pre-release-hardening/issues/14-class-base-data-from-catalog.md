# 14: Class base data from the Catalog class

**What to build:** A class's saving throws, hit die, caster kind and spell ability are read from the Catalog class the character holds (by name and source), and the name-keyed constant tables for them are removed once nothing reads them. Hit points, hit dice, spell slots and spellcasting stay identical for every existing character.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Saves, hit die, caster kind and spell ability come from the held Catalog class, with the existing fallback for a saved class that has no source.
- [ ] The name-keyed tables for them are deleted.
- [ ] A test with two invented same-named classes from different sources proves each character gets its own class's values.
- [ ] The saving-throw characterization baseline is re-recorded only through its recorder; every changed row is reviewed and explained in the Landed note.
- [ ] Hit points, hit dice and spell slots for existing characters do not change.
- [ ] `npm run check:all` passes.
