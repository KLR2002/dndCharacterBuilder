# 03: Builder Expertise Pickers and Validation

**What to build:** In the Builder tab under Class Progression, players choose their earned Expertise from dedicated milestone pickers when leveling up. Options are strictly filtered to skills and tools the character is currently proficient in, and invalid picks are cleanly detected and resolved.

**Blocked by:** 02: Unified Skill and Tool Expertise and Stats Display

**Status:** closed

- [x] Dedicated milestone cards render in `ClassProgressionSection.tsx` when classes reach expertise thresholds:
  - Rogue Level 1: Choose 2 proficiencies (skills or Thieves' Tools).
  - Rogue Level 6: Choose 2 proficiencies (skills or Thieves' Tools).
  - Bard Level 3: Choose 2 skill proficiencies.
  - Bard Level 10: Choose 2 skill proficiencies.
  - Knowledge Domain Cleric Level 1: Choose 2 skills from Arcana, History, Nature, Religion (grants proficiency and double PB).
  - Deft Explorer Ranger (TCoE) Level 1: Choose 1 proficient skill (*Canny*).
- [x] Expertise pickers only present skills and tools the character currently possesses proficiency in.
- [x] If a character changes race, background, or starting class skills such that an already-chosen expertise loses its prerequisite proficiency, the builder flags the pick as invalid and prunes it safely.
- [x] Tested via `checks/builderTransitions.test.ts` or `checks/expertise.test.ts`.
