# 22: Builder and flow overflows at wide widths

**Status:** done

**Landed:** `6f0ea1e` on feat/app-redesign (merge of R2 plus the AGENTS.md note); gate in `evidence.md`, "Ticket 22".

## What to build

`WIDTHS=768,1280 npm run layout:check` reports 13 violations, all in Builder and flow scenarios (for example "Spellcasting Focus sticks out by 13px"). They predate ticket 21, which checked them against `077633e`. The sheet, Home and modal scenarios are green at those widths. Fix each so the Creation Flow, Edit Build and Level-Up Flow steps lay out cleanly at 768 and 1280: nothing sticks out of its card or row, and there is no horizontal scroll. Then make wide widths part of the default layout run so this cannot regress unseen.

## Acceptance Criteria

- [x] `WIDTHS=768,1280 npm run layout:check` and `WIDTHS=768,1280 npm run layout:check -- --integrated` are GREEN
- [x] The default `layout:check` run covers at least one wide width (768 or 1024), or AGENTS.md names the wide run as part of the gate, with its runtime noted
- [x] The phone widths stay GREEN

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| Wide Builder and flows | `layout:check` at 768 and 1280, SRD and integrated | GREEN; screenshots of the Class, Equipment and Spells steps at 1280 reviewed |
| Gate covers wide | `scripts/layout-check.mjs` default `WIDTHS` or AGENTS.md | the wide width in the default run, or the documented command |

## Constraints

Layout rules: `CODING_STANDARDS.md` section 7. Keep the themes; copy carries only essential mechanics. No assertion is weakened to reach green.

Spec: `.scratch/app-redesign/spec.md`. Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules".

## Blocked by

21

## Decision

The design in ticket 04 puts the identity panel on the right at every width from 768px. At 768 that leaves the step 288px, so the panel moves to the right from 1024px (`FLOW_IDENTITY_SIDE_MIN_WIDTH = BREAKPOINTS.desktop`). From 768 to 1023 the footer holds the identity line, which opens the "Character" modal, and the footer reserves the dice button's footprint on its right.
