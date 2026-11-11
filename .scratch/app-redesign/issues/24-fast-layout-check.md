# 24: A fast layout check

**Status:** ready-for-agent

## What to build

The full layout gate takes about 50 minutes: `npm run layout:check` (five widths, about 12 minutes), `-- --integrated` (about 14), and `WIDTHS=1024,1280` in both catalogs (about 20). A measurement on 2026-11-11 found:
- one width on its own runs the 28 Builder scenarios in 97s, about 3.5s per scenario;
- with five widths in parallel the same scenarios take 157s per width, on an 8-core machine.

About half of the single-width time is fixed waiting. Every scenario does `goto(..., networkidle)` and then sleeps 1500ms, then sleeps another 300 to 500ms before its screenshot. The script has 116 fixed waits in total, including two 8.5s waits for the dice result card to time out.

Make the gate fast and keep every check as sharp as it is now:

1. **Widths.** The default `WIDTHS` becomes `320,393,768,1280`, one width per layout:
   - 320: compact, below `BREAKPOINTS.compact` 380;
   - 393: phone;
   - 768: tablet;
   - 1280: desktop, at or above `BREAKPOINTS.desktop` 1024, and the three-column Home grid at 1200.

   Before dropping 360 and 412, look for checks that branch on width and make sure each branch is still reached.
2. **Integrated catalog.** `-- --integrated` runs at 320 only unless `WIDTHS` is set. The integrated run exists to catch long names and extra options, and those overflow at the narrowest width.
3. **Waits.** Replace the per-scenario `networkidle` and fixed sleeps with condition waits:
   - wait for the scenario's ready locator;
   - then wait for a settle probe, for example `document.fonts.ready` and the layout of the ready element unchanged across two animation frames.

   Replace the other fixed waits the same way where a condition exists. Use Playwright's `page.clock` to fast-forward timers such as the 8.5s result-card timeout. Keep a fixed wait only where nothing observable can stand in for it, with a comment saying why.
4. **Screenshots.** A scenario or extra check writes its screenshot only when:
   - it fails;
   - its name matches the new `SHOTS_ONLY` (comma-separated substrings, like `ONLY`);
   - or it is marked `shot: true`. Mark one scenario per main screen: Home, each sheet tab, each Creation Flow step, the Level-Up Flow, a modal, the dice tray.

   `SHOTS_ONLY=all` restores every screenshot. Try `deviceScaleFactor: 1`: keep it if a full run at 1 gives the same results as at 2, otherwise keep 2 and report what differed.
5. **Production bundle.** Measure serving a static export (`npx expo export -p web` into a temp folder, served by a small static server with a fallback to the route's HTML; `app.json` uses `web.output: "static"`) against the `expo start --web --clear` dev server. Adopt it as the default only if the full run is clearly faster and the checks still mean the same. The nested-button check reads a React dev-mode console error, so make sure the DOM check (`layout-check.mjs` around line 106) covers it on its own. Keep a `--dev` flag for the dev server. If you don't adopt it, report the numbers.
6. **Flaky dice animation check.** This is ticket 23, folded in here. The check compares two samples 120ms apart and fails under load. Make it prove that an animation ran without depending on frame timing; a die that never animates must still fail.

Then update the runtimes in `AGENTS.md`'s Verification paragraph and in `docs/agents/subagent-tiering.md`. In AGENTS.md, drop the sentence about the extra `WIDTHS=1024,1280` run.

## Acceptance Criteria

- [ ] The default `npm run layout:check` runs 320, 393, 768 and 1280, and is GREEN on the current `feat/app-redesign`
- [ ] `npm run layout:check -- --integrated` runs at 320 by default and is GREEN
- [ ] Before and after wall times and peak memory are reported for both commands: before is today's default, after is the new one
- [ ] The checks are not blinded. Re-introduce three known regressions, one at a time on a scratch commit, and each still fails:
  - the dice button over the flow footer at 768: revert the footer padding from ticket 22;
  - the stretched Stats roll badges at a wide width: from ticket 21;
  - one Builder overflow at 320 of your choice.
- [ ] Screenshots are written only on failure, for `SHOTS_ONLY`, or for `shot: true` scenarios
- [ ] The dice animation check fails with the animation stubbed out, and three full runs of the new default in a row are GREEN
- [ ] `npm run layout:android` is unaffected: `checks/androidRunner.test.ts` and `checks/nativeSteps.test.ts` pass

## Constraints

No assertion is weakened or dropped to save time. If a check has to change shape (a sleep becomes a wait, two samples become a sampled window), its failure case must still fail.

## Blocked by

None
