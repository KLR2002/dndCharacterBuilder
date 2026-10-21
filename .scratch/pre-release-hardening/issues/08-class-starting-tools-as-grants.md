# 08: Class starting tools as grants

**What to build:** A class's starting tools come from Proficiency Grants in the Catalog, for every class in the SRD Baseline and the Integrated Catalog, and the class-name tool chain is deleted. The sheet reads them through the same grant path as every other source.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] The class-name tool chain and its hand-written entries are deleted from the app.
- [ ] Every class in the SRD Baseline and the Integrated Catalog shows the same starting tools as before on the sheet; the per-source characterization baselines stay green or change only through their recorders with a reviewed diff.
- [ ] Class tool grants that are choices appear as Proficiency Choices ("Picked N / M") like other class choices.
- [ ] Grants come from the scraper's extraction and reviewed overrides; the coverage gate stays green; the data changed only through the enrich step and the prune script.
- [ ] `npm run check:all` passes.
