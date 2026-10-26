# 39: Superior Technique and Martial Adept give separate d6 superiority dice, not extra Battle Master dice

**What to build:** Owner bug report. Superior Technique (the fighting style) and the Martial Adept feat each give one superiority die that is a d6, "added to any superiority dice you have from another source". They do not scale. The app already treats them as d6 for a character with no Battle Master levels. A Battle Master gets its own dice (4, 5 at 7th, 6 at 15th level) that scale d8, d10 at 10th, d12 at 18th. But for a Battle Master that holds the style or the feat the app adds the bonus dice into the Battle Master pool, so the character shows 5 or 6 dice that all scale. Wrong: the character has the Battle Master pool at its scaled face plus a separate pool of up to 2 d6.

**Blocked by:** none

**Status:** ready-for-agent

## Design notes

- Cause: `getSuperiorityDice` in `src/rules/combatDice.ts` sums `bonusDice` into the Battle Master `count` and uses the Battle Master die for all of them. ADR 0010 states the same wrong rule ("RAW requires upgrading bonus dice to match the Battle Master's higher die face"); the catalog text of both sources says the opposite (the feat's own text: "one superiority die, which is a d6 (this die is added to any superiority dice you have from another source)").
- Model two pools in the rules module: the Battle Master pool (count by Fighter level, die by Fighter level, only for a Battle Master Fighter of level 3 or higher) and the bonus pool (count 0 to 2: one for the style, one for the feat, always d6). A character with no Battle Master levels has the bonus pool alone, as today. Change the return shape of `getSuperiorityDice` (and `ClassDiceSummary.superiorityDice`) to carry the pools, e.g. a list of `{ count, die }` ordered largest die first, or a named pair; pick the shape that keeps the consumers simplest, and keep it a single reader in `src/rules/combatDice.ts`.
- Consumers to follow (find all with `grep -rn "superiorityDice\|getSuperiorityDice" src checks`): `src/rules/resourceCounters.ts` (one counter today; give each pool its own counter with a stable id: the Battle Master pool keeps `superiority_dice`, the bonus pool gets `superiority_dice_d6`, names `Superiority Dice [d8]` and `Superiority Dice [d6]`, both reset on a short rest; a saved `superiority_dice` counter keeps its spent count where the pool still exists and is clamped to its new max), `src/components/tabs/StatsTab.tsx` (badge and description text), `src/components/tabs/ActionsTab.tsx` and `src/rules/tacticalActions.ts` (maneuver cards show the die each maneuver spends: when the character holds both pools list both faces, e.g. `d8 / d6`, because the player chooses which die to expend; otherwise the single face).
- No hardcoding of die faces beyond what already exists: the d6 is the grant's own text. If the catalog's feat or style record states the die, read it from there; if it does not parse, keep the constant `d6` in one named place in `combatDice.ts` with a comment on its source.
- Fix the record of the rule: replace the wrong sentence in `docs/adr/0010-modular-class-progression-fighting-styles-maneuvers-invocations-infusions.md` (both places that state it: the Context bullet and the `getSuperiorityDice` description around line 26-27) and the `Superiority Die` entry in `GLOSSARY.md` (state that the d6 dice of Superior Technique and Martial Adept are separate from the Battle Master's scaling dice). Leave `docs/superpowers/plans/` alone (history).
- Update the tests in `checks/battleMasterManeuvers.test.ts` that assert the merged pools (the Battle Master 3 with style = `5d8`, Battle Master 10 with style = `6d10`, the "both" cases, and the ones that check `resourceCounters`); rewrite them to assert the two pools. Add: a Battle Master 3 with the style holds `4d8` plus `1d6`; Battle Master 10 with style and feat holds `5d10` plus `2d6`; Battle Master 18 keeps `d12` for its own pool and `d6` for the bonus; non-Battle Master unchanged; the counters (two ids, max counts, a spent count survives). Do not hand-edit any baseline.
- Reproduce in the app if cheap (docs/agents/driving-the-app.md, SRD baseline is enough if Battle Master exists there; otherwise the integrated catalog): Battle Master 3 with Superior Technique, look at the Stats tab badge, the Features tab counters and an Actions tab maneuver card. Screenshot before and after at 393 px and view them.
- Layout: the badge and the maneuver `Die:` text get longer when both pools exist. Add a layout-check scenario for a Battle Master with the style and the feat (use an existing maneuver scenario if there is one) and run `npm run layout:check` (and `-- --integrated`) once at the end.

## Acceptance criteria

- [ ] A Battle Master 3 with Superior Technique has 4 d8 and 1 d6 superiority dice; at level 10, 5 d10 and 1 d6; with the feat as well, plus a second d6.
- [ ] A non-Battle Master with the style or the feat has only d6 dice, as before.
- [ ] The Features tab tracks the two pools as two counters; a spent count on the Battle Master counter survives.
- [ ] Maneuver cards name the face(s) the player can expend.
- [ ] ADR 0010 and the glossary state the rule correctly.
- [ ] `npm run check:all` passes; `npm run layout:check` passes in both modes.
