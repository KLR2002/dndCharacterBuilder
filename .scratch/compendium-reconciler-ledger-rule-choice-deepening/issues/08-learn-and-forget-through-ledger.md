# 08: Learn and forget spells through the Ledger

**What to build:** Learning and forgetting spells go through the Spellbook Ledger, apply gating, and end in the Reconciler. Forgetting a spell for one Spell Owner leaves the same spell for other owners untouched. The spells tab's add and remove paths stop building keys themselves.

**Blocked by:** 07

**Status:** done

- [x] Learning a spell outside the class list or active books is rejected without changing the character
- [x] Multiclass: the same spell known or prepared under two owners; forgetting one leaves the other
- [x] Forgetting a spell unprepares it only for that owner
- [x] The spells tab no longer builds spell keys
- [x] Existing suite passes (`npm run check:all`)

## Notes

- Learning has no spell-level gate. Preparing does (from ticket 07), so a learned spell above the owner's maximum level is accepted and only blocked when prepared.
- A Giant Barbarian learn is a no-op unless the Giant Power pick is recorded first, because the Reconciler prunes Giant cantrips that are not the recorded pick.

## Review fix-up

- `learnSpell` now applies the same maximum-spell-level gate as preparing (shared `withinOwnerGate`). Test: "learnSpell rejects a spell above the owner's maximum spell level".
