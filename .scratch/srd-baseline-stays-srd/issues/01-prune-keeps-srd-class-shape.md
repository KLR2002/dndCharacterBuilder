# 01: The prune keeps the SRD class shape

**What to build:**

- **A testable prune.** Move the class step of `scripts/prune-to-srd.mjs` into a pure function `pruneClasses(rawClasses)` in a new TypeScript module `scripts/srdBaseline.ts`, and have the script import it. Node 24 strips types, so the `.mjs` script can import a `.ts` file.
  - If `npm run lint`, `typecheck` or `typecheck:checks` need `scripts/` added to a config, add it.
  - If importing `.ts` from the script does not work, say why and pick the nearest working form.
- **`pruneClasses` does what the script does today, plus three rules:**
  - Keep: the SRD archetype filter, and source `"SRD"` on each class and kept subclass.
  - Every class's `description` becomes `""`. The PHB intro prose is non-SRD (ADR 0014).
  - Every option in a feature's `choices.options`, on class and subclass features, gets source `"SRD"`.
  - Every option in a subclass's `spellChoice.options` gets source `"SRD"`.
- **Regenerate.** Run `node scripts/prune-to-srd.mjs`. Restore `src/data/summary.json` if only its timestamp changed. The `src/data` diff must be exactly:
  - Ranger Hunter: 16 features become 5, with folded choices carrying SRD sources.
  - Circle of the Land: a `spellChoice`.
  - Way of the Open Hand: `additionalSpells[0].ability`.
  - Grappler: the bullet spacing in `feats.json`.

  Anything else means the scraper data drifted. Stop and report it.
- **The guard test.** In `checks/featureOptionsDescription.test.ts`, "Dual-Mode: SRD features render unchanged, with no folded options":
  - Replace "no SRD feature has `choices`" with "every folded option in the SRD Baseline has source `SRD`".
  - Keep the render check for features without choices.
  - Rename the test to match.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merge 37ed258 (0e03c84) and review fix. `pruneClasses` in `scripts/srdBaseline.ts` (imported by the `.mjs` script); class descriptions `""`, folded and `spellChoice` options sourced `SRD`; regenerated `classes.json` (Hunter 16 → 5 features, Land `spellChoice`, Open Hand ability) and `feats.json` (Grappler spacing). The premise did not hold: no Hunter pick was offered in either mode, because the subclass choice table had no Hunter rows. The implementer added rows for all four tiers. Review fix: the rows are `PHB__Ranger__Hunter__…` with source `PHB`, like the Circle of the Land row, so the integrated Hunter's PHB options match the row's book; the SRD tests use the default books, and the SRD "PHB off" case moved to book-admission ticket 04 (the row filter at `ruleChoices.ts` ~194 drops `PHB` rows when PHB is off, Land included). The spell-choice reader admits `SRD` options by hand until book-admission. New scenario `Class Choices SRD Hunter` (green at 393, SRD and integrated); 11 tests in `checks/srdBaseline.test.ts`; check:all and check:live passed.

- [x] Tests (`checks/srdBaseline.test.ts`, feeding `pruneClasses` a small raw input):
  - A class description becomes `""`.
  - A non-SRD subclass is dropped.
  - A folded option and a `spellChoice` option become source `SRD`.
- [x] Tests on the regenerated baseline, through the function the Class Choices step reads (find it from `src/rules/classChoices.ts`):
  - An SRD Ranger 3 Hunter is offered one Hunter's Prey pick of Colossus Slayer, Giant Killer and Horde Breaker, with the PHB book switched off.
  - An SRD Ranger 7 Hunter also gets Defensive Tactics.
  - The Features tab text for Hunter's Prey lists the three options: `describeClassFeature` with the SRD source and default books.
  - A saved SRD Ranger 5 Hunter made before this change loads through `migrateCharacter` and reconciles without error, and its Hunter's Prey pick is pending.
- [x] Paste the `git diff --stat src/data` and the Hunter's feature names after the run.
- [x] `npm run check:all` and `npm run check:live` pass.
- [x] Scoped layout: find the scenarios that seed a Ranger (`grep -rn "Ranger" checks/layout`) and run them at `WIDTHS=393`, SRD. If one shows the Class Choices step for a Ranger at level 3 or above, open its screenshot and describe the Hunter's Prey pick. If none does, add `Class Choices SRD Hunter` (a Ranger 3 Hunter in the builder's Class Choices step, seeded the way the other Class Choices scenarios are) and describe its screenshot.
