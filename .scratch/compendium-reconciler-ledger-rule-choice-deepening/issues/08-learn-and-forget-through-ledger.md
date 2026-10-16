# 08: Learn and forget spells through the Ledger

**What to build:** Learning and forgetting spells go through the Spellbook Ledger, apply gating, and end in the Reconciler. Forgetting a spell for one Spell Owner leaves the same spell for other owners untouched. The spells tab's add and remove paths stop building keys themselves.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Learning a spell outside the class list or active books is rejected without changing the character
- [ ] Multiclass: the same spell known or prepared under two owners; forgetting one leaves the other
- [ ] Forgetting a spell unprepares it only for that owner
- [ ] The spells tab no longer builds spell keys
- [ ] Existing suite passes (`npm run check:all`)
