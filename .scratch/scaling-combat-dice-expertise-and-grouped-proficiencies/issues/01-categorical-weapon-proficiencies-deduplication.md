# 01: Categorical Weapon Proficiencies Deduplication

**What to build:** Characters gaining proficiency in entire weapon categories (e.g. `Martial weapons` or `Simple weapons` via Fighter, Paladin, Barbarian, Cleric, etc.) see their weapon proficiency list automatically deduplicated. Individual weapons belonging to that category (such as Elf *Longswords, Shortswords, Shortbows, Longbows* or Dwarf *Battleaxes, Handaxes*) are hidden, rendering clean listings like `"Simple weapons, Martial weapons"` on the character sheet.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] When a character possesses `Martial weapons` proficiency, all standard weapons categorized as martial are omitted from the weapons proficiency display list.
- [x] When a character possesses `Simple weapons` proficiency, all standard weapons categorized as simple are omitted from the weapons proficiency display list.
- [x] When a character possesses both `Simple weapons` and `Martial weapons`, the list displays cleanly as `"Simple weapons, Martial weapons"` plus any non-standard/exotic weapons.
- [x] Non-standard weapons or firearms not in the standard simple/martial category remain listed explicitly.
- [x] Tested via `checks/proficiencies.test.ts` across single-class and multiclass combinations.
