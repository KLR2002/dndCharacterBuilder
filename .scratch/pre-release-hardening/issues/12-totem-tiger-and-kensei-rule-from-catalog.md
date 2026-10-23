# 12: Totem Warrior Tiger and the Kensei rule from the Catalog

**What to build:** The Totem Warrior Tiger grant applies when the Aspect of the Beast pick that gates it is made, with the gate's data coming from the Catalog and not from an app table. The Kensei weapon rule is recognised by the shape of its grant (a weapon choice on a subclass feature whose pick also marks a Monk Weapon), declared in the data, and the subclass name is no longer in app code.

**Blocked by:** 07, 11

**Status:** done

**Landed:** merged from `pr/12-tiger-kensei` (d8a27f7). `check:all` passes (1065 app tests, 132 scraper tests, 322 known type errors none new), scraper type check clean. The Totem option table and `KENSEI_SUBCLASS` are deleted. The Tiger skill grant carries a `requires` gate on the Aspect of the Beast pick (one reviewed override applied through the enrich step, 4 lines in `classes.json`); a changed Aspect pick releases the Tiger pick with a notice. A weapon choice on any Monk subclass feature marks a Monk Weapon, covered with an invented subclass. Folded options in a fresh scrape now keep their own grants and level, so the Tiger grant reaches a freshly scraped Integrated Catalog. Skills baseline re-recorded: 12 rows (human soldier totem barbarian with the tiger aspect, levels 6, 11, 14, 17, three book sets) gain Stealth and Survival, none loses a skill; the fixture's Tiger option had carried no grant. ADR 0015 Known exceptions now reads 'None remain'. Open items: a picked folded Totem option is now listed as its own feature on the Features tab (confirm on device); the tracked `dnd5eToolsScrap/data/classes.json` is stale against the scraper (no `choices` on folded options, missing spell-choice and sidekick text), so a classes scrape needs its own reviewed ticket; the catalog format bump is ticket 17; no layout check was run.

- [x] The Totem Warrior option table and the Kensei subclass name constant are deleted from the app.
- [x] The Tiger proficiencies apply only with the Aspect of the Beast pick, and are released with a notice when the pick changes, covered by a test.
- [x] Kensei weapon picks are Monk Weapons, held weapons are still offered, and the Kensei tests stay green.
- [x] Another subclass whose data declares the same grant shape would behave the same, covered by a test with an invented subclass.
- [x] Data changed only through the enrich step and the prune script; the coverage gate stays green.
- [x] `npm run check:all` passes.
