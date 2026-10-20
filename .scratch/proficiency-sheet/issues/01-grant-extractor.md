# 01: The scraper extracts Proficiency Grants from feature prose

**What to build:** The scraper gives every class feature, subclass feature and feat structured Proficiency Grants for the six categories (skills, tools, languages, weapons, armor, saving throws), extracted from clear sentences, plus an override file for hand-reviewed grants. A grant is fixed (a list of names) or a Proficiency Choice (a count plus a pool: a list of names, or a rule such as "any simple or martial weapon without the heavy or special property, plus the longbow"), and carries a stable id built from source, owner, feature name and position. Race and background grants already have structured fields and are read into the same shape. Class base proficiencies are read into the same shape from the class data the Catalog already carries. The app does not read the grants yet and the catalog format number is unchanged. Do not try to cover every feature here; the review ticket does that. The extractor's job is the clear sentences ("You gain proficiency with…", "your choice of A or B", "you learn N languages of your choice", "Bonus Proficiency/Proficiencies"), and it must report what it could not parse.

**Blocked by:** None (can start immediately)

**Status:** done
**Landed:** 98a427b, check:all passed (811 app, 52 scraper). The extractor covered 35 features; the rest went to the review ticket.

- [x] The scraped catalog carries `grants` on class features, subclass features and feats where the extractor is confident, and nothing on features it cannot parse.
- [x] The extractor reports the features whose prose matches the proficiency vocabulary but that it could not turn into grants (a list, not a failure).
- [x] The override file is read by the scraper and its entries are merged into the output; an entry for an unknown feature is an error.
- [x] Grant ids are stable across repeated scrapes of the same data.
- [x] Extractor tests use invented sentences, never real 5e prose, and cover each category, fixed grants, choices with a name pool, choices with a rule pool, and the "could not parse" report.
- [x] `dnd5eToolsScrap` tests and `npm run check:all` pass; `src/data/` and the tracked `dnd5eToolsScrap/data/` files are not edited by hand.
