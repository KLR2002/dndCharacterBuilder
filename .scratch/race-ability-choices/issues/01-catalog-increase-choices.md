# 01: Catalog states increase choices and subrace replacement

**Status:** ready-for-agent

Spec: `.scratch/race-ability-choices/spec.md`. ADR 0019. GLOSSARY: *Fixed Increase*, *Increase Choice*.

## What to build

The races scrape copies each race and subrace record's ability choice into `abilityScoreChoices` and marks a subrace whose record replaces its race's increases with `replacesRaceAbilityScores: true`. It reports, rather than guesses, a choice shape it does not know. The tracked catalog and the SRD Baseline are regenerated so they carry the new fields. `abilityScoreIncrease` is unchanged for every record, so the app behaves exactly as before this ticket.

## Owns

- AC-1: A choice is copied from the record
- AC-2: A replacing subrace is marked
- AC-3: An unknown choice shape is reported, not guessed
- AC-4: The live catalog states the real records
- AC-5: The SRD Baseline Half-Elf has its choice

## Acceptance Criteria

- [ ] AC-1: a raw record with fixed scores and a `choose` block scrapes to fixed-only `abilityScoreIncrease` plus one `abilityScoreChoices` entry `{from, count, amount}`; `count` and `amount` default to 1.
- [ ] AC-2: a raw subrace with `overwrite.ability` carries `replacesRaceAbilityScores: true`; one without carries no such field; no race and subrace increases are merged.
- [ ] AC-3: a `choose` block with a key other than `from`, `count`, `amount` is listed as unparsed in the scrape report, and writes no choice.
- [ ] AC-4: `check:live` asserts Tiefling (Variant; Devil's Tongue) SCAG = fixed INT 1, choice `{from:[dex,cha],count:1,amount:2}`, replaces; Tiefling (Dispater) MTF replaces; Half-Elf PHB = fixed CHA 2, choice of 2 at +1 from the five others; Human (Variant) PHB = choice of 2 at +1 from all six; every choice's `from` names only ability keys.
- [ ] AC-5: the SRD Baseline Half-Elf has fixed CHA 2 and a choice of 2 at +1 from STR, DEX, CON, INT, WIS.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1, AC-2, AC-3 | `scrapeRaces` on an invented raw fixture, scraper checks | Red-green test output |
| AC-4 | `checks/liveCatalog.test.ts` | `npm run check:live` output (the known Rakish Audacity failure aside) |
| AC-5 | `loadSrdCatalog("races")` in `checks/` | Red-green test output |

## Constraints

- Add the optional fields to `RaceData` / `SubraceData` (shape in the spec's Architecture Constraints); the scraper's own race model mirrors them. No app code reads them yet.
- Data changes only through `npm --prefix dnd5eToolsScrap run scrape:races`, then `npm --prefix dnd5eToolsScrap run enrich:grants`, then `node scripts/prune-to-srd.mjs`, each in its own commit. Restore `dnd5eToolsScrap/data/summary.json` if the races-only scrape overwrites it. The races.json diff must hold only the new fields; any other upstream drift is reported, not committed.
- The Catalog Format stays 14 (already raised on this branch). Add one line to ADR 0019 or leave it; do not raise the number.
- Fixtures use invented names; only live checks name real records.

## Blocked by

None
