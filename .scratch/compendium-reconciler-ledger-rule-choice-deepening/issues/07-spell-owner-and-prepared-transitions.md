# 07: Spell Owner and prepared-spell transitions

**What to build:** The class spell profile carries its Spell Owner key, derived once, including the Giant Barbarian owner. Knowing, preparing and checking-prepared go through one exact-match rule (canonical or legacy key), with gating and the always-prepared guard. The dead toggle rule is removed and the spells tab's prepare path uses the Spellbook Ledger.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Profile owner key matches the owner key used when storing spells, including Giant Barbarian
- [ ] Preparing a spell not on the class list (or from an inactive book) is rejected and leaves the character unchanged
- [ ] Always-prepared spells cannot be toggled and do not count against the preparation limit
- [ ] Legacy two-part keys still count as prepared
- [ ] Prepared-limit overrun is still a warning, not a rejection
- [ ] Existing suite passes (`npm run check:all`)
