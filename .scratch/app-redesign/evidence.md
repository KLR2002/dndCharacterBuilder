# Evidence: tickets 06-14 on feat/app-redesign

Tree: `a7a1e85` (merge of review repair R4), clean. Integration fixed point: `6a7fe75`.

## Required gate (AGENTS.md)

| Check | Command | Result | Exit |
| --- | --- | --- | --- |
| lint, typecheck, tests | `npm run check:all` | pass: 2050 app + 309 scraper tests, typecheck ratchet "311 known, none new" | 0 |
| live catalog | `npm run check:live` | pass: 140 tests | 0 |
| layout, SRD | `npm run layout:check` | GREEN: no layout violations (320/360/393/412) | 0 |
| layout, integrated | `npm run layout:check -- --integrated` | GREEN: no layout violations (320/360/393/412) | 0 |
| native modals | `ONLY=modal WIDTHS=393 npm run layout:android` | every modal scenario rendered as a bottom sheet on the emulator | 0 |

Required gate: PASS. The swipe-down close on Android was proven by hand on the emulator during ticket 14 (before/after screenshots and a UI dump); the runner itself takes screenshots and does not swipe.

## Acceptance criteria

| AC | Owner | Verification |
| --- | --- | --- |
| AC-1, 2, 3, 5, 7, 9 | 06 | `checks/creationFlow.test.ts`, `checks/creationFlowChanges.test.ts` |
| AC-4 | 07 | `checks/creationFlowChanges.test.ts` (12 mutations each turned a test red) |
| AC-6, 8 | 12 | layout scenarios "Draft listed with step", "Draft opens in flow", "Draft sheet redirects to flow", "Review finishes character" (two mutations red) |
| AC-10, 11 | 13 | `checks/editBuild.test.ts`; layout scenarios "Builder Edit Build background step", "Builder Edit Build class change flags steps", "Builder Level up class step" (mutation red) |
| AC-12, 13, 14, 15 | 08 | `checks/levelUpFlow.test.ts`, `checks/rules.test.ts` (rolled HP, Constitution changes, level removal) |
| AC-17-21 | 09 | `checks/dice.test.ts` (fixed random sources); layout scenario "Abilities rolled" |
| AC-27 | 11 | `checks/themeContrast.test.ts` (7 accents x 4 surfaces) |
| AC-28 | 10 | layout "Modal closing" check (backdrop, Escape, handle, swipe; unsaved-input question; two mutations red); `checks/modalShellGuard.test.ts` |
| AC-29 | 14 | layout modal-shape assertions per width; emulator swipe proof; `layout:android` |

AC-16, 22-26, 30-32: tickets 15-19, below.

## Review

Fresh reviewers (behaviour, standards, verification, UI) on `6a7fe75..3d6f6eb`, then on each repair. Blocking findings and their repairs:

- A draft with a starting level above 1 opened wounded; a fresh draft flagged unreleased steps; Rolled Abilities valid with nothing placed; later edits dropped attention marks; multiclass Edit Build read only the first class: repair R1.
- Identity panel "(+-1)"; integrated scenario routed to the wrong step; explanatory copy on Background and the Subrace banner (the user's verbatim copy rule): repair R2.
- Over-level spell release dropped another class's prepared spell of the same name (data loss); stale marks on steps that stopped applying: repair R3.
- Legacy equipped items showed an empty circle (regression from R3): repair R4.

Earlier, ticket-level reviews sent back 06 (class skill picks in Class Choices), 08 (rolled HP lost; multiclass Fighting Style), a follow-up (die-face HP; one shared class-choice function) and a raw-modal migration (12 modals outside the shared shell).

## Advisory dispositions

- Level up / Edit Build strip height on the sheet, rule-restating captions in older tabs ("Level + INT mod", "Str x 15"), remaining accent fills on the switch track: deferred to decision ticket 20 (sheet and Home restyle).
- Header sub-line truncation at 320px: pre-existing, deferred to ticket 20.
- A malformed save blocks loading every character: existing behaviour, not changed here.
- Per-modal unsaved-input wiring has no per-modal test (the shared guard is tested): accepted.
- `levelUpFlow.ts` is used only by tests until ticket 18.
- `migrateCharacter` still reaches the reconciler through a pre-existing `ruleChoices.ts` import: pre-existing, reported.

## Residual risk

- Native: only the modal scenarios ran on Android; Creation Flow inputs follow the Android input rules but were not run on the emulator.
- Wide screens: checked on web at 1280 by the implementers and by screenshot review; `layout:check` itself covers phone widths.
- Level up uses the interim path (`/build/<id>?step=class&mode=levelup`) until ticket 18.

# Evidence: tickets 15-19 on feat/app-redesign

Tree: `cf714f8` (merge of review repair R9), clean. Run from a separate worktree on `feat/app-redesign`.

## Required gate (AGENTS.md)

| Check | Command | Result | Exit |
| --- | --- | --- | --- |
| lint, typecheck, tests | `npm run check:all` | pass: 2115 app tests (94 skipped live-only) + 307 scraper tests | 0 |
| live catalog | `npm run check:live` | pass: 140 tests | 0 |
| layout, SRD | `npm run layout:check` | GREEN: no layout violations (320/360/393/412) | 0 |
| layout, integrated | `npm run layout:check -- --integrated` | GREEN: no layout violations (320/360/393/412) | 0 |
| native | `ONLY="Settings,Rest modal,Conditions modal,Actions,Stats,Dice button,Level-Up Flow" npm run layout:android` | run finished, 72 screenshots, none failed (4 widths) | 0 |

Required gate: PASS.

## Acceptance criteria

| AC | Owner | Verification |
| --- | --- | --- |
| AC-32 | 15 | layout scenarios "Dice button on the character list / on Options / on sheet / in Creation Flow / in Edit Build / in Level-Up Flow" (web and Android); `checkDiceTrayAndLog` (tray rolls a pool; button above the flow's bottom bar under 768px, step content padded) |
| AC-24 | 15 | `checks/rollLog.test.ts`; `checkDiceTrayAndLog` (character and source, newest first, empty after a reload) |
| AC-22 | 16 | `checks/actionRolls.test.ts`; `checkActionRolls` (attack, damage, crit follow-up, hold sheet) |
| AC-23 | 16 | `checkActionRolls` browser oracle: the saved Character is unchanged after rolls (mutation red) |
| AC-31 | 17 | `checks/statRolls.test.ts`; `checkStatsRolls` (check, save, skill with the expected bonus; advantage shows two d20s) |
| AC-16, AC-30 | 18 | `checks/levelUpFlow.test.ts`, `checks/levelUpFlowPlan.test.ts`; `checkSpellsAfterLevelUp`, `checkLevelUpHpRollLogged`, `checkLevelUpHpState`, `checkLevelUpHpPerClass`, `checkLevelUpFeatReplace`, `checkLevelUpFeatSubChoiceChips`, `checkLevelUpCancelAndReview` (double-tap guard: red with the guard removed) |
| AC-25, AC-26 | 19 | `checks/diceAnimation.test.ts`; `checkDiceAnimation` (result shown before the dice settle; Settings switch turns 3D dice off) |

## Review

Sonnet reviewers on each ticket, then on the integrated diff and on each repair. Blocking and should-fix findings and their repairs:

- R5a/R5b: sole subclass applied early; feat sub-choices dropped; stale feat pick; double apply; Hit Points state and re-roll by switching class; `classStepMinLevel` regression; level 20 cap; empty subclass step; "+-1"; spell to-hit only for spell attacks; accessible names; AC-23 oracle; tray cap 100; result card auto-dismiss, Natural 20 only on d20 tests, announcements, 48dp targets; `matchMedia` SSR guard.
- R6: a feat selection replaces the plan's pick at once; single offered subclass is the plan's pick; per-class plan cache; feat sub-choice cap; one announcement mechanism per platform.
- R7: the flows' step padding follows the flow's own 768px breakpoint (R6 had moved it to 600, letting the dice button cover the last rows at 600-767).
- R8: the ASI/Feat step reads its selection from the plan (it forgot a pending feat after a remount); a half-finished ASI replaces a feat; the double-tap witness tests the guard; Android announces explicitly, web keeps one always-mounted live region.
- R9 (found by `layout:android`): the sheet's draft redirect read the selected character instead of the route's, so a deep link to a draft from a character's sheet opened that character's build (app bug); the Android runner left a modal open across a same-route deep link, swiped open sheets closed and tapped under the floating dice button (runner).

## Advisory dispositions

- Dice icon in roll badges, spell level on Spells step rows, the tray keeping the last pool: kept (seen in the prototype).
- Spells step uncapped in the Level-Up Flow: the Spells tab enforces the limits (spec).
- Glossary entries for the dice tray and the result card: deferred.
- `SIDEKICK_CLASSES` is a non-SRD list in `src/`: a single copy now; moving it to catalog data is deferred (ADR 0014).
- Stats row height, the sheet header and tab bar: ticket 21.
- Plan cache in the Level-Up Flow is not invalidated by a catalog resync mid-flow: low likelihood, accepted.
- E2E hooks are absent from production builds by `EXPO_PUBLIC_E2E`, not tested.
- Champion Improved Critical and cantrip damage scaling are not rollable from the badge: out of scope.
- The web live region is hidden with opacity 0: works with the screen readers checked by the layout run's ARIA assertions only.

## Residual risk

- Native: hold-to-roll and TalkBack announcements were not exercised on the emulator (the runner takes screenshots and does not long-press or listen).
- Wide screens: the sheet and Home restyle is ticket 21; tickets 15-19 checked 768 and 1280 only in targeted runs (`WIDTHS=360,700,768,1280` for the dice and flow padding).

# Evidence: ticket 21 on feat/app-redesign

Tree: `d12b101` (merge of ticket 21 with repairs R1 and R2), clean worktree, dependencies from the committed lockfile (`npm ci`).

| Check | Command | Result | Exit |
| --- | --- | --- | --- |
| lint, typecheck, tests | `npm run check:all` | pass: 2118 app tests (94 skipped live-only) + 307 scraper tests | 0 |
| live catalog | `npm run check:live` | pass: 140 tests | 0 |
| layout, SRD | `npm run layout:check` | GREEN (320/360/393/412) | 0 |
| layout, integrated | `npm run layout:check -- --integrated` | GREEN | 0 |
| layout, wide | `WIDTHS=768,1280 ONLY="Sheet chrome,Home layout,Stats,Dice" npm run layout:check` | GREEN | 0 |
| native | `ONLY="Stats,Actions,Spells,Inventory,Features,Journal,Home,Dice button,Review finishes character,Level-Up Flow,Settings,Rest modal,Conditions modal" npm run layout:android` | run finished, 132 screenshots, none failed | 0 |

Required gate: PASS.

New checks: "Sheet chrome" (one bar of six 48dp tabs on phones, a compact header of four 48dp controls on one centre, the class level kept in the line under the name, the left rail at 768px and up, the dice button above the bar after returning from Level up), "Home layout" (list on phones, grid flush with the search bar at wide widths, no HP badge, no nested buttons), Stats badges centred within 2px.

Review: a Sonnet review and the owner's screenshots sent back:
- R1:
  - a stale dice obstruction after returning from Level up or Edit Build
  - nested buttons on Home
  - the tab bar under the bottom inset
  - two weakened assertions, now restored
  - "Take Rest (Short / Long)" wrapping
  - stat cards 3+1
  - the header line losing the class level
  - a lone grid card stretching
  - the HP chip under 48dp
  - selected state on tabs
  - one 768 constant
- R2:
  - the grid short of the search bar's edge
  - 40dp back and menu buttons next to 48dp chips

Advisory: RollBadge keeps 48dp by `hitSlop` around a content-sized badge, which no check measures.

Not covered: the 13 overflows already in the Builder and flows at 768/1280 (ticket 22).

# Evidence: ticket 22 on feat/app-redesign

Tree: `6f0ea1e` (merge of ticket 22 with repairs R1 and R2, plus the AGENTS.md note), clean worktree, dependencies from the committed lockfiles (`npm ci` in the root and `dnd5eToolsScrap/`).

| Check | Command | Result | Exit |
| --- | --- | --- | --- |
| lint, typecheck, tests | `npm run check:all` | pass: 2123 app tests + 307 scraper tests | 0 |
| layout, SRD | `npm run layout:check` (320/360/393/412/768) | GREEN, 634s | 0 |
| layout, integrated | `npm run layout:check -- --integrated` | RED: 2 violations, both "dice animation" at 360 and 412; rerun with `ONLY="dice animation"` GREEN at all five widths | 1, then 0 |
| layout, wide SRD | `WIDTHS=1024,1280 npm run layout:check` | GREEN, 589s | 0 |
| layout, wide integrated | `WIDTHS=1024,1280 npm run layout:check -- --integrated` | GREEN, 694s | 0 |

Required gate: PASS, with one flaky check. The dice animation check fails under the five-width load and passes alone. It failed the same way in the implementer's run at 320/393. This is ticket 23.

Not run: `check:live` (no catalog readers changed). `layout:android` was not run: the changes apply from 768px up, plus the identity panel hiding empty rows, which is not native-only.

New checks:
- At 768px and up, the dice button must not cover either flow's footer action or identity line. It failed on `882de32`.
- The wide sheet must have no "Sheet menu" button, and Level up and Edit Build must be buttons in the rail.
- New scenarios: "Builder Spells step" and "Level-Up Flow identity panel".
- Absence checks ignore the identity side column, which repeats the character's abilities. Every other check still covers that column.

Review:
- First round: two fixes rejected.
  - It removed the identity side panel the design keeps.
  - It named the wide sheet menu with `aria-labelledby` to get past the chrome check.
- R1 (Sonnet review):
  - The dice button covered the footer at 768-983.
  - The default run missed 1024.
  - The wide sheet's menu absence was not asserted.
  - Tests imported the playwright script.
  - The Level-Up Flow had no wide scenario.
- R2: all fixed. A sixth default width (1024) peaked at about 11.1 GiB, so it stays a documented extra run.
