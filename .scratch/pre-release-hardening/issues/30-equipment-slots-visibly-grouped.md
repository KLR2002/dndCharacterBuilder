# 30: The equipment card groups each slot visibly

**What to build:** Owner feedback on ticket 29: it works, but the slots run together (every option is the same row, separated only by a little spacing), so it is unclear which options belong to one choice. Make each slot a visibly separate group in `src/components/builder/StartingEquipmentChoices.tsx`. This is a visual change only; no rules or data change.

**Blocked by:** None

**Status:** ready-for-agent

## Design notes

- Each choice slot renders as its own group: a rounded container with a border and a slightly tinted background (use theme tokens, as the neighbouring builder cards do), padding, and a small header line `Choice N of M` (N counts the choice slots only, M is how many there are). A completed slot shows a small check icon at the end of its header in the accent colour.
- Between the options of one slot show a small muted `or` divider (a hairline with the word, centred or left aligned), so the options read as alternatives. The options stay the existing radio rows.
- A fixed slot (items always granted) renders as one group with the header `Included` listing its items. An `unrecognised` slot keeps its current line, inside a group.
- The gap between groups is clearly larger than the gap inside a group. Nothing else changes: the pickers under a chosen option, the labels, the radio behaviour.
- Interface copy is essential mechanics only (`CODING_STANDARDS.md` section 8): the three strings above and nothing more. Layout rules are section 7: groups wrap and fit at 320 px, no horizontal overflow, touch targets as now.
- The existing layout scenarios for the equipment card (Fighter slots, picked, picker open, Cleric with and without a domain) already cover the card: run `npm run layout:check` and `npm run layout:check -- --integrated`, view the 320 px Fighter and the picker-open screenshots yourself and describe what you saw. Extend a scenario only if the new header or divider needs a check it lacks.

## Acceptance criteria

- [ ] Each choice slot is its own bordered group with a `Choice N of M` header; options within a slot are separated by `or`; fixed items sit in an `Included` group.
- [ ] A completed slot is marked with a check.
- [ ] No horizontal overflow at 320, 360, 393 and 412 px in both catalog modes.
- [ ] `npm run check:all`, `npm run layout:check` and `npm run layout:check -- --integrated` pass.
