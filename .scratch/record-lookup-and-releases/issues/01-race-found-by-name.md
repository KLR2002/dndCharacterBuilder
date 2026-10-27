# 01: Race and subrace found by name

**Status:** done

**Landed:** `raceLookup.ts` (`findHeldRace`: saved source, then an active book's record, then catalog order; subrace the same) serves ancestry, granted features, speed, race rule choices, the ancestry engine, `findRace`, the Features and Journal tabs; an SRD-saved High Elf, Hill Dwarf and Human evaluate equally on both catalogs (Hill Dwarf HP 10), saved sources untouched. A race held with no subrace takes its unnamed subrace when the catalog lists one (only Human PHB does). check:all and check:live (120/120) green. Open: `bookLoadedFor`/`ownerBookLoaded` in featSpells, `proficiencyPicks.sameRecord`, and the name fallbacks in `recordProficiencyGrants` and `migrateCharacter` are not routed through the lookup.

Spec: `.scratch/record-lookup-and-releases/spec.md`.

## What to build

A character saved on the SRD Baseline (race source "SRD") keeps its racial ability bonuses, size, darkvision, speed, granted traits and rule choices after the integrated catalog loads (races then carry sources such as "PHB"), and a character saved on the integrated catalog survives a switch back to the SRD Baseline. One shared race and subrace lookup (the saved source first, then the name scoped to the active books, then catalog order, deterministic) replaces the strict by-source matches in the ancestry resolver, granted features, speed, race rule choices and the compendium's race finder, and the ancestry engine, which already falls back to name, uses the same function. Probe first: a High Elf Wizard, a Hill Dwarf Cleric and a Human Fighter saved with source "SRD" lose bonuses, traits, size and darkvision under the integrated catalog today (Hill Dwarf HP drops from 10 to 9); languages and proficiencies already fall back to name.

## Owns

- AC-1: Race found by name after a catalog change
- AC-2: Both directions
- AC-3: Source first, then name, scoped to active books
- AC-5: Saved source untouched

## Acceptance Criteria

- [x] An SRD-saved High Elf Wizard, Hill Dwarf Cleric and Human Fighter evaluated under the integrated catalog equal their SRD-catalog results for ability bonuses, size, darkvision, speed, granted traits and rule choices; Hill Dwarf HP stays 10 (AC-1).
- [x] The same characters saved on the integrated catalog evaluate equally under the SRD Baseline alone (AC-2).
- [x] With the race in two sources, the record of the saved source is used; with none matching, an active book's record, then catalog order, identically on every load; the subrace follows the same rule (AC-3).
- [x] The character's saved race and subrace sources are unchanged after loading and evaluating (AC-5).
- [x] The proficiency sheet, ancestry panel and sheet agree on the resolved race.
- [x] `npm run check:all` and `npm run check:live` pass.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1, 2 | `evaluateCharacter`, `grantedFeatures`, `speed`, race rule choices and the compendium's race finder with the real SRD and integrated catalogs | Red-then-green tests; the real-data comparison is the oracle; `check:live` |
| AC-3 | The shared lookup with an invented catalog holding the race under two sources | Red-then-green tests of the order and determinism |
| AC-5 | Character before/after evaluation | Saved sources asserted equal |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names in tests except where real data is the point (SRD and live-catalog tests). No non-SRD name in app code. The saved source of a character is never rewritten. Notices read "X removed from Y: reason"; no new explanatory copy; layout per CODING_STANDARDS §7. The lookup must not return catalog order silently when active books are given: scope to them first. Do not rewrite saved sources, and do not add a migration step.

## Blocked by

None
