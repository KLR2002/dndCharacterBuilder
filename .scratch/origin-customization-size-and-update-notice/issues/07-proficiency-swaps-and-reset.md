# 07: Proficiency swaps and Reset

**Status:** done
**Landed:** e8add7e, reviewer findings repaired in 5a3fb1d, a9e256d and 8b8c4fc; gate passed on the final tree; open items: none

Spec: `../spec.md` (decisions Q6, Q13 to Q15, Q18, and the race-only rule).

## What to build

On the open card, each fixed skill, tool, weapon or armor grant of the race or subrace, and the picked value of a choice with a narrower pool (such as one of three tools), can be replaced by what the `originRules` swap table allows for its row. Weapons are classified simple or martial through the Compendium items; a grant the Compendium cannot classify offers no swap. Choices over an "any" pool offer none. Only Race and Subrace grants are ever offered or changed: a background, class, subclass or feat that grants the same name is untouched. Saved swaps follow the same lifecycle as language swaps. A "Reset" button returns every swap on the card (ability, language, proficiency) to its default.

## Owns

- AC-14: Proficiency swaps
- AC-15: Race only
- AC-16: Proficiency swap lifecycle and reset

## Acceptance Criteria

- [x] AC-14: each table row limits the replacements as the Catalog states; the sheet holds the replacement instead of the original; unclassifiable weapons and "any" choices offer none.
- [x] AC-15: a same-named grant from a background, class, subclass or feat is untouched and offers no swap.
- [x] AC-16: TCE off keeps and ignores; race change releases with a notice; a conflicting replacement is dropped with a notice; a default-equal swap is not stored; "Reset" restores every default.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-14, AC-15 | `proficiencySheet` | red-green tests per table row, narrower choice, unclassifiable weapon, same name in a background |
| AC-16 | `proficiencySheet`, `reconcile` and the card | red-green tests for the lifecycle; browser run of Reset |
| AC-14 to AC-16 | the guard and the live catalog | `checks/proficiencyReadersGuard.test.ts` unchanged; `npm run check:live` |

## Constraints

Reuse ticket 06's swap mechanism. No non-SRD rule text in code: the table rows come from the Catalog. Tests use invented rows and names. Run `npm run layout:check` in both modes.

## Blocked by

04, 06
