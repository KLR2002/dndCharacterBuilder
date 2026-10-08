# 03: Lineage Ancestral Legacy Inheritance Engine and Builder Integration

**What to build:** In `ancestryEngine.ts`, `grantedFeatures.ts`, and `AncestrySection.tsx`, implement VRGR *Ancestral Legacy*. When a player adopts a Lineage (*Dhampir*, *Hexblood*, *Reborn*) over an existing race, automatically retain that race's climbing, flying, and swimming speeds and skill proficiencies, while replacing other base race traits with lineage traits. When chosen at 1st level without a previous race (or if no speeds/skills were inherited), offer 2 free skill choices.

**Blocked by:** 01: Multi-Mode Movement Speeds Engine and Armor Flight Gating

**Status:** closed

- [x] When `character.lineageReplacement` is set and `character.race` exists, preserve prior race's swimming, climbing, and flying speeds in `characterSpeeds()`.
- [x] Preserve prior race's skill proficiencies in `skills()` and `characterEvaluation.ts`.
- [x] Suppress base race traits (e.g. breath weapon, darkvision if replaced) while granting lineage features.
- [x] When choosing a Lineage without a prior race (or if no speeds/skills were granted), render a 2-skill picker in `AncestrySection.tsx` choosing from the 18 standard skills.
- [x] Tested via `checks/lineageInheritance.test.ts` covering prior race speed/skill retention and 1st-level fallback.
