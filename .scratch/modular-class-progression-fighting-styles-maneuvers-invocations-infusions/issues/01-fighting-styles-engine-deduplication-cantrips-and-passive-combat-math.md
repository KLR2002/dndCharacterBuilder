# 01: Fighting Styles Selection Engine, Deduplication, Cantrips & Passive Combat Math

**What to build:** End-to-end Fighting Styles progression: class-specific option pickers for Fighter (1st & 10th Champion), Paladin (2nd), and Ranger (2nd), with cross-class and milestone deduplication; sub-rule choices for cantrip styles (*Blessed Warrior*, *Druidic Warrior*) synchronizing into `knownSpells`; automated passive combat math in `attacks.ts` (*Archery* +2 to hit, *Dueling* +2 damage, *Two-Weapon Fighting* ability mod) and `ac.ts` (*Defense* +1 AC in armor); and *Fighting Initiate* feat support.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] In `src/rules/ruleChoices.ts`, implement `fightingStyleRuleChoices(character: Character, activeBooks?: string[])` offering class-filtered styles for Fighter, Paladin, and Ranger.
- [x] Dynamically exclude previously selected fighting styles across multiclassing and Champion 10th-level *Additional Fighting Style*.
- [x] For *Blessed Warrior* (Paladin) and *Druidic Warrior* (Ranger), offer sub-rule choices selecting 2 cantrips from Cleric or Druid spell lists, adding them to `knownSpells` under the class's spellcasting ability.
- [x] In `src/rules/attacks.ts`, apply +2 attack roll bonus for ranged weapons if *Archery* is chosen; apply +2 damage roll bonus for single one-handed melee weapon attacks if *Dueling* is chosen; add ability modifier to off-hand damage for *Two-Weapon Fighting*.
- [x] In `src/rules/ac.ts` and `characterEvaluation.ts`, add +1 AC if *Defense* is chosen and armor is equipped.
- [x] In `src/components/builder/AsiFeatSection.tsx`, provide an inline style picker when the *Fighting Initiate* feat is selected.
- [x] Verify with unit tests in `checks/fightingStyles.test.ts` covering class filtering, deduplication, cantrip addition, feat selection, and passive combat math.
