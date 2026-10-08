# 04: Artificer Infusions Engine & Two-Tier Active Inventory Binding

**What to build:** Two-tier Artificer Infusions system: Infusions Known picker in `ruleChoices` scaling from 4 to 12 across Artificer levels (2, 6, 10, 14, 18) with flattened *Replicate Magic Item* options; Active Infusions Manager tracking `Infused Items: X / Max` ($2 \to 6$, +2 for Armorer 9); inventory equipment binding (`infusedWith`) and replicated magic item spawning; and automated combat math in `ac.ts` (*Enhanced Defense* +1/+2 AC) and `attacks.ts` (*Enhanced Weapon* +1/+2 attack/damage).

**Blocked by:** 01 (builds on rule choice foundations and equipment calculation rules).

**Status:** closed

- [x] In `src/rules/ruleChoices.ts`, implement `artificerInfusionChoices(character: Character, activeBooks?: string[])` scaling known capacity ($4 \to 12$) with level-gated options (2nd, 6th, 10th, 14th).
- [x] Flatten eligible *Replicate Magic Item* options into item-specific choices (e.g. `Replicate Magic Item: Bag of Holding`), supporting multiple selections of distinct items.
- [x] Add `activeInfusions?: { infusionName: string; targetItemId?: string; targetItemName?: string }[]` to character state, capped at the character's active infusion limit ($2 \to 6$, +2 for Armorer 9).
- [x] In `src/rules/ac.ts` and `characterEvaluation.ts`, add +1 AC (+2 at Artificer level 10+) if *Enhanced Defense* is active on equipped armor or shield.
- [x] In `src/rules/attacks.ts`, add +1 to attack and damage rolls (+2 at Artificer level 10+) if *Enhanced Weapon* is active on the weapon.
- [x] In `src/components/tabs/FeaturesTab.tsx` or `InventoryTab.tsx`, render an Active Infusion Manager allowing players to infuse inventory equipment or activate replicated items.
- [x] Verify with unit tests in `checks/artificerInfusions.test.ts` covering known capacity scaling, active slots limit, Replicate Magic Item multiplicity, and combat stat modifications.
