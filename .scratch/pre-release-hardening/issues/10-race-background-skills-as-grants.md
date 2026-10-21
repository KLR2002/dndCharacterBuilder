# 10: Race and background skills as grants

**What to build:** Race and background skill proficiencies come from Proficiency Grants and the hand tables of them are deleted, including the static-table fallback the Expertise-follows-books work noted. A background from a disabled book no longer keeps its skill through a static table.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] The race and background skill tables are deleted from the app.
- [ ] Existing characters show the same skills as before; the skills characterization baseline stays green or changes only through its recorder with a reviewed diff.
- [ ] A character whose background comes from a disabled book loses that skill and an Expertise mark on it is released, covered by a test.
- [ ] The coverage gate stays green; data changed only through the enrich step and the prune script.
- [ ] `npm run check:all` passes.
