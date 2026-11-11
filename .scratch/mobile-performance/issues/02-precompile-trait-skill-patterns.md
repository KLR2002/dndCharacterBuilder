# 02: Build the trait-text skill patterns once

**What to build:** `traitTextSkills` in `src/rules/proficiencySources/skillGrants.ts` (~25-51) constructs a new `RegExp` for each of the skills in `DND_SKILLS`, for every race and subrace trait, on every call. The Proficiency Sheet calls it on every sheet it builds (`legacySkillNames` in `src/rules/proficiencySheet.ts` ~176), and a render builds many sheets, so once ticket 01's catalog cache is applied this function is about 40% of a Creation Flow render's rules time (self time in a CPU profile). Build the per-skill patterns once at module level (the skill list is a constant), and remember each trait description's result so the same description is not scanned twice (a `Map` keyed by the description string is enough; descriptions are catalog text and do not change while the app runs). The function's results must not change: same skills, same Stonecunning exclusion, same order of the returned names.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** 5e5ebf4. Measured together with 01 (see 01). check:all and check:live 141/141 pass; characterization test checks/traitTextSkills.test.ts.

- [x] Existing tests that cover trait-text skills pass unchanged (find them with `grep -rln "traitTextSkills\|proficient in the" checks`); if none drives `traitTextSkills` directly, add one first with invented trait text: a trait naming one skill in the prose form, one in the `{@skill ...}` form, a Stonecunning trait that names History, and a trait naming none
- [x] No `new RegExp` remains inside the trait loop
- [x] `npm run check:all` and `npm run check:live` pass
- [x] The report pastes `npm run perf:rules:interp` before and after if ticket 01 has landed in the integration branch by then; otherwise it says so
