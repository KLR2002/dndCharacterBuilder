# 02: Battle Master Maneuvers Milestones & Consolidated Superiority Dice Pool

**What to build:** Battle Master Fighter maneuver progression across level milestones (3, 7, 10, 15) in `ruleChoices`; consolidated Superiority Dice engine in `src/rules/combatDice.ts` scaling from $d8 \to d10 \to d12$ and integrating bonus dice from *Superior Technique* style and *Martial Adept* feat; dedicated tactical maneuver cards on `ActionsTab.tsx` with dynamic Save DC ($8 + \text{PB} + \max(\text{STR}, \text{DEX})$); and short-rest counter on `FeaturesTab.tsx`.

**Blocked by:** 01 (builds on rule choice foundations and style synergies).

**Status:** closed

- [x] In `src/rules/ruleChoices.ts`, implement `battleMasterManeuverChoices(character: Character, activeBooks?: string[])` offering milestone choices: `Maneuvers 3` (choose: 3), `Maneuvers 7` (choose: 2), `Maneuvers 10` (choose: 2), and `Maneuvers 15` (choose: 2), excluding previously selected maneuvers.
- [x] In `src/rules/combatDice.ts`, implement `getSuperiorityDice(character: Character): { count: number; die: string } | null`.
- [x] Base dice count scales by Battle Master level ($4 \to 5 \to 6$) and die face scales ($d8$ at 3rd, $d10$ at 10th, $d12$ at 18th).
- [x] Increment count by +1 for *Superior Technique* fighting style and +1 for *Martial Adept* feat; upgrade their bonus dice to the Battle Master's die face if Battle Master is present (or $d6$ if non-Battle Master).
- [x] In `src/components/tabs/ActionsTab.tsx`, generate dedicated tactical cards for chosen maneuvers displaying maneuver description, dynamic Save DC ($8 + \text{PB} + \max(\text{STR}, \text{DEX})$), and current superiority die bonus.
- [x] In `src/components/tabs/FeaturesTab.tsx`, render a short-rest resource counter for `Superiority Dice` tracking current and maximum dice.
- [x] Verify with unit tests in `checks/battleMasterManeuvers.test.ts` covering milestone gating, dice scaling, feat integration, and save DC formulas.

