# 07: Race card title and background-feat warning

**Status:** done

**Landed:** race cards and their release notices read "High Elf" (subrace with its race); the integrity check skips the Background feat marker and still warns for a really disabled book. check:all, check:live and the full layout runs (SRD and integrated) green. Open: Half-Elf descents read subrace-first ("Drow Descent Half-Elf"); the class-list badge for prepared race spells and the builder trait "High Cantrip" still use the subrace name.

Spec: `.scratch/granted-spells-followups/spec.md` (ADR 0017 and its amendment, GLOSSARY *Always-Prepared Spells*, *Expanded Spell List*).

## What to build

A race card shows its race name with the subrace ("High Elf"), not the subrace alone ("High"). The active-books integrity check no longer warns that a background-claimed feat comes from a disabled sourcebook called "Background".

## Owns

- AC-13: Race card title
- AC-14: No false warning

## Acceptance Criteria

- [x] A High Elf's card title reads "High Elf" (AC-13).
- [x] A background-claimed feat raises no "disabled sourcebook" warning, while a feat from a really disabled book still does (AC-14).
- [x] `npm run check:all` passes; the layout scenario with the race card passes at four widths.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-13 | Spells tab | Test of the title and a viewed layout screenshot |
| AC-14 | The active-books integrity check | Red-then-green test, including the still-warning case |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names and prose in tests. No feat, race or background name in app code. Never hand-edit tracked data; regenerate only with the sanctioned commands. Interface copy is essential mechanics only (CODING_STANDARDS §8); layout per §7.

## Blocked by

None
