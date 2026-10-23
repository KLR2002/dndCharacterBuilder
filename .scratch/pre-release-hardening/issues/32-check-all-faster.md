# 32: check:all fails fast and the characterization sweeps run once per file

**What to build:** Retro finding. `npm run check:all` takes about 28 s: 21 s of app tests, about 1 s of scraper tests, 1.5 s of typecheck, 1.7 s of ratchet and 1.4 s of lint. Two changes:

1. **Cheap checks first.** `check:all` in `package.json` runs the tests before lint and typecheck, so a typo costs 25 s to find out. Reorder it: lint, typecheck, typecheck ratchet, then the tests. The green path takes the same time; a red lint or type error returns in about 3 s. The `lint` script keeps `--max-warnings 0`.
2. **Compute each characterization sweep once.** About 12 of the 21 s of app tests are ten tests in five files that each recompute the same sweep over every class and subclass: `checks/weaponsArmorCharacterization.test.ts` (1.6 s and 1.4 s), `checks/skillsCharacterization.test.ts` (1.3 s and 1.4 s), `checks/savingThrowsCharacterization.test.ts` (1.0 s and 1.0 s), `checks/proficiencySheetCharacterization.test.ts` (0.9 s and 0.8 s), and `checks/kenseiWeapons.test.ts` (0.8 s). In each file the "baseline is still shown" test and the "newly granted is allowlisted" test run the same sweep; compute the sweep once per file (module-level memo or a shared setup) and let both tests read it. The tests keep their names, assertions and failure messages. The recorder environment variables (`UPDATE_SKILLS_BASELINE` and the others) keep working and write the same files. Do not change any baseline or allowlist file.

**Blocked by:** None

**Status:** done

**Landed:** merged from `pr/32-check-all-faster` (772fe7c, e0fe465, ea20ef5). `check:all` now runs lint, typecheck, ratchet, then tests: a deliberate lint error fails in 2.3 s instead of 27 s. The four sweep files compute their sweep once (a memoised `sweep()`), and the Kensei file builds one Compendium; median app-test time 21.9 s to 16.0 s, `check:all` 27.4 s to 21.7 s (the main session measured 19.8 to 24.9 s on the merged tip). Test names, assertions and baseline files are unchanged: a changed baseline value still fails the same eight tests with the same messages, and the recorder variables write byte-identical fixtures (the weapons recorder changes its fixture by design and was restored). Open items: the first test of each sweep pair still takes 1 to 1.5 s; "class and subclass Rule Choices match the recorded baseline" (0.43 s) and "the baseline exercises every subclass choice family" (0.36 s) are next; many integration tests build an integrated Compendium per test (60 to 70 ms each), and a shared fixture could save more.

## Design notes

- Measure before and after on the same machine, three runs each, and report the median wall time of `node --experimental-strip-types --test checks/` and of `npm run check:all`. Per-test durations: `node --experimental-strip-types --test --test-isolation=none --test-reporter=spec 'checks/**/*.test.ts'`, then sort by the `(…ms)` figure. Target: the app tests about 6 s faster.
- If a sweep depends on test-local state (the integrated-versus-SRD mode, the recorder env var), memoise per mode, not globally. Prove the memo does not hide a failure: in a temporary uncommitted edit change one baseline value, see the test go red with the same message as before, then revert it.
- Do not widen scope to other slow tests: if the rest of the suite shows an obvious further saving, report it.
- Command timeouts (the tiering rules): 120 s for `check:all` and for a commit, 30 s for reading and git commands.

## Acceptance criteria

- [ ] `check:all` runs lint, typecheck, ratchet, then tests; a deliberate lint error fails in under 5 s (show the time).
- [ ] The five files compute their sweep once; the median app-test wall time drops (report before and after).
- [ ] A changed baseline still fails the same tests with the same messages; recorder variables still work (run one recorder and show that the file is unchanged).
- [ ] `npm run check:all` passes.
