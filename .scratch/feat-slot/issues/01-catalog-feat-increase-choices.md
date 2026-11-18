# 01: The Catalog states a feat's Increase Choice

**What to build:** `dnd5eToolsScrap/src/scrapers/feats.ts` (`parseAbilityScores`) keeps only numeric keys of a feat's `ability` entry and drops `choose`, so Resilient, Athlete, Fey Touched and Skill Expert come out with `abilityScoreIncrease: null`. Make the feat scraper emit `abilityScoreIncrease` (fixed increases only) plus `abilityScoreChoices` (`AbilityScoreChoice[]`: `from`, `count`, `amount`) using the same parsing the race scraper already has (`dnd5eToolsScrap/src/scrapers/races.ts` around line 420-447, `KNOWN_CHOOSE_KEYS`; move it to a shared helper both scrapers import rather than copying it). An unknown `choose` key is reported as unparsed, as for races. Add `abilityScoreChoices?: AbilityScoreChoice[]` to the scraper's feat model and to the app's `FeatData` (`src/types/dnd5e.ts:213`), with the same doc comment races use. Raise `REQUIRED_CATALOG_FORMAT` in `src/services/compendiumStorage.ts` from 15 to 16. Regenerate the tracked `dnd5eToolsScrap/data/feats.json` the way the scraper's README says, and run `node scripts/prune-to-srd.mjs` only if the SRD feats change (they should not). The app does not read the new field yet (ticket 02).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A scraper test (next to `dnd5eToolsScrap/checks/race-ability-choices.test.ts`) fails first, then passes: Resilient (PHB) gives `abilityScoreChoices: [{ from: [all six], count: 1, amount: 1 }]` and no fixed increase; Durable gives `abilityScoreIncrease: [{ Constitution: 1 }]` and no choices; Athlete gives `from: ["str","dex"]` (use the score keys the race path emits). Paste the red output.
- [ ] In the regenerated `feats.json`, every name in `HALF_FEATS` (`src/rules/leveling.ts:16`) that is in the dump has a fixed increase or an `abilityScoreChoices` entry whose scores equal the table's list. Paste the comparison (a throwaway node one-liner is fine) and name any mismatch.
- [ ] `npm run check:all` and `npm run check:live` pass.
