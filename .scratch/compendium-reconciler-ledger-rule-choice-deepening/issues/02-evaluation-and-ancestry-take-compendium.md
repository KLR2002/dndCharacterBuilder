# 02: Evaluation and ancestry take a Compendium (migrate batch A)

**What to build:** One catalog-bundle type replaces the two `CharacterCatalogs` interfaces. Character evaluation and the ancestry engine take a Compendium. The unused evaluation delegates are deleted and the live one is inlined. Tabs stop assembling catalogs by hand and pass the Compendium.

**Blocked by:** 01

**Status:** in-progress

- [x] Only one catalog-bundle type exists in the codebase
- [x] evaluateCharacter and ancestry resolution produce the same results given a Compendium as before
- [x] The eight evaluation delegates in the services adapter are gone (one inlined)
- [ ] Tabs no longer build races/classes/backgrounds lists by hand
- [x] Existing suite passes (`npm run check:all`)

## Open gaps

- BuilderTab still passes a `{ races, backgrounds }` literal into the auto-granted skills call; converting it needs the skills module to take a catalog bundle.
- `src/rules/catalogs.ts` imports `currentCompendium`, which is the default owner that ticket 03 is removing from the rules layer.
