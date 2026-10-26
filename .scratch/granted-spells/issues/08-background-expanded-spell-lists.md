# 08: Background expanded spell lists (Strixhaven colleges, Ravnica guilds)

**What to build:** The background scraper keeps `additionalSpells` (their `expanded` lists, cantrips included). The check that decides whether a spell is on a class's list also includes the background's expanded spells, for every spellcasting class of the character, once the character has Spellcasting or Pact Magic. A Lorehold Student wizard can learn or prepare Spirit Guardians as a class spell; the same student without a casting class gets nothing; a multiclass student gets the spells on both classes' lists; a Warlock with a patron's expanded list and a college background gets both. The five Strixhaven colleges and the ten Ravnica guild backgrounds all work without a name in app code.

**Blocked by:** 01

**Status:** done

**Landed:** fast-forward of `worktree-agent-a512770241c29ce3e` (tip 398277f) plus a commit returning the Catalog Format to 9 (the implementer had bumped to 10; one release carries all granted-spell data). `check:all` passes (1290 app, 251 scraper); `check:live` 69/69. Open items: a spell learned from a background list may stay in `knownSpells` after the background is cleared (verify in review); `getSubclassSpells` inside `getClassSpellProfiles` still reads the process-wide compendium.

- [x] The background scraper copies the grants; the in-app sync builds them; the app background type carries them.
- [x] Engine and spell-list tests against an invented background: one class; two classes; a non-caster; cantrips in the list; stacking with a patron's expanded list; changing the background removes the spells from the lists (and from the learning pools).
- [x] The spell pickers that list a class's spells show the added spells (existing picker tests extended).
- [x] `check:live` asserts a Strixhaven college and a Ravnica guild background carry `expanded` spells in the real catalog.
- [x] `npm run check:all` and `npm run check:live` pass.
