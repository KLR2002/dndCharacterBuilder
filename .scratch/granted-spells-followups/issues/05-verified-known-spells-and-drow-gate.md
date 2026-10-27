# 05: Leveled known race spells verified, Drow Descent gated

**Status:** done

**Landed:** Drow Descent gated by reviewed data; two of nine leveled known grants corrected (Dwarf Mark of Warding gains arcane lock at level 3, Gnome (Deep) nondetection at will), the other seven verified and pinned; Catalog Format 10. check:all and check:live green. Open: nondetection's "self only" limit is not shown; the Hexblood record in RHW has a prepared group.

Spec: `.scratch/granted-spells-followups/spec.md` (ADR 0017 and its amendment, GLOSSARY *Always-Prepared Spells*, *Expanded Spell List*).

## What to build

Nine race grants put leveled spells in `known` groups (Dwarf Mark of Warding, Genasi Air and Earth, Gnome (Deep), Halfling Mark of Hospitality, Hexblood, Human Marks of Making, Passage and Sentinel). Check each against its trait text taken from the live catalog and correct a wrong level gate or use count as a reviewed scraper override, with a test pinning each. Half-Elf Drow Descent's spell grant is gated on its Drow Magic option pick through the same reviewed-gate data as the Moon or Sun Elf descent cantrip.

## Owns

- AC-8: Leveled known race spells
- AC-9: Drow Descent gate

## Acceptance Criteria

- [x] Each of the 9 grants reads with the level gate and uses its trait text gives, and a test pins each (AC-8).
- [x] Any correction is a reviewed override in the scraper, not an app rule (AC-8).
- [x] Drow Descent's grant is absent until its option is picked and present after (AC-9); the gate is data.
- [x] `npm run check:all` and `npm run check:live` pass. If the data changes, the Catalog Format is 10.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-8 | Scraper enrich tests and a live catalog build | Pinned expectations per grant; trait text quoted in the report, not in the repo |
| AC-9 | Reader gate on an invented catalog and `check:live` | Red-then-green test; live assertion |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names and prose in tests. No feat, race or background name in app code. Never hand-edit tracked data; regenerate only with the sanctioned commands. Interface copy is essential mechanics only (CODING_STANDARDS §8); layout per §7. Regenerate tracked data with `npm --prefix dnd5eToolsScrap run enrich:grants`, in its own commit. Do not paste real rules prose into the repo.

## Blocked by

None
