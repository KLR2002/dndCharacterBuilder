# 11: Racial weapon and armor grants

**What to build:** Racial weapon and armor proficiencies (the Githyanki and Drow cases) come from Proficiency Grants, and the app's race weapon table and the Githyanki armor special case are deleted.

**Blocked by:** 10

**Status:** done

**Landed:** merged from `pr/11-racial-weapon-armor` (595ef2a). `check:all` passes (1056 app tests, 130 scraper tests, 322 known type errors none new), scraper type check clean, no UI change. Racial weapon and armor proficiencies are Proficiency Grants from the scraped race and subrace records; `RACE_WEAPON_PROFICIENCIES`, `raceTraining` and the Githyanki/Mountain Dwarf armor special case are deleted. The weapons-and-armor baseline and allowlist are unchanged. Sheet diff vs ticket start (integrated mode): gains for Mountain Dwarf (light and medium armor; the old name check never matched), Githyanki subrace armor, Giff firearms, Khenra, Kaladesh/Zendikar/Half-Elf Moon-Sun-Wood elves, Sea Elf; losses for Drow (longsword, shortbow, longbow: it keeps rapier, shortsword, hand crossbow), Pallid, Shadar-kai, Mark of Shadow (base-Elf set they only got through the name table), and the MPMM Githyanki race (swords and armor it only got through name collisions). SRD mode: no change. Open items: Hobgoblin 'two martial weapons of your choice' is unparsed so its light armor stays ungranted as before; race and subrace weapon grant ids are position-based, ticket 15 must alias them; the Gith (Githyanki) and Elf (Sea) subrace overrides name their own proficiencies, so a re-scrape will not update them.

- [x] The race weapon table and the Githyanki armor special case are deleted from the app.
- [x] Existing characters show the same weapons and armor as before; the weapons-and-armor baseline stays green or changes only through its recorder with a reviewed diff.
- [x] Attack proficiency and AC still read the sheet; a test covers a Githyanki and a Drow.
- [x] The coverage gate stays green; data changed only through the enrich step and the prune script.
- [x] `npm run check:all` passes.
