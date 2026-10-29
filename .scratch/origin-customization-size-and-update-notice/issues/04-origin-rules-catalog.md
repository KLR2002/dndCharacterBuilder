# 04: originRules Catalog collection

**Status:** done
**Landed:** b521aab, scraper tests (292), checks (1594), check:live and check:all passed; open items: none

Spec: `../spec.md` (decisions Q6, Q7, Q9, Q16; ADR 0013, 0014, 0015).

## What to build

The scraper (the CLI and the in-app sync) reads `data/variantrules.json`, finds the Customizing Your Origin record and parses its Proficiency Swaps table into an `originRules` Catalog collection of structured rows: what is replaced and what may replace it. The collection holds no prose. The scrape fails when the record or table is missing or a cell is not recognized. The in-app sync gains an 11th step, the collection is saved and loaded with the rest of the Catalog, and the Catalog format becomes 12 so older catalogs are stale. The SRD Baseline carries no `originRules`.

## Owns

- AC-8: Swap table in the Catalog

## Acceptance Criteria

- [x] AC-8: a fixture with an invented table of the same structure yields the expected rows; a missing record, a missing table and an unrecognized cell each fail the scrape.
- [x] The collection is saved, loaded and integrated like the others; a catalog saved at format 11 is stale; `REQUIRED_CATALOG_FORMAT` is 12 with its comment.
- [x] The live catalog contains the parsed table (five rows today).

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-8 | the scraper's parser on the fixture | red-green `npm --prefix dnd5eToolsScrap test` including the three failure cases |
| AC-8 | catalog storage and the format gate | red-green `node --test checks/` for save/load and staleness |
| AC-8 | the real source | `npm run check:live` |

## Constraints

Fixtures use invented names and sentences, never real rules prose. Do not hand-edit `src/data/` or `dnd5eToolsScrap/data/`; scraper data runs only if this ticket says so (it does not). The mirror, not `2014.5e.tools`, is what the in-app client reads.

## Blocked by

None
