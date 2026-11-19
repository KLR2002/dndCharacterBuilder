# Spec: The SRD Baseline stays SRD

**Status:** done (full layout gate pending, run with `.scratch/book-admission/`)

Grown from quick fix 06 (`.scratch/quick-fixes-nov-2026/issues/06-prune-to-srd-keeps-the-baseline.md`). Decided with the user on 2026-11-19.

## Problem

`node scripts/prune-to-srd.mjs` builds `src/data/*.json` from the scraper's PHB records. A full run on today's data changes only `classes.json` (and the bullet spacing of Grappler's text in `feats.json`). It would bring in:

- **Class descriptions:** each class gets its PHB intro prose, which is non-SRD (ADR 0014). The baseline has `""` today.
- **Ranger Hunter:** the scraper folds the Hunter's options into one pick per tier:
  - Hunter's Prey at 3
  - Defensive Tactics at 7
  - Multiattack at 11
  - Superior Hunter's Defense at 15

  The options keep their `"PHB"` source. Today's SRD Hunter lists all three options of each tier as separate features, which is wrong: the SRD Hunter chooses one. `checks/featureOptionsDescription.test.ts` asserts that no SRD feature has `choices`.
- **Circle of the Land:** gets a `spellChoice`. The app already derives the same terrain pick from `additionalSpells` (`src/rules/subclassChoiceTable.ts` ~479).
- **Way of the Open Hand:** `additionalSpells[0]` gets `ability: "wis"`.

**Non-SRD names, independent of the run:** the baseline already carries 17 spells and 14 magic items under names the SRD leaves out, such as "Melf's Acid Arrow" ("Acid Arrow" in the SRD) and "Heward's Handy Haversack" ("Handy Haversack"). The 5etools record gives the SRD name as a string in its `srd` field, and the prune ignores it. The names also appear inside other records: Circle of the Land's Swamp spells list `"Melf's acid arrow"`. v2.1.1 is released, so saved characters may hold these names with source `"SRD"`.

## Decisions

1. **The prune takes the scraper's shape, minus non-SRD text.**
   - Class descriptions become `""`.
   - Folded options are kept. Every option in a `choices` or `spellChoice` gets source `"SRD"`, so the SRD Hunter chooses one option per tier.
   - Existing SRD Hunters get pending picks.
2. **SRD names.**
   - The scraper records `srdName` on spell and item records whose 5etools `srd` field is a string.
   - The prune names the SRD records by it and rewrites every reference to the old name inside `src/data`.
   - No old name stays anywhere in `src/`.
3. **Saved characters are renamed from catalog data, not from a table in code.**
   - The migration runs when a character loads with an Integrated Catalog.
   - It renames a saved spell or item with source `"SRD"` whose name matches a catalog record carrying `srdName`.
   - Without an Integrated Catalog, the old name stays: the spell or item is kept and shown by name, without details, until the player syncs.
   - The Catalog Format is not raised: an older catalog has no `srdName`, so it renames nothing.
   - The Compendium's `findSpell` and `findItem` also match `srdName` for an SRD-sourced or unsourced name, because an Integrated Catalog keeps the PHB name. Added in review on 2026-11-19.

## Tickets

1. `issues/01-prune-keeps-srd-class-shape.md`
2. `issues/02-srd-names.md`
