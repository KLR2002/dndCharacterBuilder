# 02: Giant barbarian lists only the chosen Giant Power cantrip

**What to build:** A Path of the Giant barbarian chooses one Giant Power cantrip, but the spell list shows both cantrips. Only the chosen cantrip is on the spell list, and changing or clearing the choice changes the list. The cause has not been diagnosed; it may be the same dropped-choice mechanism as the Genie warlock bug (the spell profile losing the saved choice).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A regression test, written first, fails on the current code: a Path of the Giant barbarian with one Giant Power cantrip chosen has only that cantrip among the spells shown as known or granted.
- [ ] With no choice made, no Giant Power cantrip is listed; with the choice cleared, the cantrip is removed.
- [ ] Changing the choice swaps the cantrip.
- [ ] Characters saved with both cantrips already listed are corrected by the reconciler, with a `needsReview` notice, and no other known spell is touched.
- [ ] `npm run check:all` passes.
