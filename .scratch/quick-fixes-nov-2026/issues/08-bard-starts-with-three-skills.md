# 08: A Bard starts with three skills of any kind

**What to build:**

- **The problem.** 5etools gives the Bard's starting skills as `startingProficiencies.skills: [{ "any": 3 }]`. The class scraper (`dnd5eToolsScrap/src/scrapers/classes.ts` ~242-270) defaults `skillProficiencies` to `{ choose: 2, from: [] }` and overwrites it only for a `choose` entry. For an `any` entry it keeps `{ "choose": 2, "from": [] }`, so the Bard offers 2 skills instead of 3, in the SRD Baseline and the Integrated Catalog. Since the class-skill-choice spec (ticket 02), the pick is a Proficiency Choice built by `startingSkillGrantOf`, with count and pool read from that record.
- **The fix.**
  - The scraper writes `{ "choose": <n>, "from": [] }` for `{ "any": <n> }`. Check the other classes' raw entries for other shapes and say what you found.
  - Raise the Catalog Format, so an integrated catalog with the old count is stale.
  - Regenerate `dnd5eToolsScrap/data/classes.json` and run `node scripts/prune-to-srd.mjs`. The `src/data` diff must be only the Bard's count.

**Blocked by:** None

**Status:** needs-triage

- [ ] A scraper test: a raw class with `[{ "any": 3 }]` gives `choose: 3, from: []`.
- [ ] An SRD Bard 1 is offered a starting skill Proficiency Choice of 3 from all 18 skills.
- [ ] `npm run check:all` and `npm run check:live` pass.
