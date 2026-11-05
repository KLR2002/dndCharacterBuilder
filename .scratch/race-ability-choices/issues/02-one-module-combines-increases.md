# 02: One module combines race and subrace increases

**Status:** ready-for-agent

Spec: `.scratch/race-ability-choices/spec.md`. ADR 0019, ADR 0018. GLOSSARY: *Fixed Increase*, *Origin Swap*.

## What to build

A new rules module is the single place that combines a held race's and subrace's Fixed Increases: a subrace that replaces its race's increases gives only its own, otherwise both add up. The Effective Ability Scores, the Origin Customization slots and the derived racial bonuses all read through it, so an MTF Tiefling stops at CHA +2 and a SCAG variant gets INT +1 only (its choice arrives in ticket 03). A guard test keeps every other reader out.

## Owns

- AC-6: A replacing subrace gives only its own increases
- AC-7: A replacing subrace's choice applies with its fixed increase
- AC-8: A non-replacing subrace still adds to its race
- Guard: one combining module

## Acceptance Criteria

- [ ] AC-6: a held replacing subrace with fixed DEX 1, CHA 2 on base 10s gives DEX 11, CHA 12, INT 10.
- [ ] AC-7: a replacing subrace with fixed INT 1 and a +2 DEX-or-CHA choice gives INT 11 and nothing else with no pick; with a saved CHA pick, INT 11 and CHA 12.
- [ ] AC-8: Hill Dwarf (race CON 2, subrace WIS 1) still gives CON 12, WIS 11.
- [ ] Guard: a test in `checks/` fails when any file under `src/` other than the new module reads a race's or subrace's `abilityScoreIncrease` (feat records are exempt). Show it failing on a planted read, then remove the plant.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6, AC-7, AC-8 | `effectiveScores` with `makeChar()` and an invented test catalog; for AC-7's pick, a saved `racialChoiceBonus` entry run through `reconcile()` | Red-green test output |
| Guard | Guard test modeled on `checks/proficiencyReadersGuard.test.ts` | Fails on a planted read |
| Origin slot ids unchanged for non-replacing races | Existing origin customization tests | `npm run check:all` green |

## Constraints

- The module is `src/rules/ancestryIncreases.ts` (named in the spec). Its interface returns the Fixed Increases with their owner (race or subrace) and position, so `originCustomization.ts` keeps building today's slot ids from it.
- Readers that move to it: `abilities.ts` (`effectiveScores` fallback), `ancestryEngine.ts` (`collectFixedBonuses`), `originCustomization.ts` (slots), and the race card summary in `AncestrySection.tsx` (read through the module; its text does not change in this ticket).
- Do not touch the choice picker, the name checks or pick storage: that is ticket 03.
- No non-SRD names in `src/`; tests use invented names.

## Blocked by

01
