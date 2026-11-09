# 14: Phone bottom sheets

**Status:** done

**Landed:** feat/app-redesign at a7a1e85 (with review repairs R1-R4). Gate PASS: check:all, check:live, layout:check (SRD and integrated), layout:android modals. Evidence: `.scratch/app-redesign/evidence.md`. Open items: see its advisory dispositions.

## What to build

On phones every modal sits as a bottom sheet with a strip of background visible above it, and swiping the sheet down closes it.

## Owns

- AC-29: Phone modals sit as bottom sheets and close on swipe down

## Acceptance Criteria

- [x] AC-29: Phone modals sit as bottom sheets and close on swipe down (spec, AC-29)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-29 | `layout | android` with `ONLY` set to the modal scenarios: swipe down closes the sheet, the background strip is visible |

## Constraints

Native-only behaviour: `docs/agents/driving-the-android-emulator.md`. Shape per map ticket 04's answer: drag handle (also the screen-reader Close), swipe down, tap outside and Android Back close it, no ✕ on phones; at wide widths and on web a centred dialog of at most about 560px with ✕ and Escape.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

10, 04
