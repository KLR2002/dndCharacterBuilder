# Evidence: Native Android Screenshot Runner

Tree: `daa7a1d` on `feat/native-screenshot-runner` (base `origin/master` `549ab1d`). The only tracked change in the working tree is the unrelated `skills-lock.json`; three untracked `design-taste-frontend` skill folders are unrelated too.

## Required gate

`gauntlet.json` does not exist in this repository, so the quality gate's required contract is **BLOCKED**: nothing below is a pass of that gate. Run `/setup-matt-pocock-skills`, or name the commands of `AGENTS.md` as the required ones, before this branch is called ready.

## Commands declared in AGENTS.md, run on the final tree

| Command | Result |
| --- | --- |
| `npm run check:all` | exit 0 (1928 app tests, 305 scraper tests) |
| `npm run layout:check` | exit 0, 224 screenshots |
| `npm run layout:check -- --integrated` | exit 0, 292 screenshots |
| `npm run layout:android` (fresh E2E build, `ONLY=Home,Settings,Rest modal`, widths 360 and 412) | exit 0, 6 screenshots, no `-FAILED` file |
| `npm run check:live` | exit 1: one test, "live catalog: Rakish Audacity carries the cha Initiative Bonus", 139 of 140 pass. The same test fails the same way on `origin/master`; it is not caused by this branch. |

## Acceptance criteria

| Criterion | Verification |
| --- | --- |
| AC-1 build is debuggable with updates off, only with `-Pe2e` | Plugin unit tests; real APKs: the `-Pe2e` APK has `ENABLED=false`, is debuggable and `run-as` works; the plain APK has `ENABLED=true`, is not debuggable and `run-as` refuses |
| AC-2 to AC-4 seed hook | `checks/e2eSeed.test.ts` against the real storage seams; mutation checks on the flag, the delete and validate-before-write |
| AC-5 only the flagged entry imports the hook | `checks/e2eSeedHookGuard.test.ts`: relative, extensionless, `@/` alias, `/index`, dynamic, `require`, re-export and `import type` forms, and the flag test preceding the importer reference |
| AC-6, AC-7 shared scenarios, steps as data | Scenario names equal the fixtures (50 SRD, 67 integrated) captured from the pre-move script, which the original script at `4d29c3f` confirms; both full `layout:check` runs green |
| AC-8 to AC-11, AC-16 runner core | `checks/androidRunner.test.ts` against a recording fake adb; real boot-and-stop and reuse runs; a bundle check that a plain, then E2E, then plain build each rebuild the bundle task |
| AC-12 to AC-15 seeded scenarios, steps, failure, isolation | Real full SRD run at 360 dp: 49 screenshots, 0 `-FAILED`, 1 web-only skip, 2 absent-`scrollTo` warnings, exit 0; a deliberately wrong ready text produced a valid `-FAILED.png`, the run continued and exited 1 |
| AC-17 standards and docs | `layout:android` is named in `AGENTS.md`, `CODING_STANDARDS.md` and `docs/agents/driving-the-android-emulator.md` |
| AC-18 lost emulator | Fake-adb tests for both branches and the recovery cleanup; real run: an outside `adb emu kill` of a runner-booted emulator was recovered and every screenshot written, exit 0 |

Red-green and mutation evidence for each ticket is on its `Landed:` line under `issues/`.

## Review

Three independent review passes (behavior, standards, verification) on `origin/master...HEAD`, on the repairs, and on the last repair.

Blocking findings, all fixed and re-reviewed:

- Ctrl-C and SIGTERM handlers never ran (synchronous waits); fixed with an asynchronous `sleep`, per-call adb timeouts, and handlers installed before any device work with a late-bound cleanup. Verified on the real runner: exit 130 within hundredths of a second during the boot wait, no device or emulator left.
- Default screenshot folder was not per run; now a fresh folder per run.
- Real rules text in two fixtures; replaced, and a paraphrase of it rewritten.
- The seed-importer guard missed extensionless imports (and later the `@/` alias and `/index`); fixed with tests that fail on each form.
- Gradle's bundle task was skipped as up to date when only the E2E flag changed, so the APK kept a stub hook and every seeded scenario failed; fixed in the config plugin by declaring the flag as a task input, confirmed on real builds in both directions and end to end, plus a refusal to build on a project generated before that wiring.
- After a lost-emulator recovery the cleanup held the dead emulator's serial and could orphan the new one; fixed (the serial is dropped before the respawn and a failed console kill falls back to the spawned pid).
- `Buffer` used in a script (lint error outside `npm run lint`), and spec ids in comments; fixed.

Advisory findings fixed along the way: `WIDTHS` and `ONLY` validation, device selection (adopt a not-ready emulator without ever stopping it), stale dumps, `LD_LIBRARY_PATH` stripped for the emulator, `os.homedir()`, a private seed directory, a missing emulator binary, file-only refusals before any boot, a `release {` match scoped to `buildTypes`, a deterministic drain in `checks/context.test.ts`, and the missing tests the reviewers named.

Advisory findings accepted:

- A signal during the Gradle build or a long adb call waits for that call; Ctrl-C during the build ends Gradle and the run exits 1 after cleaning up. Documented in the doc.
- `scripts/layout-android.mjs` has no automated test; its paths were exercised by real runs.
- A pre-existing emulator that is mid-boot at the moment of the first listing could still be adopted as the run's own, in a narrow window.
- The duplicated `ONLY` and `WIDTHS` helpers between the two runners, `AC-n` ids that remain in the spec and tickets, volatile timing figures in the doc, and the module-level state in `scripts/lib/scenarios.mjs` (moved code).

## Residual risks and limits

- A full SRD run at one width takes about 19 minutes; the four widths of the whole list would take about 75 minutes, so `ONLY` is the usual way to run it. The per-scenario isolation did not make the run faster; the `uiautomator dump` (about 2 s) dominates.
- The native run does not measure anything: `expect` is not evaluated, and `New Character modal` plays only on the web.
- The integrated catalog has not run natively (out of scope for the first version); the 10 s ready timeout is untested against its multi-megabyte seed.
- The emulator needs `-gpu angle_indirect`: its default software renderer segfaults on a cold boot here, and `-gpu host` lost its GL context and killed the emulator after 8 and 29 scenarios in two full runs. `angle_indirect` completed whole-list runs, but that is a handful of runs, not a guarantee.

## Found with the new tool, not part of this change

At 360 dp on Android, the Spells tab's heading "WIZARD SPELLBOOK & CANTRIPS" runs into the "Add Spells" button. The web check did not flag it.
