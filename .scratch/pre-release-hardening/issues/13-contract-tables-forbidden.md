# 13: Contract: hand tables forbidden, ADR trimmed

**What to build:** No hand-written proficiency table remains in the app, and the guard fails if one returns. ADR 0015's Known exceptions section lists only what truly remains (it should be empty or nearly so).

**Blocked by:** 12

**Status:** ready-for-agent

- [ ] The readers guard fails if any of the deleted tables or special cases is reintroduced, with a synthetic-source test.
- [ ] The guard's allowlist has no entry for a deleted table.
- [ ] ADR 0015's Known exceptions section is updated to match the code; every name in it exists.
- [ ] `npm run check:all` passes.
