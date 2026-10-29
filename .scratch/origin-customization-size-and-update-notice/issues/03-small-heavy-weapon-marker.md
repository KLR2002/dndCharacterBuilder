# 03: Heavy-weapon marker for Small characters

**Status:** ready-for-agent

Spec: `../spec.md` (decisions Q5, Q24).

## What to build

An attack made with a Heavy-property weapon carries a short disadvantage marker when the character's resolved size is Small, whether the size was picked or is the only size the race lists (so a Halfling gets it). A Medium character, and a character with no race, get none. The label is short and carries no explanation.

## Owns

- AC-6: Small and Heavy weapons

## Acceptance Criteria

- [ ] AC-6: Small (picked) with a Heavy weapon shows the marker; Small by a single-size race shows it; Medium and no race show none; a non-Heavy weapon shows none.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6 | the weapon attack builder and the resolved size | red-green tests for the four cases above |
| AC-6 | the attacks list | browser run and `npm run layout:check` |

## Constraints

Read the resolved size from the function ticket 02 adds; do not re-derive it. Read the Heavy property from the weapon data, not from names.

## Blocked by

02
