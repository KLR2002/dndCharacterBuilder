# 02: Locked card for a character with no spellcasting class

**Status:** done

**Landed:** a character with plain prepared spells and no spellcasting class sees a locked card for the source (lock icon, no counters, no ability row), above the no-class notice; it goes when a class is taken and the spells move to the class list. check:all, check:live and the layout runs (integrated and SRD) green. Open: a locked card for a race with a plain prepared group shows the race name, not the subrace display name (no such race in the data).

Spec: `.scratch/granted-spells-followups/spec.md` (ADR 0017 and its amendment, GLOSSARY *Always-Prepared Spells*, *Expanded Spell List*).

## What to build

A character with a prepared-grant source but no spellcasting class has no class list to put its spells in. The Spells tab shows a small card for the source listing them with the lock icon and no counters. When the character takes a spellcasting class, the card goes and the spells appear in the class list.

## Owns

- AC-4: No class

## Acceptance Criteria

- [x] A Fighter holding a prepared-grant source sees a small locked card for it listing the spell, with no counter (AC-4).
- [x] After taking a spellcasting class, the card is gone and the spell is in the class list (AC-4).
- [x] `npm run check:all` passes; a layout scenario of the card passes at four widths.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-4 | `evaluateCharacter` and the Spells tab, invented catalog | Red-then-green tests for card with and without a class |
| AC-4 (UI) | Spells tab layout check | Scenario with the card, four widths, screenshots viewed |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names and prose in tests. No feat, race or background name in app code. Never hand-edit tracked data; regenerate only with the sanctioned commands. Interface copy is essential mechanics only (CODING_STANDARDS §8); layout per §7.

## Blocked by

01 (merged), 09
