# 08: Background expanded spell lists (Strixhaven colleges, Ravnica guilds)

**What to build:** The background scraper keeps `additionalSpells` (their `expanded` lists, cantrips included). The check that decides whether a spell is on a class's list also includes the background's expanded spells, for every spellcasting class of the character, once the character has Spellcasting or Pact Magic. A Lorehold Student wizard can learn or prepare Spirit Guardians as a class spell; the same student without a casting class gets nothing; a multiclass student gets the spells on both classes' lists; a Warlock with a patron's expanded list and a college background gets both. The five Strixhaven colleges and the ten Ravnica guild backgrounds all work without a name in app code.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The background scraper copies the grants; the in-app sync builds them; the app background type carries them.
- [ ] Engine and spell-list tests against an invented background: one class; two classes; a non-caster; cantrips in the list; stacking with a patron's expanded list; changing the background removes the spells from the lists (and from the learning pools).
- [ ] The spell pickers that list a class's spells show the added spells (existing picker tests extended).
- [ ] `check:live` asserts a Strixhaven college and a Ravnica guild background carry `expanded` spells in the real catalog.
- [ ] `npm run check:all` and `npm run check:live` pass.
