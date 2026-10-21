# 04: Layout guard reads style-object scroll heights

**What to build:** The layout check catches a nested scroll whose height is written in a style object, not only one written inline on the component. A deliberately broken fixture proves it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A nested scroll with its height in a style object is reported by the layout check.
- [ ] A test (or a self-check fixture the script runs) fails when that case is not detected.
- [ ] No existing screen is newly reported without being fixed or justified in the ticket's Landed note.
- [ ] `npm run check:all` and `npm run layout:check` pass in both catalog modes.
