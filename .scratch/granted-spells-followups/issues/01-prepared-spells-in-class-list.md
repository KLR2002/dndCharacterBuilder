# 01: Prepared spells of feats and races in the class list

**Status:** done

**Landed:** plain prepared spells of held feats and races list in every spellcasting class with the lock icon and a source badge, stored nowhere and counted nowhere; 30 live-only "not modelled" marks removed; layout scenario green SRD and integrated. check:all and check:live green. Open: prepared groups with their own ability or uses are corrected by ticket 09; Magic Connoisseur is not tied to the Magic Initiate pick; a subrace whose only grants are prepared would replace the race's innate grants (no live data hits this).

Spec: `.scratch/granted-spells-followups/spec.md` (ADR 0017 and its amendment, GLOSSARY *Always-Prepared Spells*, *Expanded Spell List*).

## What to build

A feat or race with a `prepared` group (Mark feats and races, Adept feats, Vampire Touched, Boons) lists those spells in the list of every spellcasting class the character has, under their level, with the lock icon the subclass always-prepared spells use and a badge naming the source. They use the active class's ability for DC and attack, are gated by the level key the data gives, never enter the stored known or prepared spells, never count against a limit, and disappear when the source is removed. The feat's own ability field is ignored for `prepared` groups, so a prepared-only feat needs no ability pick and the reader no longer offers one. Where the reader now models a feat, its reviewed "not modelled" mark is removed. Start by writing down, from the live catalog, the actual shapes of these `prepared` groups.

## Owns

- AC-1: Prepared spells in the class list
- AC-2: Every class gets them
- AC-3: Level gate
- AC-5: Release
- AC-17: Gate stays honest

## Acceptance Criteria

- [x] A prepared spell of a held feat or race is listed in the class list with a lock icon and a source badge, is not stored in known or prepared spells, and leaves the prepared count and limit unchanged (AC-1).
- [x] On a multiclass character it is listed in every spellcasting class's list, and its DC and attack bonus use the active class's ability (AC-2).
- [x] A prepared spell with a level key is absent below that character level and listed from it (AC-3).
- [x] Removing or swapping the feat or race removes the spell from every list and leaves no stored ghost (AC-5).
- [x] A prepared-only feat offers no ability pick. A feat the reader now models has no reviewed "not modelled" mark, and the coverage gate passes (AC-17).
- [x] `npm run check:all` and `npm run check:live` pass; a Spells-tab layout scenario passes at four widths, SRD and `-- --integrated`.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1, 2, 3, 5 | `evaluateCharacter` and the class spell profiles, invented catalog in `checks/` | Red-then-green tests: entries listed or absent, stored spells and counts unchanged |
| AC-17 | Scraper coverage gate and `check:live` | Stale marks removed, gate and live checks pass |
| AC-1 (UI) | Spells tab layout check | New scenario, four widths, SRD and integrated, screenshots viewed |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names and prose in tests. No feat, race or background name in app code. Never hand-edit tracked data; regenerate only with the sanctioned commands. Interface copy is essential mechanics only (CODING_STANDARDS §8); layout per §7. Slot casting stays in the feat text. The class list reader takes the data from the evaluation's supplied Catalog, not the process-wide compendium. If the scraped record shape changes, raise the Catalog Format to 10.

## Blocked by

None
