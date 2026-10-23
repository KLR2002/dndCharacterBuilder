# 02: Giant barbarian lists only the chosen Giant Power cantrip

**What to build:** A Path of the Giant barbarian chooses one Giant Power cantrip, but the spell list shows both cantrips. Only the chosen cantrip is on the spell list, and changing or clearing the choice changes the list. The cause has not been diagnosed; it may be the same dropped-choice mechanism as the Genie warlock bug (the spell profile losing the saved choice).

**Blocked by:** None (can start immediately)

**Status:** done
**Landed:** 42ac1ec, check:all passed (808 app, 35 scraper); the cause was both Giant cantrips arriving through the subclass's known spells, so the profile now filters them to the pick. Not seen on a device.

- [x] A regression test, written first, fails on the current code: a Path of the Giant barbarian with one Giant Power cantrip chosen has only that cantrip among the spells shown as known or granted.
- [x] With no choice made, no Giant Power cantrip is listed; with the choice cleared, the cantrip is removed.
- [x] Changing the choice swaps the cantrip.
- [x] Characters saved with both cantrips already listed are corrected by the reconciler, with a `needsReview` notice, and no other known spell is touched.
- [x] `npm run check:all` passes.

## Comments

**Diagnosis (main session):** The Path of the Giant's `additionalSpells` in the catalog is two separate, unnamed entries, one granting Druidcraft and one granting Thaumaturgy, which together mean "choose one". `selectAdditionalSpellsEntries` only narrows entries that carry a name, so with unnamed entries it returns both and `getSubclassSpells` reports both as the subclass's cantrips. The class spell profile then adds every one of `subSpells.cantrips` to the Giant barbarian's known spells (the `isGiantBarbarian` loop in the profile builder), so the spell list shows both whatever was chosen. The reconciler's Giant Power sync keeps only the picked cantrip in the stored known spells, but the profile builder puts the other one back.

**Fix direction:** For a Giant barbarian, the cantrips the profile adds come only from the saved Giant Power pick (none when there is no pick). Do not change `selectAdditionalSpellsEntries` generally, since other subclasses legitimately have several unnamed entries. Write the regression test at the class spell profile seam with the real Path of the Giant data from the integrated test compendium (see `checks/genieExpandedSpells.test.ts` for the pattern, and `checks/testUtils.ts`): with each pick the profile's known cantrips contain only that cantrip; with no pick none; the reconciler test for stored duplicates already exists in the repo, extend it only if it does not cover both stored cantrips.
