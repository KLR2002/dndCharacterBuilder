# 25: Weapon properties given as objects no longer break weapon pools

**What to build:** `npm run check:live` (the check against the catalog the in-app sync builds) found a bug the offline checks cannot see. In the live catalog the 2024 Lance carries a property that is an object, `{"uid":"2H|XPHB","note":"unless mounted"}`, while `ItemData.properties` is typed `string[]`. `weaponPoolNames` in `src/rules/proficiencyPools.ts` calls `property.toLowerCase()` on each property and throws, so any weapons Proficiency Choice with a property rule cannot be read for a character who holds it: Wizard (PHB or XPHB) with the Bladesinging subclass, and the Weapon Master feat (PHB or XPHB). The Builder offers those choices on render, so such a character risks a crash with integration on.

**Blocked by:** None

**Status:** ready-for-agent

## Design notes

- Fix both sides. In the scraper (`dnd5eToolsScrap/src/scrapers/items.ts`, the property loop near line 150 and `formatProps` near line 275) an object property entry becomes the property its `uid` names, mapped like a string entry (the part before `|`, then `PROPERTY_MAP`). In the app reader (`weaponPoolNames`, and any other reader of `item.properties` that calls a string method without a guard) a non-string property is read through the same rule or skipped, so a catalog already cached on a device keeps working without a re-sync. No catalog format bump.
- Test first at the seams: a scraper test with an invented raw item whose `property` holds a string, an object with `uid` and `note`, and a bare code; a rules test where `weaponPoolNames`/`poolNames` reads an `ItemData` whose `properties` holds an object (cast in the test) and still returns the pool by the other properties. Invented names only.
- Do not edit `src/data/` or `dnd5eToolsScrap/data/`. The tracked 2014 data holds no object property, so no re-scrape is needed.
- Run `npm run check:live` (it builds the live catalog from the network, about a minute) and report whether it ends green. If another failure shows up, report its exact ids and do not widen scope.

## Acceptance criteria

- [ ] The scraper turns an object property entry into a string property name.
- [ ] A weapons Proficiency Choice with a property rule reads its pool when an item carries an object property, so cached catalogs do not throw.
- [ ] `npm run check:live` passes; `npm run check:all` passes.
