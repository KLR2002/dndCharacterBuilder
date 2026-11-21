# 02: One learnable-spell list per Spell Owner

**What to build:** Add `learnableSpells(character, profile, opts)` (`src/rules/spellcasting.ts`, or a new `src/rules/learnableSpells.ts` if `spellcasting.ts` would pass 500 more lines) for one class Spell Owner (`ClassSpellProfile`, `spellcasting.ts:35`): the spells of the active books it may learn, from its class list (Fighter and Rogue third casters read the Wizard list, as `SpellsTab.tsx` ~453-456 does), the subclass list and the expanded lists (`profileSpellContext`, `isSpellAvailableForClass`), up to `profile.maxSpellLevel`, minus the spells **this owner** already knows (`isKnown(character, profile, spell)`, `src/rules/characterSpells.ts:325`), sorted by level and name. It also returns the owner's restricted schools (Eldritch Knight: Abjuration, Evocation; Arcane Trickster: Enchantment, Illusion; cantrips are never restricted) as data, from a curated name-and-number table next to `getSubclassAllowedSwapSchools` (`src/rules/subclassSpells.ts:577`), not by subclass-name checks in components.

`newSpellsForLevelUp` (`src/rules/levelUpFlow.ts`) reads it for the planned owner (the profile of the planned character, as it builds one today), so the name-across-owners filter goes.

**Blocked by:** 01

**Status:** done

**Landed:** merge of e6597db. `src/rules/learnableSpells.ts`: `learnableSpells(character, profile, opts)` → `{ spells, restrictedSchools }`; "known" is `isKnown` (by `ownerKey`, legacy entries by class name); Fighter/Rogue third casters read the Wizard list through `THIRD_CASTERS`; `getThirdCasterRestrictedSchools` (curated, `subclassSpells.ts`). `newSpellsForLevelUp` reads it, so a Wizard/Sorcerer learns Shield for the Sorcerer side (red test first). check:all and check:live passed.

- [x] Red first: a Wizard 3 / Sorcerer 1 who knows Shield as a Wizard, levelling Sorcerer 1 → 2, is offered Shield; a Wizard levelling 3 → 4 who knows Shield is not.
- [x] Tests: an Eldritch Knight's list reports Abjuration and Evocation as restricted and offers Wizard spells; a level-up for a Fighter 2 → 3 Eldritch Knight offers the same list `learnableSpells` gives for that profile.
- [x] `npm run check:all` and `npm run check:live` pass.
