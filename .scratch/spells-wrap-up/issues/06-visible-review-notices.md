# 06: Review notices are visible

**Status:** ready-for-agent

Spec: `.scratch/spells-wrap-up/spec.md` (AC-10, AC-11).

## What to build

Every release in the spell work (a pick, a counter, a known spell released because its source went or its book was switched off) writes a notice into the character's `needsReview` list, and the old rule-choice work (ADR 0003, 0010, 0011) does the same, but no screen reads `needsReview`, so the player never sees any of them. Add the surface: on the character screen (`src/app/character/[id].tsx`, between the tab bar and the tab content, so it shows on every tab) a compact row that reads the count ("N to review"), expands to the list of notices, and lets the player dismiss one notice or all of them (dismissing writes the list back through the character context so it persists; a notice that is dismissed does not return unless the same release happens again). A character with no notices shows nothing and takes no space. Essential copy only (the count, the notices themselves, Dismiss); no explanation text. Responsive: it must fit and wrap at 320, 360, 393 and 412 px with long notices (they name a spell and a source), with no clipped text and no sideways scroll; collapsed by default when there are more than a few notices. Reuse existing shared UI components and the theme (look at how other banners/cards are built under `src/components/ui/`).

Also (AC-11): the legacy-duplicate normalisation in `src/rules/migrateCharacter.ts` drops one of two entries of the same origin feat; abilities add the feat's ability increase for every entry, so when the dropped entry carried a `featAbility` and the kept one has none, the kept entry takes it; the character's ability scores do not change by the dedupe other than removing the double count. Test it.

## Owns

- AC-10: Review notices are visible
- AC-11: Migration keeps the feat ability

## Acceptance Criteria

- [ ] A character with notices shows a count and the list above the tab content on every tab, and a character without shows nothing (AC-10).
- [ ] A single notice and all notices can be dismissed, the change persists, and a dismissed notice does not return on reload (AC-10).
- [ ] The surface fits and wraps cleanly at 320, 360, 393 and 412 px with long notices, in the SRD baseline and the integrated catalog layout runs (AC-10).
- [ ] The legacy duplicate-feat dedupe keeps the ability increase (AC-11).
- [ ] `npm run check:all` passes.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-10 | A rule-level function for dismissing (pure, tested) plus the context update; the screen via layout scenario | Red-then-green test of dismiss one / all / persistence; new layout scenario (seeded character with long notices and one without) at four widths, SRD and `-- --integrated`, screenshots viewed |
| AC-11 | `migrateCharacter` | Red-then-green test |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules" and `CODING_STANDARDS.md` §3, §7, §8. No new explanatory copy. Keep the dismiss logic out of the component (a small function in `src/rules/`).

## Blocked by

None
