# 10: Race and background skills as grants

**What to build:** Race and background skill proficiencies come from Proficiency Grants and the hand tables of them are deleted, including the static-table fallback the Expertise-follows-books work noted. A background from a disabled book no longer keeps its skill through a static table.

**Blocked by:** 09

**Status:** done

**Landed:** merged from `pr/10-race-bg-skills` (75b5c4f). `check:all` passes (1051 app tests, 127 scraper tests, 322 known type errors none new), scraper type check clean, no UI change. Fixed race, subrace and background skills are Proficiency Grants; the race and background skill tables are deleted; background skills are no longer written to `chosenSkills`; `legacyBackgroundSkills.ts` drops bucket copies of an inactive background. Skills baseline re-recorded: in the SRD Baseline 522 rows lose skills from backgrounds it does not hold (the static fallback is gone, as the ticket requires), 100 integrated rows gain skills (previously allowlisted pairs, now baseline rows, allowlist emptied), no integrated row loses a skill. Sheet diff vs ticket start: 6 gains the data states (Kor, Locathah, Ixalan Blue Merfolk, Zendikar/Emeria/Ula Creed), 6 losses (Orc in five books Intimidation, MPMM Tortle Survival: the source offers them only as a pick from a list), nine backgrounds no longer show a bogus held skill. Open items: race and background skill choices still run through `skillChoices`/`chosenSkills` and a text parse (ticket 18); the trait-text scan still gives every Dwarf History; the implementer wrote the scraper parser and sheet change before their tests; integrated caches synced before this have no skill grants until re-sync, so the catalog format bump in ticket 17 is required.

- [x] The race and background skill tables are deleted from the app.
- [x] Existing characters show the same skills as before; the skills characterization baseline stays green or changes only through its recorder with a reviewed diff.
- [x] A character whose background comes from a disabled book loses that skill and an Expertise mark on it is released, covered by a test.
- [x] The coverage gate stays green; data changed only through the enrich step and the prune script.
- [x] `npm run check:all` passes.
