# 06: `prune-to-srd` would rewrite the SRD classes with non-SRD text

**What to build:** `node scripts/prune-to-srd.mjs` rebuilds `src/data/classes.json` from the scraper's whole PHB class records. Since the scraper reads class fluff (quick fix 01) and folds subclass options into `choices`, a run now brings into the SRD Baseline:
- the PHB class descriptions, which are non-SRD text (ADR 0014)
- folded choices on the Ranger's Hunter features, which `checks/featureOptionsDescription.test.ts` ("SRD features render unchanged, with no folded options") forbids
- a `spellChoice` on Circle of the Land
- `additionalSpells` on Way of the Open Hand

Spell-counts ticket 01 avoided it by copying only the count fields (111d16e). Make the prune keep the baseline's form: drop `description` from classes, and drop feature `choices` and the subclass fields the baseline does not carry. Or have it copy an explicit list of fields. A run on today's data must then leave `src/data/classes.json` unchanged, apart from what the scraper truly adds.

**Blocked by:** None

**Status:** done

**Landed:** moved to `.scratch/srd-baseline-stays-srd/` (2026-11-19), which also renames the SRD records the baseline carries under non-SRD names.
