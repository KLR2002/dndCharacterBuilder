# 03: Combat Economy Engine: Passive Weapon & Armor Enhancement Bonuses

**What to build:**
Integrate passive magic weapon and armor enhancement bonuses into the rules engine and combat action ledgers. When a character equips a `+1`, `+2`, or `+3` weapon, their attack bonus and damage formula in `attacks.ts` and `tacticalActions.ts` should automatically increase by that bonus with an `[Item +X]` badge. When equipping magic armor or a magic shield with `bonusAc`, the character's Armor Class in `ac.ts` should automatically reflect the bonus with `+ X (Magic Item)` in the breakdown.

**Blocked by:** 01-ingestion-pipeline-magic-variants-expansion-and-type-normalization

**Status:** closed

- [x] In `src/rules/attacks.ts`, read `bonusWeapon` from equipped weapons in `getWeaponAttacks`
- [x] Add `bonusWeapon` to to-hit attack bonus and total damage formula, and push `Item +${bonusWeapon}` into calculation badges
- [x] In `src/rules/tacticalActions.ts`, ensure tactical weapon actions include the `bonusWeapon` modifier and calculation badges
- [x] In `src/rules/ac.ts`, read `bonusAc` from equipped armor and shields in `armorClass`
- [x] Add `bonusAc` to total AC and include `+ ${bonusAc} (Magic Item)` in the breakdown string
- [x] Support custom items that define `bonusWeapon` or `bonusAc` in the custom item modal
- [x] Add unit tests in `checks/magicItemsCombat.test.ts` verifying equipped weapons and armor with +1, +2, +3 modify attack bonuses, damage, and AC accurately
