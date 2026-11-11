# 08: Level-up plan

**Status:** done

**Landed:** feat/app-redesign at a7a1e85 (with review repairs R1-R4). Gate PASS: check:all, check:live, layout:check (SRD and integrated), layout:android modals. Evidence: `.scratch/app-redesign/evidence.md`. Open items: see its advisory dispositions.

## What to build

A pure rules module that plans one level-up for a chosen class: its steps (Class, Hit Points, Subclass, ASI/Feat, Class Choices, Spells, Review, only those the level brings), the multiclass requirement check for a new class, Hit Points by average or by a roll from an injected random source, and applying a confirmed plan in one Character update. An unapplied plan leaves the Character untouched. No UI yet.

## Owns

- AC-12: Level-up asks only what the level brings
- AC-13: A new class must meet multiclass requirements
- AC-14: Hit Points are rolled or averaged
- AC-15: Nothing applies until Review is confirmed

## Acceptance Criteria

- [x] AC-12: Level-up asks only what the level brings (spec, AC-12)
- [x] AC-13: A new class must meet multiclass requirements (spec, AC-13)
- [x] AC-14: Hit Points are rolled or averaged (spec, AC-14)
- [x] AC-15: Nothing applies until Review is confirmed (spec, AC-15)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-12 | `checks/` test | Fighter 3→4 plans Class, Hit Points, ASI/Feat, Review; Wizard 1→2 plans Class, Hit Points, Subclass, Spells, Review |
| AC-13 | `checks/` test | Wizard refused for a Fighter with Intelligence 12, naming the requirement |
| AC-14 | `checks/` test | d10 and Constitution 14 average adds 8; a seeded roll adds face + 2, minimum 1 |
| AC-15 | `checks/` test | cancelling leaves the Character deep-equal; applying sets the level and every pick |

## Constraints

Apply through the existing `confirmLevelUp`, `addMulticlassLevel`, `applyAsiWithHitPoints` and `validateMulticlass`.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

None
