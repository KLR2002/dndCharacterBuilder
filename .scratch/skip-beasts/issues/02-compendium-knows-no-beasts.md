# 02: The Compendium knows when the catalog has no beasts

**Status:** ready-for-agent

## What to build

The Compendium answers one extra read-only question: does the Integrated Catalog hold beasts? It does not when the saved catalog's `beasts` collection is empty or absent. The existing fallback stays: with no beasts of its own, `beasts()` lists the SRD Baseline's 92. The SRD Baseline itself never answers "no beasts" (the question is about an Integrated Catalog, and the download it drives is never offered on the SRD Baseline).

Spec: `.scratch/skip-beasts/spec.md`.

## Owns

- AC-6: The Compendium knows when the Integrated Catalog has no beasts

## Acceptance Criteria

- [ ] AC-6: for an Integrated Catalog saved with no beasts, the Compendium answers that the catalog holds no beasts and `beasts()` lists the 92 SRD beasts; for an Integrated Catalog with beasts it answers that it does; for the SRD Baseline it answers that it does not lack beasts (no download is offered there).

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6 | the Compendium factory | red-green test with three bundles: integrated with `beasts: []` (the answer, and 92 SRD beasts from `beasts()`), integrated with beasts, and the SRD Baseline; also an integrated bundle with `beasts` absent. Literal expected counts |

`npm run check:all` passes.

## Constraints

- No flag is stored in the catalog: the empty collection is the truth. This is also what a sync that lost every bestiary file saves.
- The UI asks the Compendium; it never reads the saved bundle.
- The answer is a name in the glossary's language (the catalog holds no beasts); no Catalog Format bump.

## Blocked by

None
