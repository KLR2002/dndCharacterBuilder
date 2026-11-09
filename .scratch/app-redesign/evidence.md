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

Not built: AC-16, 22-26, 30-32 (tickets 15-19, blocked by decision ticket 05).

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
