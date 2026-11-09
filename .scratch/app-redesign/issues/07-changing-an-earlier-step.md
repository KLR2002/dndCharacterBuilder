# 07: Changing an earlier Creation Step

**Status:** done

**Landed:** feat/app-redesign at a7a1e85 (with review repairs R1-R4). Gate PASS: check:all, check:live, layout:check (SRD and integrated), layout:android modals. Evidence: `.scratch/app-redesign/evidence.md`. Open items: see its advisory dispositions.

## What to build

Changing an earlier step's pick (the class above all) releases every later pick it invalidates through `builderTransitions` and the Character Reconciler, and marks those steps as needing attention until they are finished again; unaffected picks (race, background, abilities) are kept.

## Owns

- AC-4: Changing an earlier step releases what it invalidates

## Acceptance Criteria

- [x] AC-4: Changing an earlier step releases what it invalidates (spec, AC-4)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-4 | `checks/` test | changing a finished Fighter to Rogue releases class skills, Class Choices, out-of-range ASI/Feats and starting equipment, keeps race, background and abilities, and flags the steps. Mutation check: delete each release or flag line and see a test fail |

## Constraints

No second release path: reuse existing transitions and the Reconciler.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

06
