# 19: Multiclass proficiencies from the Catalog class

**What to build:** The proficiencies a class grants when taken as a later class are read from the Catalog class's `multiclassing.proficienciesGained` and `MULTICLASS_PROFICIENCIES` is deleted, with ADR 0015's Known exceptions emptied.

**Blocked by:** 13

**Status:** needs-triage

**Open question:** not required for the release gate. The Catalog already carries the field for most classes; check it matches the table for every SRD Baseline and Integrated class before switching, and decide whether this ships before release.

- [ ] `MULTICLASS_PROFICIENCIES` is deleted and the sheet and Builder read the held Catalog class.
- [ ] Multiclass armor and weapon proficiencies are unchanged for existing characters, or change only through a recorder with a reviewed diff.
- [ ] ADR 0015 Known exceptions reads "None remain" and the guard covers the deleted name.
- [ ] `npm run check:all` passes.
