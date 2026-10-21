# 11: Racial weapon and armor grants

**What to build:** Racial weapon and armor proficiencies (the Githyanki and Drow cases) come from Proficiency Grants, and the app's race weapon table and the Githyanki armor special case are deleted.

**Blocked by:** 10

**Status:** ready-for-agent

- [ ] The race weapon table and the Githyanki armor special case are deleted from the app.
- [ ] Existing characters show the same weapons and armor as before; the weapons-and-armor baseline stays green or changes only through its recorder with a reviewed diff.
- [ ] Attack proficiency and AC still read the sheet; a test covers a Githyanki and a Drow.
- [ ] The coverage gate stays green; data changed only through the enrich step and the prune script.
- [ ] `npm run check:all` passes.
