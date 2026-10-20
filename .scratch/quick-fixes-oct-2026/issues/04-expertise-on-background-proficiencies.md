# 04: Expertise on proficiencies from the background

**What to build:** A player cannot choose Expertise on skill or tool proficiencies that came from their background. Diagnose which path loses them (the Expertise options reading a partial list of proficiencies, the background not being passed in, or the Expertise picker filtering them out), then fix it narrowly. This overlaps with the Proficiency Sheet spec, which will later feed the same options from the sheet; keep this fix small and note in a comment on this ticket what the sheet ticket must preserve.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A regression test, written first, fails on the current code: a character whose background grants skill proficiencies (fixed and chosen) and tool proficiencies has them offered by every Expertise milestone for its class.
- [ ] Picking Expertise on a background-granted skill or tool gives double proficiency on the card.
- [ ] If the background changes or is removed, the Expertise pick on its proficiency is released by the existing reconciler, with a notice.
- [ ] The diagnosis and what the Proficiency Sheet must preserve are written as a Comment on this ticket.
- [ ] `npm run check:all` passes.
