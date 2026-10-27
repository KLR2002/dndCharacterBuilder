# 02: Other record kinds saved on the SRD

**Status:** ready-for-agent

Spec: `.scratch/record-lookup-and-releases/spec.md`.

## What to build

Probe the other record kinds a character saves with a source: class, subclass, background and feat entries saved with source "SRD" (or any source the integrated catalog does not carry) against the integrated catalog, and the reverse. Each kind whose sheet already equals the SRD one gets a regression test; each kind that breaks is fixed through the shared lookup from ticket 01 (or the kind's own existing fallback, if one exists, made consistent with it). Report which kinds were already fine and which broke.

## Owns

- AC-4: Other record kinds

## Acceptance Criteria

- [ ] For each of class, subclass, background and feat, a character saved with source "SRD" has the same sheet (proficiencies, features, hit points, spells, skills, choices) under the integrated catalog as under the SRD, or the break is fixed and pinned (AC-4).
- [ ] The report lists each kind as already fine or fixed.
- [ ] `npm run check:all` and `npm run check:live` pass.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-4 | `evaluateCharacter`, `proficiencySheet`, `grantedFeatures`, class and feat readers with real SRD and integrated catalogs | Per-kind tests, red first where broken; `check:live` |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names in tests except where real data is the point (SRD and live-catalog tests). No non-SRD name in app code. The saved source of a character is never rewritten. Notices read "X removed from Y: reason"; no new explanatory copy; layout per CODING_STANDARDS §7. Fix breaks through the shared lookup; do not add per-kind ad hoc name matching. Report before fixing anything that needs more than the lookup.

## Blocked by

01
