# 06: Language swaps

**Status:** done
**Landed:** a6a7d39, reviewer findings repaired in a9e256d and 8b8c4fc; gate passed on the final tree; open items: none

Spec: `../spec.md` (decisions Q9, Q13, Q14, Q18, Q20).

## What to build

On the open card, each fixed language a race or subrace grants (Standard Human's Common included) can be replaced by another language from the SRD languages the character does not already hold. A swap is a Proficiency Choice on the Race or Subrace feature, saved under `proficiencyPicks`, with its default being the original; the Proficiency Sheet holds the replacement and not the original. Choices over an "any" pool offer no swap. Saved swaps are kept and ignored when TCE is off, released with a notice on a race change, dropped with a notice when another source now grants the replacement, and not stored when equal to the default.

## Owns

- AC-12: Language swaps
- AC-13: Language swap lifecycle

## Acceptance Criteria

- [x] AC-12: replacement lands on the sheet and the original leaves it; pool excludes held languages; Standard Human is swappable; "any" choices offer none.
- [x] AC-13: TCE off keeps and ignores; race change releases with a notice; a conflicting replacement is dropped with a notice; a default-equal swap is not stored.
- [x] A background, class, subclass or feat language is never offered for a swap.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-12, AC-13 | `proficiencySheet` and `reconcile` | red-green tests per case; reconcile is idempotent |
| AC-12 | the guard | `checks/proficiencyReadersGuard.test.ts` passes unchanged |
| AC-12 | the card | browser run: swap a language, sheet changes; `npm run layout:check` |

## Constraints

The Proficiency Sheet stays the only reader of race proficiency fields (ADR 0015). The language pool is the SRD list already in the app. Build the swap mechanism (synthetic choice, ids derived from the grant id and the name) so ticket 07 reuses it. Pick-count and race-language fallback to Common must stay correct when Common is swapped out.

## Blocked by

05
