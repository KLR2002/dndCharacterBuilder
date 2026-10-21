# 06: Readers guard sees namespace imports

**What to build:** The proficiency readers guard cannot be bypassed with `import * as`. Namespace access to a guarded table, and re-exports of it, are flagged outside the sheet and its private sources.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A namespace import used to reach a guarded table fails the guard, and a synthetic-source test proves it.
- [ ] The current tree passes the guard; any existing namespace access is fixed or allowlisted with a one-line reason.
- [ ] `npm run check:all` passes.
