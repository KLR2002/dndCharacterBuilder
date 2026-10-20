# 12: Contract: remove the old per-source readers

**What to build:** The per-source grant code that the sheet replaced (the class-name tool if-chain, the separate race, background and class readers for tools and languages, the separate saves and skill readers) is deleted, and no reader of proficiencies bypasses the sheet. A guard test fails if proficiency is read outside the sheet.

**Blocked by:** 05, 06, 07, 08, 09, 10, 11

**Status:** done

**Landed:** merged from `ps/12-contract` (c772097). Per-source readers moved behind the sheet into `src/rules/proficiencySources/`; the guard is `checks/proficiencyReadersGuard.test.ts`. Open: the class-name tool if-chain (`getClassToolGrant`) remains the sheet's source of class starting tools, because the catalog has no structured class tool grants for it; replacing it needs new class-base data.

- [ ] No source file reads race, background or class proficiency fields directly except the sheet and the scraper.
- [ ] A guard test enforces it.
- [ ] Documentation that names the old readers is updated (`GLOSSARY.md` stays free of implementation detail).
- [ ] `npm run check:all` and `npm run layout:check` (both modes) pass.
