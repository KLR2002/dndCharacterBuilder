# 01: The Subclass step keeps its list after a pick

**Status:** ready-for-agent

## The bug

In the Creation Flow and in Edit Build (both host `BuilderTab` with a `step`, `src/app/build/[id].tsx:172`), the Subclass step draws only `SubclassSection`. Its card shows only while the class has no subclass or while `changingSubclassFor` names the class (`src/components/builder/SubclassSection.tsx:105-112`). After a pick the card hides and the step is empty; the step itself stays in the flow (`src/rules/creationFlow.ts:283`). The pencil next to "Archetype: X" (`src/components/builder/ClassLevelsSection.tsx:183`) sets `changingSubclassFor`, but it is on the Class step, where `SubclassSection` is not rendered (`src/components/builder/ClassSteps.tsx:118,131`), so it does nothing. Every class is affected; the SRD Baseline is not (one subclass per class, applied, no choice). The level-up flow is not (`src/components/levelUpFlow/SubclassStep.tsx` always lists, with the pick highlighted).

## What to build

- On the Subclass step, a class that has reached its subclass level and has subclasses to choose from always shows its list, the current pick highlighted (as today's `isCurrent` chip style). Tapping another subclass switches to it through the existing `selectSubclass` (the expanded-list warning for orphaned spells still shows first). Tapping the current one changes nothing.
- The "⚠️" mark and the warning border show only while no subclass is chosen; with a pick, the card uses the regular border. The card has no close button.
- On the Class step, tapping "Archetype: X ✎" opens the Subclass step (the route's `openStepById("subclass")`, passed down as a prop through `BuilderTab` and `ClassSteps`). The SRD Baseline keeps the plain text.
- The `changingSubclassFor` state and props go away; nothing else uses them.

## Acceptance Criteria

- [ ] With an Integrated Catalog, a level 3 draft (any class with subclass level 3, or a level 2 Druid if its subclass level is 2 there) on the Subclass step: pick subclass A, the list stays with A highlighted; pick B, B is highlighted and the character's subclass is B.
- [ ] The same on a finished character opened in Edit Build.
- [ ] On the Class step, tapping the archetype opens the Subclass step with the list.
- [ ] SRD Baseline: unchanged (no list, plain archetype text).

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| List stays, switch works | Creation Flow's Subclass step in a browser, `-- --integrated` | a new `layout-check.mjs` extra check: open the Subclass step, pick one subclass, assert the list is still visible and the pick is selected (`accessibilityState`/`aria-selected` on the chips, add them as `SubclassStep` does), pick a second one and assert it is selected. Red before the fix, green after (paste both) |
| Pencil | Class step in a browser | the same check (or a second one) taps the archetype on the Class step and sees the Subclass step's list |
| Edit Build | finished character in Edit Build | the check covers it, or a step reopens Edit Build on the seeded finished character |
| SRD | existing scenarios | scoped SRD run of the builder scenarios stays green |

`npm run check:all` passes. Scoped layout runs: `ONLY=<your check names>` at 320 with `-- --integrated`, and the SRD builder scenarios at 320.

## Constraints

- UI only; no change to `creationFlow.ts` or `builderTransitions.ts`.
- Copy per CODING_STANDARDS section 8; use the Skill `ui-discipline`. Rows wrap at 320 (section 7).
- Test names and comments carry no ticket numbers or `.scratch` paths.

## Blocked by

None
