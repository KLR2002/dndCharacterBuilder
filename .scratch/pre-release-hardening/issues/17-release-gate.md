# 17: Release gate

**What to build:** The whole release is verified together. The full check and the layout check pass in both catalog modes, the catalog format is bumped exactly once for the release and no more, and the glossary and decisions note match what shipped.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16

**Status:** ready-for-agent

- [ ] `npm run check:all` passes.
- [ ] `npm run layout:check` passes, and so does the same command with the integrated catalog option.
- [ ] The catalog format is bumped once for the release if scraped data changed after the current value shipped to anyone, and the stale-catalog test covers the previous value.
- [ ] `GLOSSARY.md` and `.scratch/pre-release-hardening/decisions.md` agree with the code; no ticket or slice numbers appear in source comments.
- [ ] The ticket's Landed note lists the remaining known limits for the release notes.
