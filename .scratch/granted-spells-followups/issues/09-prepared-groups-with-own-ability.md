# 09: Prepared groups with their own ability or uses are Innate Magic

**Status:** done

**Landed:** a prepared group that names an ability of any kind, or holds will/daily/rest uses, is Innate Magic (`isInnatePreparedGrant`): a card with that ability's DC and attack and Long Rest counters, out of the class list; plain groups stay in the class list. check:all and check:live green; layout scenario green. Open: Vampire Touched's scraped record carries no ability or uses so it stays in the class list (needs a reviewed override); Boon of Magic School Mastery's pick has no class filter; one full layout run after a merge failed the new scenario and could not be reproduced (later runs, mine included, green).

Spec: `.scratch/granted-spells-followups/spec.md` (AC-18; ADR 0017 amendment; GLOSSARY *Always-Prepared Spells*, *Innate Magic*).

## What to build

Ticket 01 puts every `prepared` spell of a feat or race in the class list with the class's ability. The live data shows some prepared groups name their own casting ability or give at-will or daily casts (Mark of Detection, Vampire Touched, Boon of Siberys, Magic Connoisseur, Hexblood's daily spells). Split by shape: a prepared group with an `ability` of its own (fixed, chosen or inherited) or with `will`/`daily`/`rest` uses becomes Innate Magic, a source card with that ability's save DC and attack bonus, its at-will spells, and Long Rest counters on its daily spells, through the same path as the other grants; the player chooses the ability where the feat or race is chosen, as for Magic Initiate. Its spells are not in the class list. A prepared group with neither stays in the class list as ticket 01 built it. Check the real shapes in the live catalog again before deciding the rule.

## Owns

- AC-18: Prepared groups with their own ability or uses are Innate Magic

## Acceptance Criteria

- [x] A prepared group naming its own ability shows a source card with that ability's DC and attack bonus, and its spells are absent from the class list (AC-18).
- [x] A prepared group giving at-will or daily casts shows them on the card, the daily ones with Long Rest counters that a long rest restores (AC-18).
- [x] A chosen or inherited ability is picked or read where the feat or race is chosen, as for the other grants, and a missing pick shows a review notice (AC-18).
- [x] A plain prepared group (no ability, no uses) stays in the class list unchanged (AC-1 still holds).
- [x] `npm run check:all` and `npm run check:live` pass; the layout scenario of the Spells tab covers a card of this kind at four widths, integrated.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-18 | `grantedSpellSources` and class profiles, invented catalog | Red-then-green tests: card with ability, DC and counters, absent from the class list; plain group unchanged |
| AC-18 (live) | `check:live` | Real Mark of Detection, Vampire Touched and Boon shapes land on a card; plain Adept spells stay in the class list |
| AC-18 (UI) | Spells tab layout check | Scenario, four widths, screenshots viewed |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". No feat, race or background name in app code. The rule is by data shape, never by name. Slot casting stays in the feat text. Interface copy is essential mechanics only.

## Blocked by

01 (merged)
