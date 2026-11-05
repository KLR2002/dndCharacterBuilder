# 05: Ancestry picker rows and race card summaries show the choices

**Status:** ready-for-agent

Spec: `.scratch/race-ability-choices/spec.md`. ADR 0019. CODING_STANDARDS §7 and §8.

## What to build

The Builder's Ancestry section shows one picker row per offered Increase Choice, with today's wording and buttons for the offered scores only. The race and subrace cards in the race picker summarize Fixed Increases and choices in one line.

## Owns

- AC-18: One picker row per choice
- AC-19: The race card summary names the choices

## Acceptance Criteria

- [ ] AC-18: for a held SCAG Tiefling variant the section shows one row `Choose +2 to 1 ability score (0/1 chosen)` with DEX and CHA buttons (all six minus blocked scores with Origin Customization available); tapping CHA shows `(1/1 chosen)`; no other text is added; the row fits at 320, 360, 393 and 412 px.
- [ ] AC-19: the cards read `INT +1, +2 DEX or CHA` (SCAG variant), `CHA +2, +1 to 2 others` (Half-Elf), `+1 to 2 scores` (Variant Human); a replacing subrace's card shows only its own increases. "others" when the pool is every score but the fixed ones, "scores" when it is all six, otherwise the pool joined with "or".

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-18 | `npm run layout:check -- --integrated` with a new SCAG Tiefling scenario (`ONLY=` selectable); a browser look per `docs/agents/driving-the-app.md` | Green layout run at all widths; screenshot or snapshot of the row before and after a tap |
| AC-19 | The exported summary formatter | Red-green test output |

## Constraints

- Call the `ui-discipline` skill. Copy only as stated; no help text.
- The rows read the offers from ticket 03; do not recompute pools in the component.
- Layout rules: CODING_STANDARDS §7 (rows wrap or shrink).

## Blocked by

03
