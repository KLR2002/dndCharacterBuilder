# 02: Evaluation and ancestry take a Compendium (migrate batch A)

**What to build:** One catalog-bundle type replaces the two `CharacterCatalogs` interfaces. Character evaluation and the ancestry engine take a Compendium. The unused evaluation delegates are deleted and the live one is inlined. Tabs stop assembling catalogs by hand and pass the Compendium.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Only one catalog-bundle type exists in the codebase
- [ ] evaluateCharacter and ancestry resolution produce the same results given a Compendium as before
- [ ] The eight evaluation delegates in the services adapter are gone (one inlined)
- [ ] Tabs no longer build races/classes/backgrounds lists by hand
- [ ] Existing suite passes (`npm run check:all`)
