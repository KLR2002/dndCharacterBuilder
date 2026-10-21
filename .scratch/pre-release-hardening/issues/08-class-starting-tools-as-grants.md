# 08: Class starting tools as grants

**What to build:** A class's starting tools come from Proficiency Grants in the Catalog, for every class in the SRD Baseline and the Integrated Catalog, and the class-name tool chain is deleted. The sheet reads them through the same grant path as every other source.

**Blocked by:** 06

**Status:** done

**Landed:** merged from `pr/08-class-tools` (98342b8). Class starting tools (Rogue, Druid, Artificer, Bard, Monk) are level-1 Proficiency Grants; the class-name tool chain is deleted. The sheet characterization baseline was re-recorded (Artificer rows leave SRD mode and PHB-only integrated mode, since Artificer is not active there; the allowlist emptied because its pairs are now baseline rows). Old chosen-tools class buckets move into proficiency picks on reconcile. Integrated caches without class grants lose starting tools until re-sync, so the catalog format bump in ticket 17 is required.

- [ ] The class-name tool chain and its hand-written entries are deleted from the app.
- [ ] Every class in the SRD Baseline and the Integrated Catalog shows the same starting tools as before on the sheet; the per-source characterization baselines stay green or change only through their recorders with a reviewed diff.
- [ ] Class tool grants that are choices appear as Proficiency Choices ("Picked N / M") like other class choices.
- [ ] Grants come from the scraper's extraction and reviewed overrides; the coverage gate stays green; the data changed only through the enrich step and the prune script.
- [ ] `npm run check:all` passes.
