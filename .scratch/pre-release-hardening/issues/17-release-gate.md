# 17: Release gate

**What to build:** The whole release is verified together. The full check and the layout check pass in both catalog modes, the catalog format is bumped exactly once for the release and no more, and the glossary and decisions note match what shipped.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16

**Status:** ready-for-agent

- [ ] `npm run check:all` passes, and so does the scraper's own `npm --prefix dnd5eToolsScrap run build` (type check), which `check:all` does not run.
- [ ] `npm run layout:check` passes, and so does the same command with the integrated catalog option.
- [ ] The catalog format is bumped once, in this ticket, after the last data change (class grants already changed the data since format 4), and the stale-catalog test covers the previous value.
- [ ] `GLOSSARY.md` and `.scratch/pre-release-hardening/decisions.md` agree with the code; no ticket or slice numbers appear in source comments.
- [ ] The ticket's Landed note lists the remaining known limits for the release notes.
