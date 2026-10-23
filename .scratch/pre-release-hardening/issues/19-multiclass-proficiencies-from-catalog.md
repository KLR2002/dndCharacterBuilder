# 19: Multiclass proficiencies from the Catalog class

**What to build:** The proficiencies a class grants when taken as a later class are read from the Catalog class's `multiclassing.proficienciesGained` and `MULTICLASS_PROFICIENCIES` is deleted, with ADR 0015's Known exceptions emptied.

**Blocked by:** 13

**Status:** done

**Landed:** merged from `pr/19-multiclass-catalog` (80b7602). `check:all` passes (1106 app tests, 144 scraper tests, 322 known type errors none new), scraper type check clean, no UI change. `MULTICLASS_PROFICIENCIES` is deleted; a later class's armor, weapons, tools and skill choice come from the held Catalog class's `multiclassing.proficienciesGained` (name and source, SRD Baseline fallback), read only by the sheet; the guard covers the deleted name and the field; ADR 0015 Known exceptions reads "None remain". Table vs Catalog before the change: identical armor, weapons and tools for all 13 classes in both catalogs (format-only differences); the Catalog gives Ranger one skill from eight where the table had none (matches the 2014 multiclass rule); Sorcerer, Wizard, Mystic and the sidekicks grant nothing in both. Sheets for existing characters are identical in all 29 scenarios, old vs new; no baseline or allowlist changed. New multiclass records no longer store the unread skills text. Open items: Mystic and the sidekicks grant nothing when taken as a later class; the scraper's own `models.ts` still types multiclass armor as `string[]`; ticket 14's open item (first class base armor and weapons read active-book classes only) remains.

**Decision:** the owner asked for this to be finished. The Catalog already carries the field for most classes; check it matches the table for every SRD Baseline and Integrated class before switching, and decide whether this ships before release.

- [x] `MULTICLASS_PROFICIENCIES` is deleted and the sheet and Builder read the held Catalog class.
- [x] Multiclass armor and weapon proficiencies are unchanged for existing characters, or change only through a recorder with a reviewed diff.
- [x] ADR 0015 Known exceptions reads "None remain" and the guard covers the deleted name.
- [x] `npm run check:all` passes.
