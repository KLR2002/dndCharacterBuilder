# 05: Elemental Disciplines from option records

**What to build:** The four Elemental Discipline rows (3rd, 6th, 11th, 17th level) read the catalog's `ED` option records, with each discipline's unlock level taken from its structured prerequisite. Elemental Attunement is excluded because it is granted, not chosen. A names-only alias table resolves old saved pick names ("Fist of Unbroken Air" to "Unbroken Air") wherever a saved pick is matched to an option. The ki-cost spell map becomes a curated name-and-number table with a completeness test.

**Blocked by:** 02

**Status:** done

**Landed:** merge `f7adbe8`. `npm run check:all` passed after the merge (707 app tests, 26 scraper tests).

- [x] Offered disciplines for each of the four rows come from the `ED` records and respect the level prerequisite; Elemental Attunement is never offered
- [x] A saved pick named "Fist of Unbroken Air" still resolves, and a test checks every option name the old table offered resolves directly or by alias
- [x] Frozen ids and the cumulative option sets per level are unchanged
- [x] The hand-written discipline lists no longer exist; the ki-cost table has a test that fails when a catalog discipline has no entry
- [x] Dual-Mode and negative tests exist at the Rule Choice interface seam
- [x] Existing suite and characterization scenarios pass (`npm run check:all`)
