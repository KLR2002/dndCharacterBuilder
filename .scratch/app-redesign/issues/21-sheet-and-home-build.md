# 21: Character sheet and Home restyle

**Status:** ready-for-agent

## What to build

The character sheet and the Home list in the visual system of ticket 04, as the owner picked in ticket 20 ("Answer"; prototype on branch `prototype/sheet-home`, route `/prototype-sheet-home`, screenshots in `.scratch/app-redesign/prototype-20/` on that branch).

- Sheet on phones (under 768px): one bottom bar with all six tabs in the prototype's order (Stats, Actions, Spells, Inventory, Features, Journal) and no More menu; one compact header bar: back, the name over the race and class line, the HP and AC badges, and a menu holding Level up and Edit Build. The separate Level up / Edit Build strip goes; Take Rest and Conditions sit at the top of Stats as in the prototype.
- Sheet at 768px and up: a slim header (back, name and line, HP and AC) and a left rail with the tabs and, below a divider, Level up and Edit Build; the tab content in two columns (Stats as the representative tab, split as in the prototype; every other tab at least centred and width-capped, never a stretched single column).
- Home: a list on phones, a grid at wide widths. Each entry keeps the person icon, the row buttons and the Lvl badge; the HP badge goes. Drafts read "Draft · <step>".
- The floating dice button and the result card sit above the phone bottom bar, never over a tab (as in the flows: `setBottomObstruction`).
- Fold in the deferred advisories: the Level up / Edit Build strip height, the header sub-line truncation at 320px, the Stats row height, rule-restating captions in the older tabs ("Level + INT mod", "Str x 15"), the remaining accent fills on the switch track.

## Owns

No spec criterion of its own; it carries the spec's wide-screen rule ("sheet looks terrible at wider screen") and ticket 04's visual system to the sheet and Home.

## Acceptance Criteria

- [ ] At 320, 360, 393 and 412px the six tabs fit one bottom bar with labels readable and 48dp targets, and the header is one bar
- [ ] At 768 and 1280px the sheet shows the left rail with the tabs and header actions, and Stats in two columns, with no horizontal scroll
- [ ] Home shows a list on phones and a grid at 768px and up; entries carry no HP badge
- [ ] The dice button never covers the bottom bar or a tab
- [ ] Every existing sheet, Home and modal scenario stays green on web and Android

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| Phone tabs and header | `layout:check` | the existing sheet scenarios at the four widths, plus assertions: six tab targets in one bar, each at least 48dp, no truncated label |
| Wide sheet | `WIDTHS=768,1280 npm run layout:check` | rail present, two columns on Stats, no horizontal scroll; screenshots reviewed |
| Home | `layout:check` | list at phone widths, grid at 768 and 1280, no HP badge |
| Dice button | `layout:check` "Dice button on sheet" | button bottom above the bar top |
| Native | `layout:android` with `ONLY` set to the sheet tabs, Home and modal scenarios | green; the runner's tab-finding follows the new bar |

## Constraints

Keep the existing themes and accents (ticket 04). Interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8). Layout rules: `CODING_STANDARDS.md` section 7. The prototype route is thrown away, not merged.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`. No non-SRD content in `src/` (ADR 0014).

## Blocked by

20, 15
