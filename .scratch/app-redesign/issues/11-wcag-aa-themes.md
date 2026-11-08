# 11: WCAG AA themes

**Status:** ready-for-agent

## What to build

An automated contrast check over every accent palette combined with the base theme, and the palettes and base tokens set to the values in map ticket 04's answer (two tones per accent: fill with its label, and a brighter ink; `textMuted` and `danger` raised), so the check passes.

## Owns

- AC-27: Every accent meets WCAG AA

## Acceptance Criteria

- [ ] AC-27: Every accent meets WCAG AA (spec, AC-27)

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-27 | `checks/` test computing WCAG ratios from the theme tokens for every accent | on all four background levels, text, secondary, muted, the four status colours and the ink reach 4.5:1; the label on the fill reaches 4.5:1 |

## Constraints

Tokens stay in `src/constants/theme.ts`; the check reads them there. Values: map ticket 04's answer (`issues/04-visual-system.md`). Components that showed `accent` as text or a selection border move to the ink (`accentHover` today, from `secondary`); filled buttons keep `accent` with `accentText`. Check the changed screens with `npm run layout:check`.

Spec: `.scratch/app-redesign/spec.md` (Architecture Constraints apply in full). Implementer rules: `docs/agents/subagent-tiering.md`, "Implementer Rules". Terms: `GLOSSARY.md`, "Building and rolling". No non-SRD content in `src/` (ADR 0014); interface copy carries only essential mechanics (`CODING_STANDARDS.md` section 8).

## Blocked by

04
