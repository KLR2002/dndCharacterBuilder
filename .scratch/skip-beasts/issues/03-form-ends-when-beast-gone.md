# 03: A Wild Shape form ends when its beast is gone

**Status:** done
**Landed:** 5860519e (with the Compendium `holdsBeast`). check:all and check:live passed; deleting the release pass failed three tests. Integration gate (final tree 54f74f4e): check:all, check:live, full layout:check (SRD, all widths) and layout:check --integrated at 320 passed.

## What to build

When the active catalog no longer has the beast of the Active Wild Shape (after Revert to SRD, or a catalog that has no such beast), the form ends the way the Revert button ends it, and the character gets a `needsReview` notice naming the beast. This runs in the reconcile step every catalog change and every opened character already goes through. A form whose beast is still there stays, a form whose book is turned off in Active Books stays, and favourite beasts are kept (hidden while unavailable, listed again when the beasts return).

Spec: `.scratch/skip-beasts/spec.md`. Glossary: **Active Wild Shape** (updated).

## Owns

- AC-13: A form whose beast left the catalog ends
- AC-14: A form whose beast is still there stays
- AC-15: Favourite beasts are kept

## Acceptance Criteria

- [x] AC-13: a Druid in the Giant Badger form (source MM) with 5 temporary hit points on the form and a spent Wild Shape use, reconciled against the SRD Baseline (revert) or an Integrated Catalog without that beast, loses the form like Revert: the form's temporary hit points go back to the character (the larger of the two), the character's hit points and the spent use are unchanged, and `needsReview` gains a notice naming the beast.
- [x] AC-14: a form of an SRD-sourced Brown Bear stays, with no notice, against an Integrated Catalog that prints Brown Bear under another source, and against an Integrated Catalog without beasts (the SRD beasts remain). A form of a beast whose book is turned off in Active Books stays too.
- [x] AC-15: a favourite MM beast stays in `favoriteWildShapes` after the catalog changes to one without it, is not in the listing, and is in the listing again when a catalog with the beast is active.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-13 | the reconcile step run on a catalog change (`reconcileForActiveBooks`) | red-green test with literal HP, temporary HP and counters before and after, and the notice text; one case per catalog (SRD Baseline, Integrated Catalog without beasts, Integrated Catalog with other beasts) |
| AC-14 | the same | negative cases: SRD-sourced Brown Bear against an integrated bundle whose Brown Bear has source MM; the same form against an integrated bundle with no beasts; an MM form with MM absent from the active books |
| AC-15 | the reconcile step and the Compendium listing (`for(books).beasts()`) | red-green test on the saved favourites and the listing before and after |
| Wiring | the release pass in the reconcile step | mutation check: delete the release pass and the AC-13 test fails |

`npm run check:all` passes; both the SRD Baseline and an integrated catalog are exercised (CODING_STANDARDS section 4).

## Constraints

- The release lives in `reconcile` (CODING_STANDARDS section 3, "Releases Live in the Reconciler"); no transition calls it. It reuses the existing Revert behaviour and appends its notice the way other releases do.
- "The beast is gone": no beast of that name and source in the active catalog's listing, or, when the saved source is `SRD`, no beast of that name (the Integrated Catalog drops SRD-sourced records and prints them under another book, so `findBeast(name, "SRD")` fails there today). It never reads Active Books.
- Changes no data and no UI. The Wild Shape Revert button, damage and temporary hit point rules are untouched.

## Blocked by

None
