# 05: Customize origin card and ability swaps

**Status:** ready-for-agent

Spec: `../spec.md` (decisions Q7, Q8, Q10 to Q12, Q17, Q18; GLOSSARY *Origin Customization*, *Origin Swap*).

## What to build

When TCE is active, the Catalog has `originRules`, and the held race or subrace has an ability score increase, the Ancestry section shows a collapsed "Customize origin" card with every swap at its default (no count of active swaps). Its ability part shows each of the race's increases at its current score, taken from race data. The player moves an increase to another score; all increases (including a Half-Elf's fixed one beside its chosen +1s) must land on different scores, and a target is blocked when base plus the increase would exceed 20. A race whose increases cover all six scores has no ability part. Effective ability scores show the moves. Saved swaps are kept and not applied when TCE is off; a race change releases them with a notice; a swap equal to its default is not stored. `CollapsibleCard` gains a `defaultExpanded` prop.

## Owns

- AC-9: Card availability
- AC-10: Ability swaps
- AC-11: Ability swap lifecycle

## Acceptance Criteria

- [ ] AC-9: card present and collapsed under the stated gating; absent without TCE, without `originRules`, or without a race ability increase.
- [ ] AC-10: moves, distinctness, the 20 cap and the all-six exclusion behave as stated; amounts and slots come from race data; no race name or amount is written in code.
- [ ] AC-11: TCE off keeps and ignores swaps; race change releases with a notice; default-equal swaps are not stored.
- [ ] `CollapsibleCard` default behavior (open) is unchanged for existing callers.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-9 | an availability function | red-green tests for each gating condition |
| AC-10, AC-11 | effective ability scores and the swap transition | red-green tests: Dwarf-like fixed increases, Half-Elf-like fixed plus chosen, duplicate target, cap, all-six, TCE off, race change |
| AC-9 | the Ancestry section | `npm run layout:check` in both modes shows the card collapsed; browser run |

## Constraints

New optional character field; no per-character flag. Reconciler stays idempotent. Dual-mode invariant. The Proficiency Sheet is not touched here. Tests and fixtures use invented races and names. Run `npm run check:live` since this reads Catalog records.

## Blocked by

04
