# 03: Full filter vocabulary (Strixhaven Initiate, Fey Touched, Spell Sniper)

**What to build:** The rest of the feat vocabulary, through the same reader. Filters on school, several class lists at once, ritual and attack roll; choose-from-list grants; a casting ability the player chooses once (Strixhaven Initiate); named alternatives labelled by what they give (a Strixhaven college offers cantrip pairs, shown as the cantrips). The spell scraper adds an attack-roll field to every spell from the source data, so Spell Sniper's "cantrip that needs an attack roll" is a field filter and not a list. After this ticket Strixhaven Initiate, Fey Touched, Shadow Touched, Spell Sniper, Artificer Initiate and the Dragonlance, Planescape and Ravnica feats all produce their cards, picks and counters.

**Blocked by:** 02

**Status:** done

**Landed:** fast-forward of `worktree-agent-abd841b161ed4895f` (tip cbb955c). `check:all` passes (1320 app, 269 scraper); `check:live` 79/79; layout scenario green (Magic Initiate only, the Strixhaven controls have no scenario, ticket 09). Spells carry `spellAttack`; filters on school, several classes, attack roll, named list with count; a feat-level casting-ability pick; named alternatives labelled by their fixed cantrips (option `label`). Open items: `prepared` groups (37 feats in the live catalog: the Adepts, Mark of X, Vampire Touched and others) are not read, pinned in the live test; grants with no `ability` (Cartomancer, Outlands Envoy, Rune Shaper, Servo Crafting, Strixhaven Mascot) give no card; a catalog cached before this branch has no attack-roll data (format 9 is unreleased); a comment in `checks/grantedSpellPicks.test.ts` names a ticket number.

- [x] Spells carry an attack-roll field from the source data (scraper, app type, SRD baseline only if regeneration changes bytes, in its own prune-script commit).
- [x] Engine tests against an invented catalog cover: a school filter; several classes in one filter; a ritual filter; an attack-roll filter; a choose-from-list grant with a count; a player-chosen casting ability saved once and used by the card; a named-alternative pick labelled by its fixed cantrips; an ability inherited from the feat's increase (Fey Touched style).
- [x] Pick controls for the new shapes use the same controls as ticket 02, plus an ability chooser.
- [x] `check:live` asserts Strixhaven Initiate, Fey Touched, Shadow Touched and Spell Sniper carry grants of the expected shape, and that at least one cantrip has the attack-roll field set and one does not.
- [x] `npm run check:all` and `npm run check:live` pass.
