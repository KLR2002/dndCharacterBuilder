# 08: A Bard starts with three skills of any kind

**What to build:**

- **The problem.** 5etools gives the Bard's starting skills as `startingProficiencies.skills: [{ "any": 3 }]`. The class scraper (`dnd5eToolsScrap/src/scrapers/classes.ts` ~242-270) defaults `skillProficiencies` to `{ choose: 2, from: [] }` and overwrites it only for a `choose` entry. For an `any` entry it keeps `{ "choose": 2, "from": [] }`, so the Bard offers 2 skills instead of 3, in the SRD Baseline and the Integrated Catalog. Since the class-skill-choice spec (ticket 02), the pick is a Proficiency Choice built by `startingSkillGrantOf`, with count and pool read from that record.
- **The fix.**
  - The scraper writes `{ "choose": <n>, "from": [] }` for `{ "any": <n> }`. The raw class files use only two shapes: 13 entries `{ choose }` and the Bard's `{ any }` (checked 2026-11-19).
  - Raise `REQUIRED_CATALOG_FORMAT` (`src/services/compendiumStorage.ts`) from 17 to 18, so an integrated catalog with the old count is stale, and update `checks/compendium.test.ts` as earlier format bumps did. Add a line to ADR 0015's format list.
  - Regenerate `dnd5eToolsScrap/data/classes.json` and run `node scripts/prune-to-srd.mjs`. The `src/data` diff must be only the Bard's count.

**Blocked by:** None

**Status:** done

**Landed:** merge c36cd11 (9704983, 636a1da, 0c9e376).
- **Scraper:** `{ any: N }` gives `{ choose: N, from: [] }`. A scraper test was red before the fix.
- **Format:** Catalog Format 18; ADR 0015 lists it.
- **SRD Baseline:** the diff is the Bard's count alone. A real SRD Bard test (choose 3 of 18) replaces the synthetic one.
- **Regenerated classes:** this also carried scraper drift beyond the Bard. Misty Wanderer's italic *misty step*; the Full Moon druid's known spells lose `sacred flame`; the EGW expanded filter loses `!XGE`. None of these reach `src/data`.
- check:all and check:live passed.

- [x] A scraper test: a raw class with `[{ "any": 3 }]` gives `choose: 3, from: []`.
- [x] An SRD Bard 1 is offered a starting skill Proficiency Choice of 3 from all 18 skills.
- [x] `npm run check:all` and `npm run check:live` pass.
