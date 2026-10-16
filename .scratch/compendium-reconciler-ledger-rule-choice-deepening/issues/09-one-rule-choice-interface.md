# 09: One Rule Choice interface over the existing sources

**What to build:** One availability and one pick interface cover ancestry choices, the hand-written class/subclass choices, and the specialised choice modules. Picks record, then reconcile. The id-substring dispatch is removed. The Giant Power known-spell sync becomes a Reconciler pass. The pick-recording function moves into the Rule Choice module, which removes a second import cycle.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Every caller (class progression, ASI/feat section, rest dialog, ancestry engine, builder tab) uses the one interface
- [ ] Picking any choice records it and reconciles; no id-substring dispatch remains except inside specialised modules
- [ ] Giant Power pick keeps its known spell in sync through the Reconciler
- [ ] Fighting style and artificer infusion picks behave as before
- [ ] Existing suite passes (`npm run check:all`)
