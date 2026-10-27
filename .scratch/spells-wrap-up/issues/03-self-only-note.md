# 03: "(self only)" next to Nondetection

**Status:** ready-for-agent

Spec: `.scratch/spells-wrap-up/spec.md`.

## What to build

The Gnome (Deep) grant's Nondetection works only on the caster, and the card should read "Nondetection (self only)". The note is reviewed catalog data: a field on the spell entry written by the scraper's reviewed overrides (the same place the Gnome (Deep) level and use corrections live), carried to the spell entry by the reader, and shown as a suffix next to the spell name. No spell or race name appears in app code. Design must be responsive: the suffix wraps with the name at 320, 360, 393 and 412 px without overflow. If the scraped record shape changes, the Catalog Format rises to 11 (format 10 is already pushed); the tracked data is regenerated with the sanctioned command in its own commit.

## Owns

- AC-6: "(self only)"

## Acceptance Criteria

- [ ] The Gnome (Deep) card reads "Nondetection (self only)" in the integrated catalog, from reviewed data (AC-6).
- [ ] A grant without a note shows no suffix; the note field is generic (any spell entry can carry one).
- [ ] A layout scenario with the card passes at four widths, integrated, and the screenshots were viewed.
- [ ] `npm run check:all` and `npm run check:live` pass.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6 | Scraper override and enrich tests; `grantedSpellSources`; the Spells tab | Red-then-green tests for the note on the entry; `check:live` for the real grant; layout scenario, four widths, integrated, screenshots viewed |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invented names in tests except where real data is the point. No non-SRD name in app code. Notices read "X removed from Y: reason". Layout per CODING_STANDARDS §7; design must be responsive. The SRD carve-out constant is `SRD_SOURCE` in `src/constants/books.ts`. Reuse the reviewed-correction mechanism (`SPELL_GRANT_CORRECTIONS` in `dnd5eToolsScrap/src/overrides/granted-spells.ts`). The suffix is the only new copy.

## Blocked by

None
