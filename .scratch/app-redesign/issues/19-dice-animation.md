# 19: Dice animation

**Status:** done

**Landed:** feat/app-redesign at cf714f8 (with review repairs R5a, R5b, R6-R9). Gate PASS: check:all, check:live, layout:check (SRD and integrated), layout:android (dice, modal, Actions, Stats, Level-Up Flow scenarios). Evidence: `.scratch/app-redesign/evidence.md`, "Tickets 15-19". Open items: see its advisory dispositions.

## What to build

Rolls show 2.5D dice (Reanimated transforms over View and SVG faces) in the current accent, landing on the Roll's faces after the text total is already shown; a Settings switch turns them off, and with no saved setting they are off when the system asks for reduced motion.

## Owns

- AC-25: The result never waits for the dice
- AC-26: 3D dice can be switched off

## Acceptance Criteria

- [x] AC-25: The result never waits for the dice (spec, AC-25)
- [x] AC-26: 3D dice can be switched off (spec, AC-26)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-25 | Browser check | the text total appears before the animation ends and the faces shown match the Roll; dice take the accent colour |
| AC-26 | Browser check | with the setting off, or reduced motion emulated and no setting saved, no animation runs and the text appears at once |

## Constraints

Technique from map ticket 02 (`issues/02-dice-rendering-technique.md`). The renderer sits behind one component interface and is not loaded while dice are off; the setting sits with the other app options. Report the bundle delta from `npx expo export`; confirm Reanimated 4.5.1 against the SDK 57 library list.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

15
