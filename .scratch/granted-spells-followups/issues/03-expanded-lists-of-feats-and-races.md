# 03: Expanded lists of feats and races

**Status:** ready-for-agent

Spec: `.scratch/granted-spells-followups/spec.md` (ADR 0017 and its amendment, GLOSSARY *Always-Prepared Spells*, *Expanded Spell List*).

## What to build

A held feat's or race's `expanded` lists (Mark feats and Mark races) add their spells to the spell list of every spellcasting class once the character has Spellcasting or Pact Magic, through the path the background expanded lists already use. A spell the character learned only from such a list is released with a review notice when the source goes.

## Owns

- AC-6: Expanded lists of feats and races

## Acceptance Criteria

- [ ] With Spellcasting, a held source's expanded spell is offered on every spellcasting class's list; without it, it is not offered (AC-6).
- [ ] A spell learned only from that list is released with a review notice when the source is removed; a spell a class gives itself stays (AC-6).
- [ ] `npm run check:all` and `npm run check:live` pass.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-6 | Spell availability and the source-release path, invented catalog | Red-then-green tests: offered or absent, released with notice, class spell kept |
| AC-6 (live) | `check:live` | A real Mark feat or race exposes its expanded lists to the reader |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names and prose in tests. No feat, race or background name in app code. Never hand-edit tracked data; regenerate only with the sanctioned commands. Interface copy is essential mechanics only (CODING_STANDARDS §8); layout per §7. Reuse the background expanded-list machinery; do not copy it. Read data from the supplied Catalog.

## Blocked by

None
