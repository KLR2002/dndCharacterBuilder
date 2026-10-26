# 04: Background-granted feat picks

**What to build:** A Lorehold Student, an Astral Drifter, a Mage of High Sorcery, a Gate Warden or any background that grants a feat with spells sees that feat's pick controls and its card, in the background section where the granted feat is added. The picks are the ones from tickets 02 and 03; changing or clearing the background releases the picks and the card with the existing review notice. A background that offers a choice of feats (Rewarded) shows the controls for the feat the player chose.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Engine tests against an invented background that grants a spell feat: the feat's card and picks appear; changing the background removes the card, the picks and the counters, with a notice; a choice-of-feats background shows the chosen feat's controls.
- [ ] The background section shows the pick controls under the granted feat.
- [ ] No background name appears in app code for spells (the existing background-feat table is not changed by this ticket).
- [ ] `npm run check:all` passes.
