# 08: Stable record identity for feats and race picks

**Status:** done

**Landed:** a background-claimed feat resolves by active book, then the background's book, then catalog order; race picks are keyed by race and subrace (not source) and saves under the old key move on load. check:all and check:live green. Open: speed, traits and ancestry readers still match the saved race by source, so a character saved on the SRD Baseline may show wrong speed or traits after an integrated sync (not verified in the app).

Spec: `.scratch/granted-spells-followups/spec.md` (ADR 0017 and its amendment, GLOSSARY *Always-Prepared Spells*, *Expanded Spell List*).

## What to build

A background-claimed feat that exists in two books resolves deterministically (an active book first, then the background's own book, then catalog order), so its picks stay stable across loads. A race pick made on the SRD Baseline stands after the integrated catalog is synced, with no release and no notice.

## Owns

- AC-15: Duplicate feat names
- AC-16: Race picks across catalogs

## Acceptance Criteria

- [x] With the same feat in two books, a background claim resolves per the stated order and the same record on every load (AC-15).
- [x] A High Elf cantrip picked on the SRD Baseline survives syncing the integrated catalog, with no release and no notice (AC-16).
- [x] `npm run check:all` and `npm run check:live` pass.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-15 | Feat resolution, invented catalog with duplicate records | Red-then-green test of order and stability |
| AC-16 | Character load and catalog switch, invented catalogs | Red-then-green test: pick kept, no notice |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names and prose in tests. No feat, race or background name in app code. Never hand-edit tracked data; regenerate only with the sanctioned commands. Interface copy is essential mechanics only (CODING_STANDARDS §8); layout per §7. Saved picks from the earlier key scheme still load.

## Blocked by

06
