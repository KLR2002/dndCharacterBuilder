# 04: Grants with no casting ability get a card

**Status:** done

**Landed:** a grant that names spells and no ability gets a card with at-will cantrips and Long Rest counters and no ability, DC or attack row; the coverage gate reads ability-less grants and ignores ritual lists (Cartomancer, Outlands Envoy, Rune Shaper, Boon of Misty Escape and Light Bringer reach the reader; Servo Crafting and Strixhaven Mascot are ritual-only and keep their marks). check:all, check:live and the layout runs green. Open: a card awaiting a chosen ability also loses the stats row.

Spec: `.scratch/granted-spells-followups/spec.md` (ADR 0017 and its amendment, GLOSSARY *Always-Prepared Spells*, *Expanded Spell List*).

## What to build

A feat whose grant names spells but no casting ability (Cartomancer, Outlands Envoy, Rune Shaper, Servo Crafting, Strixhaven Mascot shapes) shows a card with its cantrips at will and its daily or per-rest spells with their Long Rest counters, and no ability, save DC or attack row.

## Owns

- AC-7: Grants with no ability

## Acceptance Criteria

- [x] A feat with spells and no ability shows a card with at-will cantrips and counters for daily spells (AC-7).
- [x] The card has no ability, DC or attack row (AC-7).
- [x] `npm run check:all` and `npm run check:live` pass; a layout scenario of such a card passes at four widths.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-7 | `grantedSpellSources` and the Spells tab, invented catalog | Red-then-green test: card exists with spells and counters, no ability fields |
| AC-7 (UI) | Spells tab layout check | Scenario, four widths, screenshots viewed |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names and prose in tests. No feat, race or background name in app code. Never hand-edit tracked data; regenerate only with the sanctioned commands. Interface copy is essential mechanics only (CODING_STANDARDS §8); layout per §7. Ritual-only feats stay unmodelled; a grant with only ritual spells still gets no card.

## Blocked by

09
