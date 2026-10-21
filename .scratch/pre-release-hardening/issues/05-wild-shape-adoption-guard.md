# 05: Wild Shape adoption guard

**What to build:** Every way of adopting a Wild Shape form pays its charges through the single adoption handler, so the beast browser cannot adopt a form without paying. A guard test fails when an adoption path bypasses the handler.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A guard test fails when a Wild Shape adoption path does not go through the single adoption handler.
- [ ] All current adoption entry points (the Features card, the browser modal, any other) pass the guard; any that did not are fixed in this ticket.
- [ ] An elemental form still costs 2 charges and a standard beast 1, covered by a test at the handler.
- [ ] `npm run check:all` passes.
