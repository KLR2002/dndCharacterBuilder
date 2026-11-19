# 01: `admits` in the Compendium

**What to build:**

- **The predicate.** Add `admits(source?: string): boolean` to `CompendiumListings` in `src/services/compendium.ts`, with a doc comment stating the rule (ADR 0025):
  - no source (`undefined` or `""`) → admitted
  - `"SRD"` → always admitted
  - book codes compare without regard to case
  - the unscoped listings, from `for()`, `for(ALL_BOOKS)` or any `for(...)` on the SRD Baseline, admit every source
  - `for([])` admits only sourceless and SRD records
- **Scoping uses it.**
  - Replace the private `admitter` so every scoped listing (`races`, `classes`, subclasses, subraces, `feats`, ...) filters with the listings' own `admits`.
  - The scoped-listing cache key must ignore case: `["sato"]` and `["SatO"]` share one entry.
  - Items keep admitting a sourceless item.
- **Drop the upper-casing before `for()`.** These rules pass `activeBooks.map(toUpperCase)` to `compendium.for`. Pass `activeBooks` unchanged and remove the `upperBooks` variables that only fed `for()`:
  - `src/rules/choices/maneuvers.ts` ~65
  - `src/rules/choices/fightingStyles.ts` ~137
  - `src/rules/spellPage.ts` ~356
  - `src/rules/choices/warlockChoices.ts`: each `compendium.for(upperBooks)`

  Leave `upperBooks` uses that are not passed to `for()` for ticket 02.
- **Glossary.** In `GLOSSARY.md`, add **Book Admission** after **Compendium**: the one rule above, in two or three sentences, with an `_Avoid_` line (for example: book filter, source gate). Extend the Compendium entry to say its listings answer whether a source is admitted.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merge 84f9e9f (6b4d1b1, 29d5225).
- **`admits`:** `CompendiumListings.admits(source?)`; unscoped listings admit all. Scoped listings filter with one `bookAdmitter` (lower-cased set, SRD and sourceless admitted), and the cache key is lower-cased. `resolve` lost its `fromBaseline` flag, which nothing else read.
- **Upper-casing removed** before `for()` in maneuvers, fightingStyles (three calls, including the cleric and druid cantrip lookups), spellPage `inscribeOffer`, and six warlockChoices sites. The `upperBooks` that feed `isSpellAvailableForClass` and the Ritual Book set stay for tickets 02 and 03.
- **Glossary:** **Book Admission**, `_Avoid_: source gate, book whitelist`.
- **Tests:** 7 new tests (red then green, apart from the `for([])` characterization); no existing outcome changed. check:all and check:live passed.

- [x] Tests in `checks/compendium.test.ts` (an integrated `createCompendium` with a small bundle, and the SRD one):
  - `admits`: `"PHB"` with `["phb"]` true; `"SatO"` with `["SATO"]` true; `"XGE"` with `["PHB"]` false; `"SRD"` with `["PHB"]` and with `[]` true; `undefined` true; anything with `ALL_BOOKS` true; anything on the SRD Baseline true.
  - Scoping: a `SatO` feat is listed with `["SATO"]`; `for([])` lists no book records but keeps baseline-fallback SRD records; two calls with differently cased books return the same array.
- [x] A test that the Fighting Style, maneuver and Pact Boon offers list a mixed-case-source option (a test compendium with one such record) when its book is active in any case.
- [x] `npm run check:all` and `npm run check:live` pass.
