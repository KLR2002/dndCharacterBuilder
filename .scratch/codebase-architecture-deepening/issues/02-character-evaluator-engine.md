# 02: Deep Character Evaluator Engine

**What to build:** Build the deep character evaluation module (`src/rules/characterEvaluation.ts`) with a single entry point `evaluateCharacter(character, options?)`. The module resolves catalog references (race, subrace, background) exactly once per pass, and calculates all derived character statistics: effective ability scores, armor class and breakdown, maximum hit points and hit dice, speeds and unarmored bonuses, saving throws, skills, passive perception/investigation/insight, and deduplicated proficiencies.

**Blocked by:** 01: Hit Dice Lifecycle Engine & Rest Operations.

**Status:** done

- [x] Define the `EvaluatedCharacter` interface in `src/rules/characterEvaluation.ts`.
- [x] Implement `evaluateCharacter(character, catalogs?)`, resolving ancestry and background once and invoking internal rule modules.
- [x] Ensure full support for multiclass combinations, unarmored defense precedence (first class in acquisition order), and lineage replacements.
- [x] Write unit tests in `checks/characterEvaluation.test.ts` verifying all combat and ability metrics across single-class and multiclass builds.
- [x] Verify zero TypeScript errors and all tests pass with `npm test`.

