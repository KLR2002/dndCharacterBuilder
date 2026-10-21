# 13: Contract: hand tables forbidden, ADR trimmed

**What to build:** No hand-written proficiency table remains in the app, and the guard fails if one returns. ADR 0015's Known exceptions section lists only what truly remains (it should be empty or nearly so).

**Blocked by:** 12

**Status:** done

**Landed:** merged from `pr/13-contract-guard` (b52edbb). `check:all` passes (1072 app tests, 132 scraper tests, 322 known type errors none new), scraper type check clean, no baseline or allowlist changed. The readers guard now fails on any deleted table, tool-chain function, special case or module reintroduced anywhere under `src/`, including inside the sheet, with a synthetic-source test per kind; its allowlist is tested to name none of them; ADR 0015's Known exceptions is tested against the code. One real hand table remains and is the single Known exception: `MULTICLASS_PROFICIENCIES` in `src/constants/rules.ts` (not in the spec's list; follow-up ticket 19). `subclassChoiceTable.ts` holds rule-choice pointers, not proficiencies, and is not guarded.

- [x] The readers guard fails if any of the deleted tables or special cases is reintroduced, with a synthetic-source test.
- [x] The guard's allowlist has no entry for a deleted table.
- [x] ADR 0015's Known exceptions section is updated to match the code; every name in it exists.
- [x] `npm run check:all` passes.
