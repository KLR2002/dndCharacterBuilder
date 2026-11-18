# 01: One reader of the owners that grant spells

**What to build:** Create `src/rules/spellGrants.ts` with `heldSpellGrants(character, catalogs)` returning every owner the character holds whose record grants spells: the race or subrace (or lineage replacement) with only the grants whose gate is open (today `raceGrantsOf` / `openRaceGrants`, `src/rules/choices/featSpells.ts` ~670-700), each held feat with its selection (`heldFeatsOf`, ~231), and the background (`resolveCharacterBackground`, `src/rules/backgroundSpells.ts:41`). Each entry: `kind` ("race" | "feat" | "background"), the `GrantOwner`, the record, its `additionalSpells`, and the feat selection when there is one. Move `heldFeatsOf`, `raceGrantsOf` and their helpers into it (re-export from `featSpells.ts` only if many callers would otherwise change). Then switch every loop to it: `grantedSpellSources` and `grantedPreparedSpells` (`src/rules/grantedSpells.ts`), `heldExpandedSources` (`backgroundSpells.ts` ~55), `heldGrantsOf`, `featSpellRuleChoices`, `raceSpellRuleChoices`, `pruneReleasedFeatCounters` and the legacy High Elf cantrip migration (`featSpells.ts`). Where a loop only wants some kinds, it filters by `kind`.

Check whether `heldFeatsOf`'s feat resolution can use `findFeat` (`src/rules/featIncrease.ts`): if both give the same record for every selection shape (book source, no source, the Background marker with the background's own source), use `findFeat`; if not, keep `heldFeatsOf`'s resolution and list the difference in the report.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Characterization tests first, passing before and after: for a character with a race spell grant (a High Elf cantrip or a Tiefling legacy), a feat with spells (Magic Initiate with a picked list, Fey Touched), and a background with an expanded list (a Strixhaven background, if the integrated test compendium has one; else say what you used), the outputs of `grantedSpellSources`, `grantedPreparedSpells`, `heldExpandedSpellNames`, `featSpellRuleChoices` and `raceSpellRuleChoices` are pinned (deep-equal snapshots written in the test, not fixtures files).
- [ ] `grep -n "raceGrantsOf(\|heldFeatsOf(\|resolveCharacterBackground(" src/rules --include=*.ts -r` lists only `spellGrants.ts` (paste it).
- [ ] `npm run check:all` and `npm run check:live` pass.
